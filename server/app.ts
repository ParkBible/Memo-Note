import { Hono } from 'hono';
import { authEnabled, authRoutes, requireUser } from './auth.js';
import { HttpError } from './errors.js';
import { fetchLinkPreview } from './linkPreview.js';

/**
 * API 라우트. 메모 저장·검색은 브라우저(IndexedDB)가 하고, 서버는 구글 로그인·드라이브 access token 발급과
 * 브라우저가 CORS 때문에 직접 못 읽는 링크 미리보기(og 태그)만 맡는다.
 * 로컬은 server/index.ts 가, Vercel 은 api/index.ts 가 이 앱을 띄운다.
 */
export const app = new Hono().basePath('/api');

app.get('/health', (c) => c.json({ ok: true, authEnabled: authEnabled() }));

app.route('/auth', authRoutes);

app.use('/link-preview', requireUser);

app.get('/link-preview', async (c) => {
  const url = c.req.query('url')?.trim() ?? '';
  if (!url || url.length > 2048) throw new HttpError(400, '미리볼 주소를 확인해 주세요.');
  c.header('Cache-Control', 'private, max-age=3600');
  return c.json(await fetchLinkPreview(url));
});

app.notFound((c) => c.json({ error: '없는 API 경로예요.' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: '서버에서 문제가 발생했어요. 잠시 후 다시 시도해 주세요.' }, 500);
});
