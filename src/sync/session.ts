import { useEffect, useState, useSyncExternalStore } from 'react';
import { forgetAccessToken } from './drive';
import { claimLocalData, getSyncState, onSyncStateChanged, startSync, stopSync } from './sync';

/**
 * 구글 로그인 상태. 로그인하면 드라이브 동기화를 시작한다.
 * 서버에 로그인 설정이 없으면(enabled: false) 이 기기에만 저장하고 버튼도 숨긴다.
 */

export type Session = { state: 'loading' } | { state: 'disabled' } | { state: 'signedOut' } | { state: 'signedIn'; email: string };

export const login = () => {
  window.location.href = '/api/auth/login';
};

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  forgetAccessToken();
  stopSync();
}

export function useSession() {
  const [session, setSession] = useState<Session>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? (res.json() as Promise<{ enabled: boolean; email: string | null }>) : Promise.reject()))
      .then(({ enabled, email }) => {
        if (cancelled) return;
        setSession(!enabled ? { state: 'disabled' } : email ? { state: 'signedIn', email } : { state: 'signedOut' });
        if (email) void claimLocalData(email).then(startSync);
      })
      // 서버에 닿지 못하면 이 기기 저장만으로 동작한다
      .catch(() => !cancelled && setSession({ state: 'disabled' }));
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = async () => {
    await logout();
    setSession({ state: 'signedOut' });
  };

  return { session, signOut };
}

let snapshot = getSyncState();
const subscribe = (cb: () => void) =>
  onSyncStateChanged(() => {
    snapshot = getSyncState();
    cb();
  });

export const useSyncState = () => useSyncExternalStore(subscribe, () => snapshot);
