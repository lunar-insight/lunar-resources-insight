import React from 'react';
import { Button, ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import type { InspectorLine } from 'services/inspector/inspectorLayers';
import type { FeatureResults } from 'services/inspector/InspectorStore';
import { formatValue } from 'services/inspector/inspectorStatistics';
import { colorOf, isUnitFull, picksIn, type ChartSelection } from 'services/inspector/chartSelection';
import { seriesPath } from 'components/inspector/Sparkline/Sparkline';
import styles from './ProfileChart.module.scss';

const WIDTH = 340;
const HEIGHT = 116;
const PAD = 4;
const GRID = [0, 0.25, 0.5, 0.75, 1];

interface ProfileChartProps {
  lines: InspectorLine[];
  results: FeatureResults;
  selection: ChartSelection;
  units: string[];
  lengthKm: number;
  onSelectUnit: (unit: string) => void;
  onTogglePick: (line: InspectorLine) => void;
}

/** One chart per unit, so layers sharing a unit share a real axis. */
export const ProfileChart: React.FC<ProfileChartProps> = ({
  lines, results, selection, units, lengthKm, onSelectUnit, onTogglePick,
}) => {
  const unit = selection.unit;
  const byId = new Map(lines.map(line => [line.id, line]));
  const series = picksIn(selection, unit)
    .map(pick => ({ line: byId.get(pick.lineId)!, profile: results.lines[pick.lineId]?.profile ?? [] }))
    .filter(entry => entry.line);

  const values = series.flatMap(entry => entry.profile.filter((v): v is number => v !== null));
  const hasValues = values.length > 0;
  let lo = hasValues ? Math.min(...values) : 0;
  let hi = hasValues ? Math.max(...values) : 1;
  if (lo === hi) { lo -= 1; hi += 1; }

  // Samples sit at their distance along the line; vertices break the even spacing.
  const samples = results.samples ?? [];
  const x = (index: number) => (lengthKm > 0 ? ((samples[index]?.distanceKm ?? 0) / lengthKm) * WIDTH : 0);
  const y = (value: number) => PAD + (1 - (value - lo) / (hi - lo)) * (HEIGHT - 2 * PAD);
  const decimals = series[0]?.line.decimals ?? 1;

  return (
    <div className={styles.chartBlock}>
      <div className={styles.head}>
        <span className={styles.label}>Profile along the line</span>
        <ToggleButtonGroup
          aria-label="Unit chart"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[unit]}
          onSelectionChange={keys => {
            const [next] = [...keys];
            if (next !== undefined) onSelectUnit(String(next));
          }}
          className={styles.tabs}
        >
          {units.map(u => {
            const picked = picksIn(selection, u).length;
            return (
              <ToggleButton key={u} id={u} className={styles.tab} aria-label={picked ? `${u}, ${picked} picked` : u}>
                {u}
                {picked > 0 && <span className={styles.count}>{picked}</span>}
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>
      </div>

      <div className={styles.wrap}>
        <div className={styles.yAxis} aria-hidden="true">
          {series.length > 0 && hasValues && [...GRID].reverse().map(g => (
            <span key={g}>{formatValue(lo + (hi - lo) * g, decimals)}</span>
          ))}
        </div>
        <div className={styles.plot}>
          <svg className={styles.chart} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img"
            aria-label={series.length ? `${unit} profile of ${series.map(s => s.line.symbol).join(', ')}` : `Empty ${unit} profile`}>
            {GRID.map(g => {
              const gy = PAD + (1 - g) * (HEIGHT - 2 * PAD);
              return <line key={g} x1={0} y1={gy} x2={WIDTH} y2={gy} className={styles.grid} vectorEffect="non-scaling-stroke" />;
            })}
            {series.map(({ line, profile }) => (
              <path key={line.id} d={seriesPath(profile, x, y)} fill="none" stroke={colorOf(selection, line.id)}
                strokeWidth={1.5} vectorEffect="non-scaling-stroke" data-line={line.id} />
            ))}
          </svg>
          {series.length === 0 && (
            <span className={styles.empty}>Pick a {unit} layer with the chart button on its row.</span>
          )}
        </div>
      </div>

      <div className={styles.xAxis}>
        <span>0 km</span>
        <span>{unit}</span>
        <span>{Math.round(lengthKm).toLocaleString('en-US')} km</span>
      </div>

      <div className={styles.legend}>
        {series.map(({ line }) => (
          <Button key={line.id} className={styles.key} onPress={() => onTogglePick(line)}
            aria-label={`Remove ${line.symbol} · ${line.datasetShort} from the chart`}>
            <span className={styles.dot} style={{ background: colorOf(selection, line.id) }} />
            {line.symbol} · {line.datasetShort}
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </Button>
        ))}
        {isUnitFull(selection, unit) && <span className={styles.full}>Chart full: remove a layer to add another.</span>}
      </div>
    </div>
  );
};
