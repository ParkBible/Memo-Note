import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import type { Note } from '@/types';
import { Button, Icon } from '@/components/ui';
import { onNotesChanged } from '@/data/db';
import { LinkCard } from '@/editor/LinkCard';
import { deleteIfEmpty, deleteNote, getNote, saveNoteContent, setNotePinned } from '@/data/notes';
import { formatEditedAt } from '@/lib/noteText';
import styles from './NotePage.module.css';

const SAVE_DEBOUNCE_MS = 400;

const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true },
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  LinkCard,
  Placeholder.configure({ placeholder: '메모를 입력하세요. # 제목, - 목록, [ ] 체크리스트, **굵게** 처럼 쓰면 바로 서식이 바뀌어요.' }),
];

const plainText = (editor: Editor) => editor.getText({ blockSeparator: '\n' });

/**
 * 지금 열려 있는 메모. 에디터를 닫을 때 빈 메모를 치울지 판단한다.
 * StrictMode 개발 환경은 마운트 직후 한 번 언마운트했다 다시 붙이므로, 정리를 한 틱 미뤄 아직 같은 메모가 열려 있으면 건너뛴다.
 */
let openNoteId: string | null = null;

export function NotePage() {
  const { id = '' } = useParams();
  const [note, setNote] = useState<Note | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setNote(undefined);
    void getNote(id).then((found) => !cancelled && setNote(found));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (note === undefined) return null;
  if (note === null) {
    return (
      <div className={styles.missing}>
        <p>메모를 찾을 수 없어요. 다른 기기에서 지웠을 수 있어요.</p>
        <Link to="/">목록으로</Link>
      </div>
    );
  }
  return <NoteEditor key={note.id} initial={note} />;
}

function NoteEditor({ initial }: { initial: Note }) {
  const navigate = useNavigate();
  const [pinned, setPinned] = useState(initial.pinned);
  const [editedAt, setEditedAt] = useState(initial.editedAt);
  const pendingSave = useRef<ReturnType<typeof setTimeout>>();

  const flushSave = (editor: Editor) => {
    if (!pendingSave.current) return Promise.resolve();
    clearTimeout(pendingSave.current);
    pendingSave.current = undefined;
    return saveNoteContent(initial.id, editor.getHTML(), plainText(editor));
  };

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initial.content,
    autofocus: initial.text.trim() ? false : 'end',
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: current }) => {
      clearTimeout(pendingSave.current);
      pendingSave.current = setTimeout(() => {
        pendingSave.current = undefined;
        void saveNoteContent(initial.id, current.getHTML(), plainText(current)).then(() => setEditedAt(new Date().toISOString()));
      }, SAVE_DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const id = initial.id;
    openNoteId = id;
    return () => {
      if (openNoteId === id) openNoteId = null;
      const saved = flushSave(editor);
      setTimeout(() => {
        if (openNoteId !== id) void saved.then(() => deleteIfEmpty(id));
      }, 0);
    };
  }, [editor, initial.id]);

  // 다른 기기에서 고친 내용이 동기화로 들어오면 반영한다. 입력 중(저장 대기)일 땐 내 입력을 지킨다
  useEffect(() => {
    if (!editor) return;
    return onNotesChanged(async (source) => {
      if (source !== 'remote') return;
      const latest = await getNote(initial.id);
      if (!latest) {
        navigate('/', { replace: true });
        return;
      }
      setPinned(latest.pinned);
      setEditedAt(latest.editedAt);
      if (!pendingSave.current && latest.content !== editor.getHTML()) {
        editor.commands.setContent(latest.content, { emitUpdate: false });
      }
    });
  }, [editor, initial.id, navigate]);

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    await setNotePinned(initial.id, next);
  };

  const remove = async () => {
    if (!window.confirm('이 메모를 지울까요? 되돌릴 수 없어요.')) return;
    clearTimeout(pendingSave.current);
    pendingSave.current = undefined;
    await deleteNote(initial.id);
    navigate('/', { replace: true });
  };

  return (
    <article className={styles.note}>
      <div className={styles.bar}>
        <Link to="/" className={styles.back} aria-label="목록으로">
          <Icon name="arrowLeft" size={20} />
        </Link>
        <time className={styles.edited} dateTime={editedAt}>
          {formatEditedAt(editedAt)} 수정
        </time>
        <div className={styles.spacer} />
        <Button
          variant={pinned ? 'secondary' : 'ghost'}
          iconOnly
          icon="pin"
          onClick={() => void togglePin()}
          aria-pressed={pinned}
          aria-label={pinned ? '고정 해제' : '맨 위에 고정'}
          title={pinned ? '고정 해제' : '맨 위에 고정'}
        />
        <Button variant="ghost" iconOnly icon="trash" onClick={() => void remove()} aria-label="메모 삭제" title="메모 삭제" />
      </div>
      <EditorContent editor={editor} className={styles.editor} />
    </article>
  );
}
