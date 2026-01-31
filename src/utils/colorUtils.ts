import * as Cesium from 'cesium';

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
