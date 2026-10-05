import React from 'react';
import { StatPopover } from 'components/inspector/StatPopover/StatPopover';
import {
  coveragePopover,
  coverageText,
  spreadPopover,
  type SpreadState,
  type SpreadWord,
} from 'services/inspector/inspectorStatistics';
import type { InspectorLine } from 'services/inspector/inspectorLayers';
import styles from './RowIcons.module.scss';

// Bar heights on a common baseline: level, uneven, very uneven.
const SPREAD_BARS: Record<SpreadWord, number[]> = {
  Uniform: [7, 7, 7, 7],
  Variable: [5, 9, 6, 10],
  'Highly variable': [2, 11, 4, 12],
};

export const SpreadGlyph: React.FC<{ word: SpreadWord }> = ({ word }) => {
  const heights = SPREAD_BARS[word];
  const baseline = (14 + Math.max(...heights)) / 2;
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" data-glyph={word}>
      {heights.map((height, i) => (
        <rect key={i} x={0.75 + i * 3.5} y={baseline - height} width={2} height={height} rx={0.5} fill="currentColor" />
      ))}
    </svg>
  );
};

export const LowResolutionGlyph: React.FC = () => (
  <svg viewBox="0 0 14 14" aria-hidden="true" data-glyph="low-resolution">
    {[[1.5, 1.5], [8, 1.5], [1.5, 8], [8, 8]].map(([x, y]) => (
      <rect key={`${x}-${y}`} x={x} y={y} width={4.5} height={4.5} rx={0.5}
        fill="currentColor" fillOpacity={0.25} stroke="currentColor" strokeWidth={1} />
    ))}
  </svg>
);

/** A circle with a wedge from 12 o'clock, clockwise to the covered share. */
export const CoveragePie: React.FC<{ percent: number }> = ({ percent }) => {
  const share = Math.min(Math.max(percent, 0), 100) / 100;
  const angle = share * 2 * Math.PI;
  const x = 7 + 5.5 * Math.sin(angle);
  const y = 7 - 5.5 * Math.cos(angle);
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" data-glyph="coverage">
      <circle cx={7} cy={7} r={5.5} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeWidth={1} />
      {share > 0 && (
        <path d={`M7 7 L7 1.5 A5.5 5.5 0 ${share > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`} fill="currentColor" />
      )}
    </svg>
  );
};

/** Keeps the width of an icon slot, so bars align on every line. */
export const EmptySlot: React.FC = () => <span className={styles.emptySlot} aria-hidden="true" />;

export const SpreadIcon: React.FC<{ state: SpreadState; line: Pick<InspectorLine, 'decimals' | 'unit'> }> = ({ state, line }) => {
  const word = state.kind === 'spread' ? state.word : 'Low resolution';
  return (
    <StatPopover
      content={spreadPopover(state, line)}
      label={word}
      tooltip={word}
      className={`${styles.icon} ${state.kind === 'low-resolution' ? styles.muted : ''}`}
    >
      {state.kind === 'spread' ? <SpreadGlyph word={state.word} /> : <LowResolutionGlyph />}
    </StatPopover>
  );
};

export const CoverageIcon: React.FC<{ coverage: number; inComparison?: boolean }> = ({ coverage, inComparison = false }) => (
  <StatPopover
    content={coveragePopover(coverage, inComparison)}
    label={`Partial data, ${coverageText(coverage)}`}
    tooltip={`Partial data: ${coverageText(coverage)}`}
    className={`${styles.icon} ${styles.coverage}`}
  >
    <CoveragePie percent={coverage} />
  </StatPopover>
);
