import React from 'react';
import { useToast } from 'utils/context/ToastContext';
import { useAppSettings } from 'utils/context/AppSettingsContext';
import styles from './ToastRegion.module.scss';

/**
 * Shows the current toast at the bottom of the globe view. The region stays
 * mounted, so screen readers announce each toast placed in it. Must be
 * mounted inside .viewerContainer.
 */
const ToastRegion: React.FC = () => {
  const { toast } = useToast();
  const { reduceMotion } = useAppSettings();

  return (
    <div role="status" aria-live="polite" className={styles.region}>
      {toast && (
        <div
          key={toast.key}
          className={styles.toast}
          data-leaving={toast.leaving || undefined}
          data-reduce-motion={reduceMotion || undefined}
        >
          <span className="material-symbols-outlined" aria-hidden="true">{toast.icon}</span>
          <span>{toast.message}</span>
          {toast.detail && <span className={styles.detail}>{toast.detail}</span>}
        </div>
      )}
    </div>
  );
};

export default ToastRegion;
