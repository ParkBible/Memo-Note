import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { app as api } from './app.js';
import { authEnabled, missingAuthEnv } from './auth.js';

/**
 * 로컬 실행용 Node 서버. 개발 중엔 API 만 띄우고 Vite 가 /api 를 여기로 넘긴다.
 * dist/ 가 있으면(npm run build 후 npm start) 화면도 함께 내보내 서버 하나로 동작한다.
 */

if (existsSync('.env')) process.loadEnvFile('.env');

const server = new Hono();
server.route('/', api);
// 하위 앱의 notFound 는 route() 로 붙이면 쓰이지 않는다. 없는 /api 경로가 아래 index.html 로 빠지지 않게 막는다
server.all('/api/*', (c) => c.json({ error: '없는 API 경로예요.' }, 404));
if (existsSync('dist/index.html')) {
  server.use('/*', serveStatic({ root: './dist' }));
  server.get('*', serveStatic({ path: './dist/index.html' }));
}

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 8790);
serve({ fetch: server.fetch, port }, () => {
  console.log(`[api] http://localhost:${port}/api`);
  if (!authEnabled()) {
    console.warn('[api] GOOGLE_CLIENT_ID 가 없어 로그인·드라이브 동기화가 꺼져 있어요. 메모는 이 브라우저에만 저장돼요.');
  } else if (missingAuthEnv().length) {
    console.warn(`[api] 로그인 설정이 덜 됐어요: ${missingAuthEnv().join(', ')}`);
  }
});
