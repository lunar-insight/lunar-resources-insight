import React from 'react';
import { ToggleButton, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import { ValueBar } from 'components/inspector/ValueBar/ValueBar';
import { CoverageIcon, EmptySlot, SpreadIcon } from 'components/inspector/RowIcons/RowIcons';
import { Sparkline, type SparkScale } from 'components/inspector/Sparkline/Sparkline';
import { StatPopover } from 'components/inspector/StatPopover/StatPopover';
import { barView, CATEGORY_RGB, fullLineName } from 'components/inspector/lineView';
import { layerStatsService } from 'services/LayerStatsService';
import type { InspectorLine } from 'services/inspector/inspectorLayers';
import type { FeatureResults, LineResult } from 'services/inspector/InspectorStore';
import { formatValue, showsCoverage, spreadState } from 'services/inspector/inspectorStatistics';
import { MAX_CHART_LAYERS } from 'services/inspector/chartSelection';
import styles from './InspectorWindow.module.scss';

export interface ChartControl {
  color?: string;
  isFull: boolean;
  onToggle: () => void;
}

interface DatasetLineProps {
  line: InspectorLine;
  result: LineResult;
  results: FeatureResults;
  sparkScale: SparkScale;
  sparkFractions: number[];
  /** Chart button of a line feature's row, absent for a layer without a unit. */
  chart?: ChartControl;
}

const ChartButton: React.FC<{ line: InspectorLine; chart: ChartControl }> = ({ line, chart }) => {
  const picked = chart.color !== undefined;
  const disabled = !picked && chart.isFull;
  const tooltip = picked ? 'Remove from the chart'
    : disabled ? `The ${line.unit} chart holds ${MAX_CHART_LAYERS} layers. Remove one to add another.`
    : 'Show on the chart';
  return (
    <TooltipTrigger delay={400}>
      <ToggleButton
        isSelected={picked}
        isDisabled={disabled}
        onChange={chart.onToggle}
        aria-label={`${line.symbol} · ${line.datasetShort} on the chart`}
        className={styles.chartToggle}
        style={picked ? ({ '--series': chart.color } as React.CSSProperties) : undefined}
      >
        <span className="material-symbols-outlined" aria-hidden="true">show_chart</span>
      </ToggleButton>
      <ButtonTooltip placement="top">{tooltip}</ButtonTooltip>
    </TooltipTrigger>
  );
};

/** Dataset name, then the variant read when the layer has variants. */
export const DatasetName: React.FC<{ line: InspectorLine }> = ({ line }) => (
  <span className={styles.name} title={fullLineName(line)}>
    <span className={styles.dataset}>{line.datasetLabel}</span>
    {line.variantLabel && <span className={styles.variant}>{line.variantLabel}</span>}
  </span>
);

export const DatasetLine: React.FC<DatasetLineProps> = ({ line, result, results, sparkScale, sparkFractions, chart }) => {
  const moon = layerStatsService.getFileStats(result.file.filename);
  const categoryRgb = CATEGORY_RGB[line.category];
  const bar = barView(line, result, moon);
  const isShape = results.kind === 'shape';
  const isLine = results.kind === 'line';
  const hasValue = result.value !== undefined && !result.noData;

  let graphic: React.ReactNode = <ValueBar view={bar} categoryRgb={categoryRgb} />;
  if (isLine && hasValue && result.profile) {
    graphic = <Sparkline profile={result.profile} fractions={sparkFractions} scale={sparkScale} moon={moon} categoryRgb={categoryRgb} />;
  } else if (isShape) {
    const spread = hasValue && result.stats
      ? spreadState(result.stats, moon, results.areaKm2 ?? 0, result.resolutionKm)
      : null;
    const coverage = hasValue ? result.stats?.coverage : undefined;
    graphic = (
      <span className={styles.barSet}>
        {spread ? <SpreadIcon state={spread} line={line} /> : <EmptySlot />}
        {graphic}
        {showsCoverage(coverage) ? <CoverageIcon coverage={coverage} /> : <EmptySlot />}
      </span>
    );
  }

  let value: React.ReactNode = null;
  if (hasValue) {
    value = (
      <>
        {results.kind !== 'point' && <span className={styles.lead}>avg </span>}
        {formatValue(result.value!, line.decimals)}
        {line.unit && <span className={styles.unit}> {line.unit}</span>}
      </>
    );
  } else if (bar.kind === 'no-data') {
    value = (
      <StatPopover content={bar.popover} label="No data" className={styles.noDataText}>
        No data
      </StatPopover>
    );
  }

  return (
    <div className={`${styles.datasetLine} ${hasValue ? '' : styles.lineNoData}`} data-line={line.id}>
      {chart && hasValue ? <ChartButton line={line} chart={chart} /> : isLine && <span className={styles.chartSlot} />}
      <DatasetName line={line} />
      {graphic}
      <span className={styles.value}>{value}</span>
    </div>
  );
};
