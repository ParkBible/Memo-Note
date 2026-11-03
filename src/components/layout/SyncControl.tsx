import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, type IconName } from '@/components/ui';
import { login, useSession, useSyncState } from '@/sync/session';
import { syncNow, type SyncStatus } from '@/sync/sync';
import styles from './AppLayout.module.css';

const STATUS_META: Record<Exclude<SyncStatus, 'off'>, { icon: IconName; label: string }> = {
  idle: { icon: 'cloudCheck', label: '드라이브와 동기화됨 (눌러서 지금 동기화)' },
  syncing: { icon: 'cloud', label: '드라이브와 동기화하는 중' },
  error: { icon: 'alert', label: '동기화에 실패했어요 (눌러서 다시 시도)' },
  auth: { icon: 'alert', label: '로그인이 만료됐어요 (눌러서 다시 로그인)' },
};

const AUTH_NOTICE: Record<string, string> = {
  denied: '이 구글 계정은 허용되지 않았어요.',
  error: '구글 로그인에 실패했어요. 다시 시도해 주세요.',
};

/** 헤더 오른쪽 로그인·드라이브 동기화 버튼. 서버에 로그인 설정이 없으면 아무것도 그리지 않는다 */
export function SyncControl() {
  const { session, signOut } = useSession();
  const { status, lastSyncedAt } = useSyncState();
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState<string>();

  // 로그인 콜백이 붙여 보낸 ?auth= 는 한 번 보여주고 주소에서 지운다
  useEffect(() => {
    const reason = params.get('auth');
    if (!reason) return;
    setNotice(AUTH_NOTICE[reason] ?? AUTH_NOTICE.error);
    params.delete('auth');
    setParams(params, { replace: true });
  }, [params, setParams]);

  if (session.state === 'loading' || session.state === 'disabled') return null;

  if (session.state === 'signedOut') {
    return (
      <div className={styles.sync}>
        {notice && (
          <span className={styles.syncNotice} role="alert">
            {notice}
          </span>
        )}
        <Button variant="secondary" size="sm" icon="cloud" onClick={login} title="구글 드라이브에 동기화">
          로그인
        </Button>
      </div>
    );
  }

  const meta = STATUS_META[status === 'off' ? 'idle' : status];
  const title = [
    meta.label,
    session.email,
    lastSyncedAt && `마지막 동기화 ${lastSyncedAt.toLocaleTimeString()}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className={styles.sync}>
      <Button
        variant="ghost"
        iconOnly
        icon={meta.icon}
        loading={status === 'syncing'}
        onClick={status === 'auth' ? login : () => void syncNow()}
        aria-label={meta.label}
        title={title}
      />
      <Button variant="ghost" iconOnly icon="logout" onClick={() => void signOut()} aria-label="로그아웃" title="로그아웃" />
    </div>
  );
}
