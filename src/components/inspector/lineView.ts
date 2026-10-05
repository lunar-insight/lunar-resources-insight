import type { LayerStats } from 'services/LayerStatsService';
import type { InspectorCategory, InspectorLine } from 'services/inspector/inspectorLayers';
import type { LineResult } from 'services/inspector/InspectorStore';
import {
  barPopover,
  barPosition,
  barScale,
  noDataPopover,
  type PopoverContent,
} from 'services/inspector/inspectorStatistics';

export const CATEGORY_RGB: Record<InspectorCategory, string> = {
  chemical: 'var(--color-category-chemical-rgb)',
  compound: 'var(--color-category-compound-rgb)',
  mineral: 'var(--color-category-mineral-rgb)',
  'derived-index': 'var(--color-category-derived-index-rgb)',
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
  if (result.failed || (result.value === undefined && !result.noData)) {
    return { kind: 'failed', popover: FAILED_POPOVER };
  }
  if (result.noData || result.value === undefined) {
    return { kind: 'no-data', popover: noDataPopover(result.noData ?? 'inside', result.extent) };
  }
  const scale = barScale(line, moon);
  if (scale.kind === 'none') return { kind: 'no-scale', popover: barPopover(scale, result.value, line) };
  return { kind: 'value', position: barPosition(scale, result.value), popover: barPopover(scale, result.value, line) };
}

/** Hover text of a line: symbol name, dataset and variant. */
export const fullLineName = (line: InspectorLine) =>
  [line.cardName, line.datasetLabel, line.variantLabel].filter(Boolean).join(' · ');
