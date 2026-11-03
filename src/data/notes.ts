import type { Note } from '@/types';
import { db, emitNotesChanged } from './db';

const now = () => new Date().toISOString();

const compact = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** 고정한 메모 먼저, 그 안에서는 최근 수정순. query 는 공백·대소문자 무시 */
export async function listNotes(query?: string): Promise<Note[]> {
  const notes = await db.notes.orderBy('editedAt').reverse().toArray();
  const q = query ? compact(query) : '';
  const matched = q ? notes.filter((n) => compact(n.text).includes(q)) : notes;
  return [...matched.filter((n) => n.pinned), ...matched.filter((n) => !n.pinned)];
}

export async function getNote(id: string): Promise<Note | null> {
  return (await db.notes.get(id)) ?? null;
}

export async function createNote(): Promise<Note> {
  const at = now();
  const note: Note = { id: crypto.randomUUID(), content: '', text: '', pinned: false, createdAt: at, editedAt: at, updatedAt: at };
  await db.notes.add(note);
  emitNotesChanged('local');
  return note;
}

export async function saveNoteContent(id: string, content: string, text: string): Promise<void> {
  const at = now();
  const updated = await db.notes.update(id, { content, text, editedAt: at, updatedAt: at });
  if (updated) emitNotesChanged('local');
}

export async function setNotePinned(id: string, pinned: boolean): Promise<void> {
  const updated = await db.notes.update(id, { pinned, updatedAt: now() });
  if (updated) emitNotesChanged('local');
}

export async function deleteNote(id: string): Promise<void> {
  await db.transaction('rw', db.notes, db.tombstones, async () => {
    await db.notes.delete(id);
    await db.tombstones.put({ id, deletedAt: now() });
  });
  emitNotesChanged('local');
}

/** 탭을 닫거나 새로고침해 에디터 정리가 못 돈 빈 메모를 앱 시작 때 치운다 */
export async function deleteEmptyNotes(exceptId?: string): Promise<void> {
  const empty = await db.notes.filter((n) => n.id !== exceptId && !n.text.trim()).primaryKeys();
  for (const id of empty) await deleteNote(id);
}

/** 아무것도 안 적고 나간 새 메모를 치운다 */
export async function deleteIfEmpty(id: string): Promise<void> {
  const note = await db.notes.get(id);
  if (note && !note.text.trim()) await deleteNote(id);
}
