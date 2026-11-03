export interface Note {
  id: string;
  /** 에디터(TipTap)가 내보낸 HTML */
  content: string;
  /** content 의 글자만. 목록 제목·미리보기와 검색에 쓴다 */
  text: string;
  pinned: boolean;
  /** ISO 8601 */
  createdAt: string;
  /** 내용을 마지막으로 고친 시각. 목록 정렬·표시용이라 고정만 바꿀 땐 그대로 둔다 */
  editedAt: string;
  /** 고정 포함 아무 변경이든 마지막 시각. 동기화 병합에서 어느 쪽이 최신인지 이걸로 가린다 */
  updatedAt: string;
}

/** 링크 카드에 보여줄 페이지 정보. 서버가 대상 페이지의 og 태그에서 읽는다 */
export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  /** 대표 이미지 주소. 파일은 받아 두지 않고 원본을 그대로 보여준다 */
  image?: string;
  siteName?: string;
}
