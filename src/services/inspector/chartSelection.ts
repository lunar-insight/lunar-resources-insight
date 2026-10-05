/**
 * Line colors of one unit chart. The order keeps neighboring slots
 * distinguishable for color blind readers; each clears 3:1 on the chart background.
 */
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

/** Layers one unit chart holds. */
export const MAX_CHART_LAYERS = SERIES_COLORS.length;

export interface ChartPick {
  lineId: string;
  unit: string;
  slot: number;
}

export interface ChartSelection {
  picks: ChartPick[];
  /** The unit chart shown. */
  unit: string;
}

export const picksIn = (selection: ChartSelection, unit: string) =>
  selection.picks.filter(pick => pick.unit === unit);

export const isUnitFull = (selection: ChartSelection, unit: string) =>
  picksIn(selection, unit).length >= MAX_CHART_LAYERS;

export const isPicked = (selection: ChartSelection, lineId: string) =>
  selection.picks.some(pick => pick.lineId === lineId);

export const colorOf = (selection: ChartSelection, lineId: string): string | undefined => {
  const pick = selection.picks.find(p => p.lineId === lineId);
  return pick ? SERIES_COLORS[pick.slot] : undefined;
};

/**
 * Adds a layer to its unit's chart and shows that chart, or removes it. An
 * added layer takes the first free color of its unit and keeps it until
 * removed, so removing one never repaints the others. A full chart takes no more.
 */
export function togglePick(selection: ChartSelection, lineId: string, unit: string): ChartSelection {
  if (isPicked(selection, lineId)) {
    return { ...selection, picks: selection.picks.filter(pick => pick.lineId !== lineId) };
  }
  if (isUnitFull(selection, unit)) return selection;

  const taken = new Set(picksIn(selection, unit).map(pick => pick.slot));
  const slot = SERIES_COLORS.findIndex((_, index) => !taken.has(index));
  return { unit, picks: [...selection.picks, { lineId, unit, slot }] };
}
