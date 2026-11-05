import React from 'react';
import { StatPopover } from 'components/inspector/StatPopover/StatPopover';
import type { BarView } from 'components/inspector/lineView';
import styles from './ValueBar.module.scss';

/** No data takes its popover's title, which names why: "No data" or "No area". */
const LABELS: Record<Exclude<BarView['kind'], 'no-data'>, string> = {
  value: 'Bar scale',
  'no-scale': 'Scale unavailable',
  failed: 'Not computed',
};

interface ValueBarProps {
  view: BarView;
  categoryColor: string;
  /** Shown in the popover, below its title. */
  chart?: React.ReactNode;
  /** Shown last in the popover. */
  footer?: React.ReactNode;
}

/**
 * A single fill up to the value. No data is a hatched track, since an empty
 * track is a value of 0; a missing scale or value is one dash in the center.
 */
export const ValueBar: React.FC<ValueBarProps> = ({ view, categoryColor, chart, footer }) => (
  <StatPopover
    content={view.popover}
    label={view.kind === 'no-data' ? view.popover.title : LABELS[view.kind]}
    chart={chart}
    footer={footer}
    className={styles.bar}
    style={{ '--cat': categoryColor } as React.CSSProperties}
  >
    <span
      className={`${styles.track} ${view.kind === 'no-data' ? styles.noData : ''} ${view.kind === 'no-scale' || view.kind === 'failed' ? styles.dash : ''}`}
      data-state={view.kind}
    >
      {view.kind === 'value' && <span className={styles.fill} style={{ width: `${view.position * 100}%` }} />}
    </span>
  </StatPopover>
);
