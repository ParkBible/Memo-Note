import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function readStored(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    /* 저장소 접근 불가 시 시스템 설정 */
  }
  return 'system';
}

/** light → dark → system 순환. system 이면 data-theme 을 지워 OS 설정을 따른다 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readStored);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'system') delete root.dataset.theme;
    else root.dataset.theme = mode;
    try {
      if (mode === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* noop */
    }
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((m) => (m === 'light' ? 'dark' : m === 'dark' ? 'system' : 'light'));
  }, []);

  return { mode, setMode, cycle };
}
