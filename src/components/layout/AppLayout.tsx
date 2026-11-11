import { Link, Outlet } from 'react-router-dom';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
import { Button, ButtonAnchor, Icon, type IconName } from '@/components/ui';
import { SyncControl } from './SyncControl';
import styles from './AppLayout.module.css';

// 내 서비스 모음 대시보드 (Park-Hub)
const HUB_URL = 'https://park-bible.com';

const THEME_META: Record<ThemeMode, { icon: IconName; label: string }> = {
  light: { icon: 'sun', label: '라이트 모드 (눌러서 다크로)' },
  dark: { icon: 'moon', label: '다크 모드 (눌러서 시스템 설정으로)' },
  system: { icon: 'monitor', label: '시스템 설정 따름 (눌러서 라이트로)' },
};

export function AppLayout() {
  const { mode, cycle } = useTheme();
  const theme = THEME_META[mode];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            <span className={styles.brandMark}>
              <Icon name="note" size={20} />
            </span>
            메모장
          </Link>
          <div className={styles.spacer} />
          <SyncControl />
          <ButtonAnchor variant="ghost" iconOnly icon="grid" href={HUB_URL} target="_self" aria-label="허브로 이동" title="허브로 이동" />
          <Button variant="ghost" iconOnly icon={theme.icon} onClick={cycle} aria-label={theme.label} title={theme.label} />
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
