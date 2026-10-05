import type { LayerConfig } from 'types/layers';
import { elements, lanthanides, actinides } from 'constants/periodicTableData';
import {
  COMPOUND_NAMES,
  COMPOUND_SYMBOLS,
  MINERAL_NAMES,
  MINERAL_SYMBOLS,
} from 'constants/elementReferenceRanges';
import { DERIVED_INDICES } from 'components/navigation/submenu/DerivedIndices/data';

// Displayed element names follow IUPAC; the data keeps the spelling it is matched by.
const IUPAC_ELEMENT_NAMES: Record<string, string> = {
  aluminum: 'Aluminium',
  cesium: 'Caesium',
};

const ALL_ELEMENTS = [...elements, ...lanthanides, ...actinides];

const findElement = (elementName: string) =>
  ALL_ELEMENTS.find(el => el.name.toLowerCase() === elementName.toLowerCase());

export function getElementSymbol(elementName: string): string {
  const element = findElement(elementName);
  return element?.symbol || elementName.toUpperCase().substring(0, 2);
}

export function getCompoundSymbol(compoundName: string): string {
  return COMPOUND_SYMBOLS[compoundName] ?? compoundName.substring(0, 3).toUpperCase();
}

export function getMineralSymbol(mineralName: string): string {
  return MINERAL_SYMBOLS[mineralName] ?? mineralName.substring(0, 3);
}

export function elementDisplayName(elementName: string): string {
  const key = elementName.toLowerCase();
  if (IUPAC_ELEMENT_NAMES[key]) return IUPAC_ELEMENT_NAMES[key];
  return findElement(key)?.name ?? elementName;
}

function derivedIndexOf(layerId: string) {
  return DERIVED_INDICES.find(index => index.layerId === layerId);
}

/** Symbol shown for a layer: element, compound, mineral or derived index. */
export function layerSymbol(layerId: string, config: LayerConfig): string {
  if (config.category === 'compound' && config.compound) return getCompoundSymbol(config.compound);
  if (config.category === 'mineral' && config.mineral) return getMineralSymbol(config.mineral);
  if (config.category === 'derived-index') return derivedIndexOf(layerId)?.symbol ?? layerId;
  if (config.element) return getElementSymbol(config.element);
  return layerId;
}

/** Name shown beside a layer's symbol. */
export function layerSymbolName(layerId: string, config: LayerConfig): string {
  if (config.category === 'compound' && config.compound) return COMPOUND_NAMES[config.compound] ?? config.compound;
  if (config.category === 'mineral' && config.mineral) return MINERAL_NAMES[config.mineral] ?? config.mineral;
  if (config.category === 'derived-index') return derivedIndexOf(layerId)?.name ?? layerId;
  if (config.element) return elementDisplayName(config.element);
  return layerId;
}
