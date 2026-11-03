import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  // .env 의 API_PORT 만 읽는다 (VITE_ 접두사가 없어 클라이언트 번들에는 들어가지 않는다)
  const apiPort = loadEnv(mode, process.cwd(), '').API_PORT || '8790';

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      // 구글 OAuth 리디렉션 URI 가 이 포트로 등록돼 있어야 하므로 다른 포트로 밀려나지 않게 한다
      port: 5182,
      strictPort: true,
      proxy: { '/api': `http://localhost:${apiPort}` },
    },
  };
});
