import * as Cesium from 'cesium';
import { elements, lanthanides, actinides } from 'constants/periodicTableData';
import { layersConfig } from 'geoConfigExporter';

/**
 * Extracts RGBA components from a HEXA color string
 * @param hexaColor - Color in HEXA format (#RRGGBBAA or #RRGGBB)
 * @returns Object with r, g, b (0-255), and a (0-1)
 */
function hexaToRgba(hexaColor: string): { r: number; g: number; b: number; a: number } {
  // Remove # if present
  const hex = hexaColor.startsWith('#') ? hexaColor.slice(1) : hexaColor;

  // Parse RGB components
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Parse alpha component (default to 255 if not provided)
  const alphaHex = hex.length === 8 ? hex.slice(6, 8) : 'FF';
  const alpha = parseInt(alphaHex, 16) / 255; // Normalize to 0-1

  return { r, g, b, a: alpha };
}

/**
 * Converts a HEXA color string to a Cesium Color object
 * @param hexaColor - Color in HEXA format (#RRGGBBAA or #RRGGBB)
 * @returns Cesium Color object
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

const ELEMENT_SYMBOLS: Record<string, string> = {
  aluminium: 'Al', calcium:   'Ca', gadolinium: 'Gd', helium:    'He',
  hydrogen:  'H',  iron:      'Fe', magnesium:  'Mg', oxygen:    'O',
  polonium:  'Po', potassium: 'K',  radon:      'Rn', samarium:  'Sm',
  silicon:   'Si', sodium:    'Na', thorium:    'Th', titanium:  'Ti',
  uranium:   'U',
};

const GOLDEN_ANGLE = 137.5;

const allElementsByAtomicNumber = new Map<string, number>(
  [...elements, ...lanthanides, ...actinides].map(el => [el.name.toLowerCase(), el.atomicNumber])
);

const configuredElementNames = new Set<string>();
Object.values(layersConfig.layers).forEach(layer => {
  if (layer.category === 'chemical' && layer.element) {
    configuredElementNames.add(layer.element.toLowerCase());
  }
});

const elementColorIndexMap = new Map<string, number>(
  [...configuredElementNames]
    .map(name => ({ name, atomicNumber: allElementsByAtomicNumber.get(name) ?? Infinity }))
    .sort((a, b) => a.atomicNumber - b.atomicNumber)
    .map((el, i) => [el.name, i])
);

export function elementToAccentColor(elementName: string): string {
  const name = elementName.toLowerCase();
  const index = elementColorIndexMap.get(name);

  const hue =
    index !== undefined
      ? Math.round((index * GOLDEN_ANGLE) % 360)
      : djb2Hash(name) % 360;

  return `hsl(${hue}, 70%, 62%)`;
}

export function elementToSymbol(elementName: string): string {
  const name = elementName.toLowerCase();
  return ELEMENT_SYMBOLS[name]
    ?? (name.length > 1 ? name[0].toUpperCase() + name[1] : name[0].toUpperCase());
}

export function hexaToCesiumColor(hexaColor: string): Cesium.Color {
  try {
    const { r, g, b, a } = hexaToRgba(hexaColor);

    // Validate parsed values
    if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) {
      console.warn(`Invalid color format: ${hexaColor}, falling back to cyan`);
      return Cesium.Color.CYAN;
    }

    // Normalize RGB from 0-255 to 0-1 for Cesium
    return new Cesium.Color(r / 255, g / 255, b / 255, a);
  } catch (error) {
    console.error(`Error parsing color ${hexaColor}:`, error);
    // Fallback to cyan for invalid colors
    return Cesium.Color.CYAN;
  }
}
