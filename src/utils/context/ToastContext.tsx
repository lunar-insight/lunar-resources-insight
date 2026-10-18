import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface Toast {
  /** A Material Symbols icon name. */
  icon: string;
  message: string;
  /** Shown after the message in a monospace font, such as a copied value. */
  detail?: string;
}

export interface ShownToast extends Toast {
  /** Changes with every toast, so a new toast restarts its animation. */
  key: number;
  leaving: boolean;
}

interface ToastContextValue {
  toast: ShownToast | null;
  showToast: (toast: Toast) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** How long a toast stays, then how long it takes to fade out, in milliseconds. */
export const TOAST_DURATION = 1800;
export const TOAST_EXIT_DURATION = 250;

/** One short confirmation at a time, replacing the previous one. */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ShownToast | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const nextKeyRef = useRef(1);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => clearTimers, []);

  const showToast = useCallback((next: Toast) => {
    clearTimers();
    setToast({ ...next, key: nextKeyRef.current++, leaving: false });
    timersRef.current = [
      setTimeout(() => setToast(current => current && { ...current, leaving: true }), TOAST_DURATION),
      setTimeout(() => setToast(null), TOAST_DURATION + TOAST_EXIT_DURATION),
    ];
  }, []);

  const value = useMemo(() => ({ toast, showToast }), [toast, showToast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
