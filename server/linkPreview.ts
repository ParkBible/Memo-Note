import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { HttpError } from './errors.js';
import type { LinkPreview } from '../src/types.js';

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 400;

/** 사설·루프백·링크로컬·CGNAT·멀티캐스트 등 외부 인터넷이 아닌 대역. 서버가 내부망을 대신 열어 주지 않게 막는다 */
function isPublicAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return !(
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      /^fe[89ab]/.test(lower) ||
      lower.startsWith('ff')
    );
  }
  const [a, b] = address.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HttpError(400, 'http·https 주소만 미리볼 수 있어요.');
  if (url.username || url.password) throw new HttpError(400, '계정 정보가 들어간 주소는 미리볼 수 없어요.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!addresses.length) throw new HttpError(422, '주소를 찾을 수 없어요.');
  if (!addresses.every(isPublicAddress)) throw new HttpError(400, '내부망 주소는 미리볼 수 없어요.');
}

/** 리다이렉트는 직접 따라가며 매 단계 주소를 다시 검사한다 */
async function fetchHtml(start: URL): Promise<{ url: URL; html: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // 유튜브 등은 일반 봇에겐 og 태그 없는 페이지를 주고, 링크 미리보기 크롤러(facebookexternalhit)에겐 og 태그를 준다
        'User-Agent': 'Mozilla/5.0 (compatible; MemoNoteLinkPreview/1.0) facebookexternalhit/1.1',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko,en;q=0.8',
      },
    }).catch(() => {
      throw new HttpError(502, '페이지를 열지 못했어요.');
    });

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw new HttpError(422, `페이지가 응답하지 않았어요. (${res.status})`);
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml/i.test(type)) throw new HttpError(422, '웹페이지가 아니라 미리볼 수 없어요.');
    return { url, html: await readCapped(res, type) };
  }
  throw new HttpError(422, '리다이렉트가 너무 많아요.');
}

/** og 태그는 head 에 있으므로 앞부분만 읽는다. 국내 사이트 중 EUC-KR 이 남아 있어 charset 을 따라 디코딩한다 */
async function readCapped(res: Response, contentType: string): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const bytes = Buffer.concat(chunks).subarray(0, MAX_BYTES);
  const head = bytes.subarray(0, 4096).toString('latin1');
  const charset =
    contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decodeEntities = (s: string) =>
  s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });

const clean = (s: string | undefined, max: number) => {
  const text = s ? decodeEntities(s).replace(/\s+/g, ' ').trim() : '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

function readMeta(html: string) {
  const meta = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = new Map<string, string>();
    for (const [, name, , dq, sq, bare] of tag.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
      attrs.set(name.toLowerCase(), dq ?? sq ?? bare ?? '');
    }
    const key = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase();
    const content = attrs.get('content');
    if (key && content && !meta.has(key)) meta.set(key, content);
  }
  return meta;
}

const httpUrl = (raw: string | undefined, base: URL) => {
  if (!raw) return undefined;
  try {
    const url = new URL(decodeEntities(raw.trim()), base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  let start: URL;
  try {
    start = new URL(rawUrl);
  } catch {
    throw new HttpError(400, '주소 형식이 올바르지 않아요.');
  }
  const { url, html } = await fetchHtml(start);
  const meta = readMeta(html);
  const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const title = clean(meta.get('og:title') ?? meta.get('twitter:title') ?? pageTitle, MAX_TITLE);
  if (!title) throw new HttpError(422, '이 페이지에는 미리볼 정보가 없어요.');
  return {
    url: start.href,
    title,
    description: clean(meta.get('og:description') ?? meta.get('twitter:description') ?? meta.get('description'), MAX_DESCRIPTION) || undefined,
    image: httpUrl(meta.get('og:image') ?? meta.get('og:image:url') ?? meta.get('twitter:image'), url),
    siteName: clean(meta.get('og:site_name'), 100) || undefined,
  };
}
