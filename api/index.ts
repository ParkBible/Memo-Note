import { app } from '../server/app.js';

// Vercel 함수 진입점. vercel.json 이 /api/* 요청을 모두 여기로 보내고, Hono 가 원래 경로로 라우팅한다
export default app;
