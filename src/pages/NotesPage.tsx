import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { Button, Icon } from '@/components/ui';
import { createNote } from '@/data/notes';
import { useNotes } from '@/hooks/useNotes';
import { cx } from '@/lib/cx';
import { formatEditedAt, notePreview, noteTitle } from '@/lib/noteText';
import styles from './NotesPage.module.css';

const SEARCH_DEBOUNCE_MS = 200;

/** 왼쪽 목록 + 오른쪽 에디터. 좁은 화면에서는 메모를 열면 목록을 숨긴다 */
export function NotesPage() {
  const { id: openId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const notes = useNotes(query);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const addNote = async () => {
    const note = await createNote();
    setInput('');
    navigate(`/notes/${note.id}`);
  };

  return (
    <div className={cx(styles.page, openId && styles.hasOpen)}>
      <aside className={styles.sidebar} aria-label="메모 목록">
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <Icon name="search" size={18} />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메모 검색"
              aria-label="메모 검색"
            />
          </label>
          <Button icon="plus" onClick={() => void addNote()}>
            새 메모
          </Button>
        </div>

        {notes && notes.length === 0 && (
          <p className={styles.empty}>{query ? '찾는 메모가 없어요.' : '아직 메모가 없어요. 새 메모를 만들어 보세요.'}</p>
        )}

        <ul className={styles.list}>
          {notes?.map((note) => (
            <li key={note.id}>
              <NavLink to={`/notes/${note.id}`} className={({ isActive }) => cx(styles.item, isActive && styles.active)}>
                <span className={styles.itemTitle}>
                  {note.pinned && <Icon name="pin" size={14} label="고정됨" className={styles.pinMark} />}
                  {noteTitle(note)}
                </span>
                <span className={styles.itemMeta}>
                  <time dateTime={note.editedAt}>{formatEditedAt(note.editedAt)}</time>
                  <span className={styles.itemPreview}>{notePreview(note)}</span>
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </aside>

      <section className={styles.pane}>
        <Outlet />
      </section>
    </div>
  );
}

export function NoNoteSelected() {
  return (
    <div className={styles.placeholder}>
      <Icon name="note" size={32} />
      <p>메모를 고르거나 새로 만들어 보세요.</p>
    </div>
  );
}
