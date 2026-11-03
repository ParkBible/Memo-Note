import { createHash, randomBytes } from 'node:crypto';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import { HttpError } from './errors.js';

/**
 * 구글 로그인. 허용한 이메일(ALLOWED_EMAILS)만 로그인시키고, 브라우저가 드라이브 appDataFolder 에 직접 동기화하도록 access token 을 발급한다.
 * refresh token 과 로그인 이메일은 서명한 httpOnly 쿠키에만 둔다. 서버는 아무것도 저장하지 않는다(서버리스 그대로 동작).
 * GOOGLE_CLIENT_ID 가 없으면 로그인이 꺼지고 메모는 이 브라우저에만 저장된다.
 */

const SCOPE = 'openid email https://www.googleapis.com/auth/drive.appdata';
const SESSION_COOKIE = 'mn_session';
const REFRESH_COOKIE = 'mn_refresh';
const OAUTH_COOKIE = 'mn_oauth';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

const env = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? '',
  secret: process.env.SESSION_SECRET?.trim() ?? '',
  allowed: (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
});

export const authEnabled = () => !!env().clientId;

/** 로그인에 필요한 환경변수가 빠졌으면 무엇이 빠졌는지. 다 있으면 빈 배열 */
export function missingAuthEnv(): string[] {
  const e = env();
  return [
    !e.clientId && 'GOOGLE_CLIENT_ID',
    !e.clientSecret && 'GOOGLE_CLIENT_SECRET',
    !e.secret && 'SESSION_SECRET',
    !e.allowed.length && 'ALLOWED_EMAILS',
  ].filter((v): v is string => !!v);
}

function requireConfig() {
  const missing = missingAuthEnv();
  if (missing.length) throw new HttpError(503, `서버에 로그인 설정(${missing.join(', ')})이 없어요.`);
  return env();
}

/** 콜백 주소의 기준. 프록시 뒤라 요청 URL 로 알기 어려우면 APP_ORIGIN 으로 정한다 */
const appOrigin = (c: Context) => process.env.APP_ORIGIN?.trim().replace(/\/$/, '') || new URL(c.req.url).origin;

const cookieOptions = (c: Context, maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: appOrigin(c).startsWith('https://'),
  sameSite: 'Lax',
  path: '/',
  maxAge,
});

const base64Url = (buf: Buffer) => buf.toString('base64url');

/** 구글 토큰 엔드포인트에서 TLS 로 직접 받은 id_token 이라 서명 검증 없이 내용만 읽는다 */
function readIdToken(idToken: unknown): { email?: string; emailVerified: boolean; aud?: string } {
  if (typeof idToken !== 'string') return { emailVerified: false };
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return { email: payload.email?.toLowerCase(), emailVerified: payload.email_verified === true, aud: payload.aud };
  } catch {
    return { emailVerified: false };
  }
}

async function googleToken(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

async function readSession(c: Context): Promise<string | null> {
  const { secret, allowed } = env();
  if (!secret) return null;
  const value = await getSignedCookie(c, secret, SESSION_COOKIE);
  if (!value) return null;
  const [email, exp] = value.split('|');
  if (!email || !(Number(exp) > Date.now()) || !allowed.includes(email)) return null;
  return email;
}

function clearAuthCookies(c: Context) {
  for (const name of [SESSION_COOKIE, REFRESH_COOKIE, OAUTH_COOKIE]) deleteCookie(c, name, { path: '/' });
}

const isProduction = () => process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

/** 서버가 남 대신 외부 요청을 보내는 API 앞에 붙인다. 로그인 설정이 없으면 로컬 개발에서만 열어 둔다 */
export const requireUser: MiddlewareHandler = async (c, next) => {
  if (!authEnabled()) {
    if (isProduction()) throw new HttpError(503, '서버에 로그인 설정(GOOGLE_CLIENT_ID)이 없어 이 기능을 막아 두었어요.');
    return next();
  }
  requireConfig();
  if (!(await readSession(c))) throw new HttpError(401, '링크 미리보기는 구글 로그인 후에 쓸 수 있어요.');
  return next();
};

export const authRoutes = new Hono();

authRoutes.get('/login', async (c) => {
  const { clientId, secret } = requireConfig();
  const state = base64Url(randomBytes(16));
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  await setSignedCookie(c, OAUTH_COOKIE, `${state}|${verifier}`, secret, cookieOptions(c, 600));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appOrigin(c)}/api/auth/callback`,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // refresh_token 을 매번 받는다
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRoutes.get('/callback', async (c) => {
  const { clientId, clientSecret, secret, allowed } = requireConfig();
  const fail = (reason: string) => {
    clearAuthCookies(c);
    return c.redirect(`/?auth=${reason}`);
  };

  const saved = await getSignedCookie(c, secret, OAUTH_COOKIE);
  deleteCookie(c, OAUTH_COOKIE, { path: '/' });
  const [state, verifier] = saved ? saved.split('|') : [];
  const code = c.req.query('code');
  if (!state || !verifier || !code || c.req.query('state') !== state) return fail('error');

  const { ok, data } = await googleToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${appOrigin(c)}/api/auth/callback`,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  if (!ok || typeof data.refresh_token !== 'string') {
    console.error('[auth] token exchange failed', data.error);
    return fail('error');
  }

  const { email, emailVerified, aud } = readIdToken(data.id_token);
  if (!email || !emailVerified || aud !== clientId || !allowed.includes(email)) return fail('denied');

  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  await setSignedCookie(c, SESSION_COOKIE, `${email}|${exp}`, secret, cookieOptions(c, SESSION_MAX_AGE));
  await setSignedCookie(c, REFRESH_COOKIE, data.refresh_token, secret, cookieOptions(c, SESSION_MAX_AGE));
  return c.redirect('/');
});

/** 로그인 상태. 로그인이 꺼져 있으면 enabled: false */
authRoutes.get('/me', async (c) => {
  if (!authEnabled()) return c.json({ enabled: false, email: null });
  return c.json({ enabled: true, email: await readSession(c) });
});

/** 드라이브 동기화용 access token. refresh token 은 쿠키에서만 꺼내 쓰고 브라우저에 주지 않는다 */
authRoutes.post('/token', async (c) => {
  const { clientId, clientSecret, secret } = requireConfig();
  const refreshToken = (await readSession(c)) && (await getSignedCookie(c, secret, REFRESH_COOKIE));
  if (!refreshToken) throw new HttpError(401, '다시 로그인해 주세요.');

  const { ok, data } = await googleToken({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  if (data.error === 'invalid_grant') {
    // 사용자가 권한을 끊었거나 refresh token 이 만료됨. 이때만 로그아웃시킨다
    clearAuthCookies(c);
    throw new HttpError(401, '구글 로그인이 만료됐어요. 다시 로그인해 주세요.');
  }
  if (!ok || typeof data.access_token !== 'string') {
    // 구글 쪽 일시 장애(5xx·429 등)는 로그인을 유지하고 다음 동기화 때 다시 시도한다
    console.error('[auth] token refresh failed', data.error);
    throw new HttpError(502, '구글 인증 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return c.json({ accessToken: data.access_token, expiresIn: Number(data.expires_in) || 3600 });
});

authRoutes.post('/logout', async (c) => {
  const { secret } = env();
  const refreshToken = secret ? await getSignedCookie(c, secret, REFRESH_COOKIE) : null;
  if (refreshToken) {
    // 실패해도 쿠키는 지운다 (구글 쪽 권한은 계정 설정에서 끊을 수 있다)
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: 'POST' }).catch(() => {});
  }
  clearAuthCookies(c);
  return c.body(null, 204);
});
