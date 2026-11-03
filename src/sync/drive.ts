import type { Note } from '@/types';
import type { Tombstone } from '@/data/db';

/**
 * 구글 드라이브 appDataFolder 의 동기화 파일 하나를 읽고 쓴다. appDataFolder 는 이 앱(OAuth 클라이언트)만 보는 숨김 폴더라
 * 사용자의 다른 드라이브 파일에는 접근하지 않는다. access token 은 서버(/api/auth/token)가 발급한다.
 * Park-Hub 가 이 파일 이름으로 마지막 백업 시각을 읽으므로, 바꾸면 Park-Hub 의 src/services.ts 도 같이 바꾼다.
 */

const FILE_NAME = 'memo-note-data.json';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export interface SyncFile {
  version: 1;
  notes: Note[];
  tombstones: Tombstone[];
}

export class AuthRequiredError extends Error {}

let cached: { token: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  const res = await fetch('/api/auth/token', { method: 'POST' });
  if (res.status === 401) throw new AuthRequiredError('다시 로그인해 주세요.');
  if (!res.ok) throw new Error('드라이브 인증에 실패했어요.');
  const { accessToken: token, expiresIn } = (await res.json()) as { accessToken: string; expiresIn: number };
  cached = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

export const forgetAccessToken = () => {
  cached = undefined;
};

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...init.headers },
  });
  if (res.status === 401) {
    forgetAccessToken();
    throw new AuthRequiredError('드라이브 인증이 만료됐어요. 다시 로그인해 주세요.');
  }
  if (!res.ok) throw new Error(`드라이브 요청에 실패했어요. (${res.status})`);
  return res;
}

async function findFileId(): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const res = await driveFetch(`${DRIVE_API}/files?spaces=appDataFolder&q=${q}&fields=files(id)&orderBy=modifiedTime desc`);
  const { files } = (await res.json()) as { files?: { id: string }[] };
  return files?.[0]?.id ?? null;
}

const isNote = (n: unknown): n is Note => {
  const v = n as Partial<Note> | null;
  return (
    typeof v?.id === 'string' &&
    typeof v.content === 'string' &&
    typeof v.text === 'string' &&
    typeof v.pinned === 'boolean' &&
    typeof v.createdAt === 'string' &&
    typeof v.editedAt === 'string' &&
    typeof v.updatedAt === 'string'
  );
};

const isTombstone = (t: unknown): t is Tombstone => {
  const v = t as Partial<Tombstone> | null;
  return typeof v?.id === 'string' && typeof v.deletedAt === 'string';
};

/** 드라이브의 동기화 파일. 아직 없으면 null. 깨진 항목은 건너뛴다 */
export async function downloadSyncFile(): Promise<{ fileId: string; data: SyncFile } | null> {
  const fileId = await findFileId();
  if (!fileId) return null;
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?alt=media`);
  const data = (await res.json()) as Partial<SyncFile> | null;
  return {
    fileId,
    data: {
      version: 1,
      notes: Array.isArray(data?.notes) ? data.notes.filter(isNote) : [],
      tombstones: Array.isArray(data?.tombstones) ? data.tombstones.filter(isTombstone) : [],
    },
  };
}

/** fileId 가 있으면 덮어쓰고, 없으면 appDataFolder 에 새로 만든다 */
export async function uploadSyncFile(data: SyncFile, fileId: string | null): Promise<void> {
  const body = JSON.stringify(data);
  if (fileId) {
    await driveFetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return;
  }
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })], { type: 'application/json' }));
  form.append('file', new Blob([body], { type: 'application/json' }));
  await driveFetch(`${UPLOAD_API}/files?uploadType=multipart`, { method: 'POST', body: form });
}
