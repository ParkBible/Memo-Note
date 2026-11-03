import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** 화면에 그대로 보여줄 수 있는 메시지를 가진 에러. 라우트가 { error } JSON 으로 바꿔 응답한다 */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message);
  }
}
