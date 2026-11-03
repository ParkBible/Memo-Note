import type { Note } from '@/types';

const lines = (note: Note) =>
  note.text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** 첫 줄을 제목으로 쓴다 */
export const noteTitle = (note: Note) => lines(note)[0] ?? '새 메모';

export const notePreview = (note: Note) => lines(note).slice(1).join(' ');

/** 오늘이면 시각, 올해면 월·일, 그 전이면 연도까지 */
export function formatEditedAt(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}
