import type { Note } from '@/types';
import { db, emitNotesChanged, onNotesChanged, type Tombstone } from '@/data/db';
import { AuthRequiredError, downloadSyncFile, uploadSyncFile, type SyncFile } from './drive';

/**
 * 이 기기 IndexedDB ↔ 드라이브 파일 동기화. 매번 양쪽을 메모 단위로 합친다.
 * - 같은 메모는 updatedAt 이 늦은 쪽이 이긴다.
 * - 삭제 기록(tombstone)이 그 메모의 마지막 수정보다 늦으면 삭제가 이긴다.
 */

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error' | 'auth';

const LOCAL_DEBOUNCE_MS = 2_000;
const FOCUS_THROTTLE_MS = 30_000;
/** 삭제 기록은 이 기간이 지나면 정리한다. 그동안 한 번도 동기화 안 한 기기의 메모는 되살아날 수 있다 */
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function merge(local: SyncFile, remote: SyncFile): SyncFile {
  const tombstones = new Map<string, Tombstone>();
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    const prev = tombstones.get(t.id);
    if (!prev || t.deletedAt > prev.deletedAt) tombstones.set(t.id, t);
  }

  const notes = new Map<string, Note>();
  for (const n of [...local.notes, ...remote.notes]) {
    const prev = notes.get(n.id);
    if (!prev || n.updatedAt > prev.updatedAt) notes.set(n.id, n);
  }

  for (const [id, note] of notes) {
    const t = tombstones.get(id);
    if (!t) continue;
    if (t.deletedAt >= note.updatedAt) notes.delete(id);
    else tombstones.delete(id); // 삭제 뒤에 다른 기기에서 다시 고친 메모는 살린다
  }

  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_MS).toISOString();
  return {
    version: 1,
    notes: [...notes.values()],
    tombstones: [...tombstones.values()].filter((t) => t.deletedAt >= cutoff),
  };
}

const EMPTY: SyncFile = { version: 1, notes: [], tombstones: [] };

const readLocal = async (): Promise<SyncFile> => ({
  version: 1,
  notes: await db.notes.toArray(),
  tombstones: await db.tombstones.toArray(),
});

const sortById = (f: SyncFile) => ({
  notes: [...f.notes].sort((a, b) => a.id.localeCompare(b.id)),
  tombstones: [...f.tombstones].sort((a, b) => a.id.localeCompare(b.id)),
});

const sameContent = (a: SyncFile, b: SyncFile) => JSON.stringify(sortById(a)) === JSON.stringify(sortById(b));

/** 원격을 이 기기와 합쳐 반영하고, 합친 결과(= 올릴 내용)를 돌려준다. 한 트랜잭션이라 그 사이 저장된 메모도 잃지 않는다 */
async function mergeIntoLocal(remote: SyncFile): Promise<{ merged: SyncFile; changed: boolean }> {
  return db.transaction('rw', db.notes, db.tombstones, async () => {
    const current = await readLocal();
    const merged = merge(current, remote);
    const changed = !sameContent(merged, current);
    if (changed) {
      await db.notes.clear();
      await db.notes.bulkPut(merged.notes);
      await db.tombstones.clear();
      await db.tombstones.bulkPut(merged.tombstones);
    }
    return { merged, changed };
  });
}

const OWNER_KEY = 'memo-note:sync-owner';

/** 로그인한 계정과 이 기기 데이터의 주인이 다르면 로컬을 비운다. 다른 계정의 메모가 이 계정 드라이브로 섞여 올라가지 않게 */
export async function claimLocalData(email: string) {
  let owner: string | null = null;
  try {
    owner = localStorage.getItem(OWNER_KEY);
  } catch {
    /* 저장소 접근 불가면 주인 확인 없이 진행 */
  }
  if (owner && owner !== email) {
    await db.transaction('rw', db.notes, db.tombstones, async () => {
      await db.notes.clear();
      await db.tombstones.clear();
    });
    emitNotesChanged('remote');
  }
  try {
    localStorage.setItem(OWNER_KEY, email);
  } catch {
    /* noop */
  }
}

let status: SyncStatus = 'off';
let lastSyncedAt: Date | null = null;
let running: Promise<void> | null = null;
let rerun = false;
let debounce: ReturnType<typeof setTimeout> | undefined;
let lastAttempt = 0;
/** startSync·stopSync 마다 올린다. 로그아웃 전에 시작한 동기화가 끝나며 상태를 덮어쓰지 않게 */
let generation = 0;
const statusListeners = new Set<() => void>();

const setStatus = (next: SyncStatus) => {
  status = next;
  statusListeners.forEach((l) => l());
};

export const getSyncState = () => ({ status, lastSyncedAt });

export function onSyncStateChanged(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

async function runOnce() {
  const gen = generation;
  const settle = (next: SyncStatus) => gen === generation && setStatus(next);
  lastAttempt = Date.now();
  setStatus('syncing');
  try {
    const remote = await downloadSyncFile();
    if (gen !== generation) return;
    const { merged, changed } = await mergeIntoLocal(remote?.data ?? EMPTY);
    if (changed) emitNotesChanged('remote');
    if (!remote || !sameContent(merged, remote.data)) {
      if (gen !== generation) return;
      await uploadSyncFile(merged, remote?.fileId ?? null);
    }
    if (gen === generation) lastSyncedAt = new Date();
    settle('idle');
  } catch (e) {
    console.error('[sync]', e);
    settle(e instanceof AuthRequiredError ? 'auth' : 'error');
  }
}

/** 지금 동기화. 이미 도는 중이면 끝난 뒤 한 번 더 돌린다 */
export function syncNow(): Promise<void> {
  if (status === 'off') return Promise.resolve();
  clearTimeout(debounce);
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    do {
      rerun = false;
      await runOnce();
    } while (rerun && status === 'idle');
    running = null;
  })();
  return running;
}

let detach: (() => void) | undefined;

/** 로그인 확인 후 호출. 시작 시 한 번, 이 기기에서 바꾼 뒤 2초, 창으로 돌아올 때(30초 간격) 동기화한다 */
export function startSync() {
  if (detach) return;
  generation++;
  setStatus('idle');
  const offChange = onNotesChanged((source) => {
    if (source !== 'local') return;
    clearTimeout(debounce);
    debounce = setTimeout(syncNow, LOCAL_DEBOUNCE_MS);
  });
  const onVisible = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastAttempt > FOCUS_THROTTLE_MS) void syncNow();
  };
  document.addEventListener('visibilitychange', onVisible);
  detach = () => {
    offChange();
    document.removeEventListener('visibilitychange', onVisible);
    clearTimeout(debounce);
  };
  void syncNow();
}

export function stopSync() {
  detach?.();
  detach = undefined;
  generation++;
  rerun = false;
  setStatus('off');
}
