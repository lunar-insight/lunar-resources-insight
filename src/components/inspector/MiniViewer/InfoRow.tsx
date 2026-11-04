import React from 'react';
import styles from './MiniViewer.module.scss';

/** One line under the picture, empty without a picture, so the popover keeps its size. */
export const InfoRow: React.FC<{ swatch?: string; children?: React.ReactNode }> = ({ swatch, children }) => (
  <div className={styles.info}>
    {swatch && <i className={styles.infoSwatch} style={{ background: swatch }} />}
    {children && <span className={styles.infoText}>{children}</span>}
  </div>
);
