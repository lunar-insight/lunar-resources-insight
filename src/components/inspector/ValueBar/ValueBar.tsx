import React from 'react';
import { StatPopover } from 'components/inspector/StatPopover/StatPopover';
import type { BarView } from 'components/inspector/lineView';
import styles from './ValueBar.module.scss';

const LABELS: Record<BarView['kind'], string> = {
  value: 'Bar scale',
  'no-data': 'No data',
  'no-scale': 'Scale unavailable',
  failed: 'Not computed',
};

/**
 * A single fill up to the value. No data is a hatched track, since an empty
 * track is a value of 0; a missing scale or value is one dash in the center.
 */
export const ValueBar: React.FC<{ view: BarView; categoryRgb: string }> = ({ view, categoryRgb }) => (
  <StatPopover
    content={view.popover}
    label={LABELS[view.kind]}
    className={styles.bar}
    style={{ '--cat': categoryRgb } as React.CSSProperties}
  >
    <span
      className={`${styles.track} ${view.kind === 'no-data' ? styles.noData : ''} ${view.kind === 'no-scale' || view.kind === 'failed' ? styles.dash : ''}`}
      data-state={view.kind}
    >
      {view.kind === 'value' && <span className={styles.fill} style={{ width: `${view.position * 100}%` }} />}
    </span>
  </StatPopover>
);
