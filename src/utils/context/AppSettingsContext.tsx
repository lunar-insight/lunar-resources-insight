import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface AppSettingsContextValue {
  /** Animations keep what informs and drop travel and growth. */
  reduceMotion: boolean;
  setReduceMotion: (reduceMotion: boolean) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

export const REDUCE_MOTION_STORAGE_KEY = 'lri:reduce-motion';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Browser storage can be unavailable (private windows, blocked site data), so
// every access is guarded and the setting falls back to the system preference.
function readStoredChoice(): boolean | null {
  try {
    const stored = window.localStorage.getItem(REDUCE_MOTION_STORAGE_KEY);
    return stored === null ? null : stored === 'true';
  } catch {
    return null;
  }
}

function storeChoice(reduceMotion: boolean): void {
  try {
    window.localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, String(reduceMotion));
  } catch {
    // The choice then lasts for the session only.
  }
}

const reducedMotionQuery = (): MediaQueryList | null =>
  typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null;

/**
 * Preferences set once for the whole application. "Reduce motion" follows the
 * system's `prefers-reduced-motion` until the user chooses in Settings; the
 * choice is kept in browser storage and overrides the system from then on.
 */
export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemReduceMotion, setSystemReduceMotion] = useState(() => reducedMotionQuery()?.matches ?? false);
  const [chosenReduceMotion, setChosenReduceMotion] = useState<boolean | null>(readStoredChoice);

  useEffect(() => {
    const query = reducedMotionQuery();
    if (!query) return;
    const onChange = (event: MediaQueryListEvent) => setSystemReduceMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setReduceMotion = useCallback((reduceMotion: boolean) => {
    setChosenReduceMotion(reduceMotion);
    storeChoice(reduceMotion);
  }, []);

  const value = useMemo(
    () => ({ reduceMotion: chosenReduceMotion ?? systemReduceMotion, setReduceMotion }),
    [chosenReduceMotion, systemReduceMotion, setReduceMotion]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = (): AppSettingsContextValue => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
};
