import type { LayerStats } from 'services/LayerStatsService';
import type { InspectorCategory, InspectorLine } from 'services/inspector/inspectorLayers';
import type { FeatureResults, LineResult } from 'services/inspector/InspectorStore';
import {
  barPopover,
  barPosition,
  barScale,
  limitState,
  noDataPopover,
  type LimitState,
  type PopoverContent,
} from 'services/inspector/inspectorStatistics';

/** Category colors in the Inspector. Chemical takes the lighter violet that reads on the dark wells. */
export const CATEGORY_COLOR: Record<InspectorCategory, string> = {
  chemical: 'var(--category-chemical-on-dark)',
  compound: 'var(--category-compound)',
  mineral: 'var(--category-mineral)',
  'derived-index': 'var(--category-derived-index)',
};

export type BarView =
  | { kind: 'value'; position: number; popover: PopoverContent }
  | { kind: 'no-data'; popover: PopoverContent }
  /** No reference range and no whole Moon statistics: a center dash. */
  | { kind: 'no-scale'; popover: PopoverContent }
  | { kind: 'failed'; popover: PopoverContent };

const FAILED_POPOVER: PopoverContent = {
  title: 'Not computed',
  lines: [],
  sentence: 'The request for this value failed.',
};

export function barView(line: InspectorLine, result: LineResult, moon: LayerStats): BarView {
  if (result.failed) return { kind: 'failed', popover: FAILED_POPOVER };
  if (result.noData) return { kind: 'no-data', popover: noDataPopover(result.noData, result.extent) };
  if (result.value === undefined) return { kind: 'failed', popover: FAILED_POPOVER };
  const scale = barScale(line, moon);
  if (scale.kind === 'none') return { kind: 'no-scale', popover: barPopover(scale, result.value, line) };
  return { kind: 'value', position: barPosition(scale, result.value), popover: barPopover(scale, result.value, line) };
}

/** The limit mark of a point's line, or null. */
export function pointLimit(result: LineResult, results: FeatureResults): LimitState | null {
  if (results.kind !== 'point' || !results.center || result.value === undefined || result.noData) return null;
  return limitState(result.value, result.clip, results.center.lon);
}

/** Hover text of a line: symbol name, dataset and variant. */
export const fullLineName = (line: InspectorLine) =>
  [line.cardName, line.datasetLabel, line.variantLabel].filter(Boolean).join(' · ');
