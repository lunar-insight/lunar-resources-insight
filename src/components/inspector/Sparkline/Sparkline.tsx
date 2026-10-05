import React from 'react';
import type { LayerStats } from 'services/LayerStatsService';
import styles from './Sparkline.module.scss';

export type SparkScale = 'moon' | 'own';

const WIDTH = 66;
const HEIGHT = 16;

/**
 * Vertical range of a sparkline. The Moon scale spans twice the layer's whole
 * Moon p15 to p85 width, centered on the line's average, so a flat layer draws
 * flat and rows compare. Own range, or a layer without statistics, fits the
 * line to its lowest and highest value.
 */
export function sparkRange(values: number[], scale: SparkScale, moon: LayerStats): [number, number] {
  const width = moon.loaded ? (moon.percentile_85 ?? NaN) - (moon.percentile_15 ?? NaN) : NaN;
  if (scale === 'moon' && Number.isFinite(width) && width > 0) {
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;
    return [average - width, average + width];
  }
  return [Math.min(...values), Math.max(...values)];
}

/** Path of a series, broken where a sample has no data. */
export function seriesPath(
  profile: (number | null)[],
  x: (index: number) => number,
  y: (value: number) => number,
): string {
  let path = '';
  let drawing = false;
  profile.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    path += `${drawing ? 'L' : 'M'}${x(index).toFixed(2)} ${y(value).toFixed(2)} `;
    drawing = true;
  });
  return path.trim();
}

interface SparklineProps {
  profile: (number | null)[];
  /** Position of each sample along the line, from 0 to 1. */
  fractions: number[];
  scale: SparkScale;
  moon: LayerStats;
  categoryRgb: string;
}

/** How a layer varies along a line, axis free, in a dark well. */
export const Sparkline: React.FC<SparklineProps> = ({ profile, fractions, scale, moon, categoryRgb }) => {
  const values = profile.filter((v): v is number => v !== null);
  if (values.length === 0) return <span className={styles.spark} aria-hidden="true" />;

  const [lo, hi] = sparkRange(values, scale, moon);
  const span = hi - lo || 1;
  const x = (index: number) => (fractions[index] ?? 0) * WIDTH;
  const y = (value: number) => HEIGHT - 1 - Math.min(1, Math.max(0, (value - lo) / span)) * (HEIGHT - 2);

  return (
    <svg className={styles.spark} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      <path
        d={seriesPath(profile, x, y)}
        fill="none"
        stroke={`rgb(${categoryRgb})`}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
