import type { LayerConfig, LayersConfig } from 'types/layers';
import { layersConfig } from '../../layersConfig';
import {
  COMPOUND_REFERENCE_RANGES,
  ELEMENT_REFERENCE_RANGES,
  MINERAL_REFERENCE_RANGES,
} from 'constants/elementReferenceRanges';
import { layerSymbol, layerSymbolName } from 'utils/layerSymbols';
import { DERIVED_INDEX_BY_LAYER_ID } from 'components/navigation/submenu/DerivedIndices/data';

export type InspectorCategory = 'chemical' | 'compound' | 'mineral' | 'derived-index';

export const INSPECTOR_CATEGORIES: { category: InspectorCategory; label: string }[] = [
  { category: 'chemical', label: 'Chemical Elements' },
  { category: 'compound', label: 'Compounds' },
  { category: 'mineral', label: 'Minerals' },
  { category: 'derived-index', label: 'Derived Indices' },
];

/** A file an Inspector line reads. A polar pair holds one file per side of the Moon. */
export interface LineFile {
  layerId: string;
  filename: string;
  stac?: string;
  side?: 'north' | 'south';
}

export interface InspectorLine {
  /** The layer id, or the pair id for a polar pair. */
  id: string;
  symbol: string;
  cardName: string;
  category: InspectorCategory;
  datasetLabel: string;
  datasetShort: string;
  /** Label of the variant read, for a layer with variants. */
  variantLabel?: string;
  unit?: string;
  decimals: number;
  referenceRange?: { min: number; max: number };
  /** What low and high values mean, for a derived index. */
  scaleLabels?: { low: string; high: string };
  files: LineFile[];
}

export interface InspectorCard {
  symbol: string;
  name: string;
  category: InspectorCategory;
  lines: InspectorLine[];
}

export interface InspectorGroup {
  category: InspectorCategory;
  label: string;
  cards: InspectorCard[];
}

const isInspectorCategory = (category: string): category is InspectorCategory =>
  INSPECTOR_CATEGORIES.some(entry => entry.category === category);

/** Unit as the Inspector shows and groups it: wt%, ppm or index. */
export function displayUnit(config: LayerConfig): string | undefined {
  if (config.category === 'derived-index') return 'index';
  if (config.units?.startsWith('wt%')) return 'wt%';
  return config.units;
}

function referenceRangeOf(layerId: string, config: LayerConfig): { min: number; max: number } | undefined {
  if (config.category === 'derived-index') {
    const index = DERIVED_INDEX_BY_LAYER_ID[layerId];
    return index ? { min: index.range[0], max: index.range[1] } : undefined;
  }
  const range =
    config.category === 'compound' && config.compound ? COMPOUND_REFERENCE_RANGES[config.compound]
    : config.category === 'mineral' && config.mineral ? MINERAL_REFERENCE_RANGES[config.mineral]
    : config.category === 'chemical' && config.element ? ELEMENT_REFERENCE_RANGES[config.element]
    : undefined;
  return range ? { min: range.min, max: range.max } : undefined;
}

function scaleLabelsOf(layerId: string, config: LayerConfig): { low: string; high: string } | undefined {
  const index = config.category === 'derived-index' ? DERIVED_INDEX_BY_LAYER_ID[layerId] : undefined;
  return index ? { low: index.lowLabel, high: index.highLabel } : undefined;
}

// Every request reads the first variant, the finest, whatever the map shows.
function fileOf(layerId: string, config: LayerConfig): LineFile {
  const variant = config.variants?.[0];
  return {
    layerId,
    filename: variant?.filename ?? config.filename,
    stac: variant?.stac ?? config.stac,
  };
}

const sideOf = (layerId: string): 'north' | 'south' | undefined =>
  /north/.test(layerId) ? 'north' : /south/.test(layerId) ? 'south' : undefined;

/**
 * One line per dataset reporting a resource, in config order. Count rate layers
 * have no line, and the two files of a polar pair form one line.
 */
export function buildInspectorLines(config: LayersConfig = layersConfig): InspectorLine[] {
  const lines: InspectorLine[] = [];
  const pairs = new Map<string, InspectorLine>();

  Object.entries(config.layers).forEach(([layerId, layer]) => {
    if (!isInspectorCategory(layer.category) || layer.units === 'count_rate') return;
    if (layer.available === false || layer.layerType === 'vector') return;

    const file = fileOf(layerId, layer);

    if (layer.inspectorPair) {
      const existing = pairs.get(layer.inspectorPair);
      if (existing) {
        existing.files.push({ ...file, side: sideOf(layerId) });
        return;
      }
    }

    const line: InspectorLine = {
      id: layer.inspectorPair ?? layerId,
      symbol: layerSymbol(layerId, layer),
      cardName: layerSymbolName(layerId, layer),
      category: layer.category,
      datasetLabel: layer.datasetLabel ?? layer.displayName ?? layerId,
      datasetShort: layer.datasetShort ?? layer.datasetLabel ?? layerId,
      variantLabel: layer.variants?.[0]?.label,
      unit: displayUnit(layer),
      decimals: layer.decimals ?? 2,
      referenceRange: referenceRangeOf(layerId, layer),
      scaleLabels: scaleLabelsOf(layerId, layer),
      files: [layer.inspectorPair ? { ...file, side: sideOf(layerId) } : file],
    };
    if (layer.inspectorPair) pairs.set(layer.inspectorPair, line);
    lines.push(line);
  });

  return lines;
}

/** Cards by category, then by symbol, in the order lines are given. */
export function groupInspectorLines(lines: InspectorLine[]): InspectorGroup[] {
  return INSPECTOR_CATEGORIES.map(({ category, label }) => {
    const cards = new Map<string, InspectorCard>();
    lines.filter(line => line.category === category).forEach(line => {
      const card = cards.get(line.symbol);
      if (card) card.lines.push(line);
      else cards.set(line.symbol, { symbol: line.symbol, name: line.cardName, category, lines: [line] });
    });
    return { category, label, cards: [...cards.values()] };
  }).filter(group => group.cards.length > 0);
}

/**
 * Case insensitive. A match on a card's symbol or name keeps the whole card; a
 * match on a dataset or variant keeps the card with the matching lines only.
 * A group without lines left is dropped.
 */
export function filterGroups(groups: InspectorGroup[], query: string): InspectorGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;
  const matches = (text?: string) => !!text && text.toLowerCase().includes(needle);

  return groups
    .map(group => ({
      ...group,
      cards: group.cards
        .map(card => (matches(card.symbol) || matches(card.name)
          ? card
          : { ...card, lines: card.lines.filter(line => matches(line.datasetLabel) || matches(line.variantLabel)) }))
        .filter(card => card.lines.length > 0),
    }))
    .filter(group => group.cards.length > 0);
}

export const lineCount = (group: InspectorGroup) =>
  group.cards.reduce((count, card) => count + card.lines.length, 0);

/**
 * The file a line reads for a feature centered at this latitude. A polar pair
 * reads the north file from 0° up, the south file below.
 */
export function fileForLatitude(line: InspectorLine, latitudeDeg: number): LineFile {
  if (line.files.length === 1) return line.files[0];
  const side = latitudeDeg >= 0 ? 'north' : 'south';
  return line.files.find(file => file.side === side) ?? line.files[0];
}

/** Every file the Inspector may read, for statistics and bounds. */
export function allLineFiles(lines: InspectorLine[]): LineFile[] {
  return lines.flatMap(line => line.files);
}

export const inspectorLines = buildInspectorLines();
export const inspectorGroups = groupInspectorLines(inspectorLines);
