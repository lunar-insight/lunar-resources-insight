import React from 'react';
import type { InspectorLine } from 'services/inspector/inspectorLayers';
import { binText, formatValue, histogramBins, type Histogram, type HistogramBin } from 'services/inspector/inspectorStatistics';
import styles from './ShapeHistogram.module.scss';

const WIDTH = 210;
const HEIGHT = 46;
const GAP = 2;
const RADIUS = 1.5;

/** A bar with rounded top corners, standing on the axis. */
export function barPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height);
  return `M${x} ${y + height}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + width - r}Q${x + width} ${y} ${x + width} ${y + r}V${y + height}Z`;
}

const KeyLine: React.FC<{ dashed?: boolean }> = ({ dashed = false }) => (
  <svg viewBox="0 0 10 10" aria-hidden="true">
    <line className={styles.mark} x1={5} x2={5} y1={0} y2={10} strokeDasharray={dashed ? '2 1.5' : undefined} />
  </svg>
);

interface ShapeHistogramProps {
  histogram: Histogram;
  median: number;
  mean: number;
  p15: number;
  p85: number;
  line: Pick<InspectorLine, 'decimals' | 'unit'>;
  categoryColor: string;
  /** The bin under the pointer, or null when it leaves. */
  onBinHover?: (bin: HistogramBin | null) => void;
  /** Values lit on the picture. Bars inside them stand out, the others recede. */
  highlight?: [number, number] | null;
}

/**
 * The shape's pixels in bins from its lowest to highest value, with the Most
 * range shaded, the median as a solid line and the average as a dashed one.
 */
export const ShapeHistogram: React.FC<ShapeHistogramProps> = ({
  histogram, median, mean, p15, p85, line, categoryColor, onBinHover, highlight,
}) => {
  const bins = histogramBins(histogram);
  const lo = histogram.edges[0];
  const hi = histogram.edges[histogram.edges.length - 1];
  const x = (value: number) => Math.min(1, Math.max(0, (value - lo) / (hi - lo))) * WIDTH;
  const step = WIDTH / bins.length;
  const peak = Math.max(...bins.map(bin => bin.share));

  return (
    <div className={styles.histogram} style={{ '--cat': categoryColor } as React.CSSProperties}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT + 1}`} role="img" aria-label="Histogram of pixel values">
        <rect className={styles.most} x={x(p15)} y={0} width={x(p85) - x(p15)} height={HEIGHT} />
        {bins.map((bin, i) => {
          const height = bin.share > 0 ? Math.max((bin.share / peak) * (HEIGHT - 4), 1) : 0;
          const lit = highlight ? (bin.from >= highlight[0] && bin.to <= highlight[1] ? styles.hot : styles.cold) : '';
          return (
            <g key={i} data-bin={i} onMouseEnter={() => onBinHover?.(bin)} onMouseLeave={() => onBinHover?.(null)}>
              <title>{binText(bin, line)}</title>
              {/* The full column takes the hover, so a short bar is as easy to point at as a tall one */}
              <rect className={styles.hit} x={i * step} y={0} width={step} height={HEIGHT} />
              {height > 0 && <path className={`${styles.bar} ${lit}`} d={barPath(i * step + GAP / 2, HEIGHT - height, step - GAP, height)} />}
            </g>
          );
        })}
        <line className={styles.axis} x1={0} x2={WIDTH} y1={HEIGHT + 0.5} y2={HEIGHT + 0.5} />
        <line className={styles.mark} x1={x(median)} x2={x(median)} y1={-2} y2={HEIGHT} data-mark="median" />
        <line className={styles.mark} x1={x(mean)} x2={x(mean)} y1={-2} y2={HEIGHT} strokeDasharray="3 2" data-mark="mean" />
      </svg>
      <div className={styles.ends}>
        <span>{formatValue(lo, line.decimals)}</span>
        <span>{formatValue(hi, line.decimals)}</span>
      </div>
      <div className={styles.key}>
        <span><KeyLine />Median</span>
        <span><KeyLine dashed />Average</span>
      </div>
    </div>
  );
};
