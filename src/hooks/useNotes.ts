import { useEffect, useState } from 'react';
import type { Note } from '@/types';
import { onNotesChanged } from '@/data/db';
import { listNotes } from '@/data/notes';

/** 검색어에 맞는 메모 목록. 이 기기 저장이나 동기화로 메모가 바뀌면 다시 읽는다 */
export function useNotes(query: string) {
  const [notes, setNotes] = useState<Note[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listNotes(query).then((next) => {
        if (!cancelled) setNotes(next);
      });
    void load();
    const off = onNotesChanged(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, [query]);

  return notes;
}
