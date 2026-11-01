import React from 'react';
import { ShapeHistogram } from 'components/inspector/ShapeHistogram/ShapeHistogram';
import { StatPopover } from 'components/inspector/StatPopover/StatPopover';
import {
  coveragePopover,
  coverageText,
  LIMIT_LABEL,
  limitPopover,
  spreadLabel,
  spreadPopover,
  type LimitState,
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

/** The spread bars, with a dot at the top left when the shape is skewed. */
export const SpreadGlyph: React.FC<{ word: SpreadWord; skewed?: boolean }> = ({ word, skewed = false }) => {
  const heights = SPREAD_BARS[word];
  const baseline = (14 + Math.max(...heights)) / 2;
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true" data-glyph={word}>
      {heights.map((height, i) => (
        <rect key={i} x={0.75 + i * 3.5} y={baseline - height} width={2} height={height} rx={0.5} fill="currentColor" />
      ))}
      {skewed && <circle className={styles.skewMark} cx={2.1} cy={2.1} r={2.1} data-mark="skew" />}
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

/** An arrow stopping at a ceiling (upper end) or a floor (lower end). */
export const LimitGlyph: React.FC<{ end: LimitState['end'] }> = ({ end }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true" data-glyph={`limit-${end}`}>
    <rect x={2} y={end === 'high' ? 1.25 : 11.25} width={10} height={1.5} rx={0.75} fill="currentColor" />
    <path
      d={end === 'high' ? 'M7 13 V5.2 M4.2 7.6 L7 4.6 L9.8 7.6' : 'M7 1 V8.8 M4.2 6.4 L7 9.4 L9.8 6.4'}
      fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

/** Keeps the width of an icon slot, so bars align on every line. */
export const EmptySlot: React.FC = () => <span className={styles.emptySlot} aria-hidden="true" />;

interface SpreadIconProps {
  state: SpreadState;
  line: Pick<InspectorLine, 'decimals' | 'unit'>;
  categoryColor: string;
}

export const SpreadIcon: React.FC<SpreadIconProps> = ({ state, line, categoryColor }) => {
  const label = spreadLabel(state);
  const chart = state.kind === 'spread' && state.histogram ? (
    <ShapeHistogram
      histogram={state.histogram}
      median={state.median}
      mean={state.mean}
      p15={state.p15}
      p85={state.p85}
      line={line}
      categoryColor={categoryColor}
    />
  ) : undefined;
  return (
    <StatPopover
      content={spreadPopover(state, line)}
      label={label}
      tooltip={label}
      chart={chart}
      className={`${styles.icon} ${state.kind === 'low-resolution' ? styles.muted : ''}`}
    >
      {state.kind === 'spread' ? <SpreadGlyph word={state.word} skewed={state.skew !== null} /> : <LowResolutionGlyph />}
    </StatPopover>
  );
};

export const LimitIcon: React.FC<{ state: LimitState; line: Pick<InspectorLine, 'decimals' | 'unit'> }> = ({ state, line }) => (
  <StatPopover
    content={limitPopover(state, line)}
    label={LIMIT_LABEL}
    tooltip={LIMIT_LABEL}
    className={`${styles.icon} ${styles.caveat}`}
  >
    <LimitGlyph end={state.end} />
  </StatPopover>
);

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
