export interface ParsedCoordinate {
  lat: number;
  lon: number;
  altitude?: number;
}

// Matches "lat, lon" or "lat, lon, altitude" decimal degree/meter triples,
// e.g. "12.34, -56.78" or "12.34, -56.78, 50000"
const COORDINATE_PATTERN =
  /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*(?:[,\s]\s*(-?\d+(?:\.\d+)?)\s*)?$/;

// Cesium's camera math (normalizing vectors relative to the ellipsoid) breaks
// down with a "normalized result is not a number" error at extreme altitudes,
// so cap it well below there.
const MAX_ALTITUDE_METERS = 100_000_000;

/**
 * Parses free text as a "latitude, longitude[, altitude]" input.
 * Altitude (meters) is optional; when omitted the caller should fall back
 * to the current camera height. Returns null if the text doesn't parse or
 * any value is out of range.
 */
export const parseCoordinateInput = (text: string): ParsedCoordinate | null => {
  const match = COORDINATE_PATTERN.exec(text);
  if (!match) return null;

  const lat = parseFloat(match[1]);
  const lon = parseFloat(match[2]);
  const altitude = match[3] !== undefined ? parseFloat(match[3]) : undefined;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lon) || lon < -180 || lon > 360) return null;
  if (altitude !== undefined && (!Number.isFinite(altitude) || altitude < 0 || altitude > MAX_ALTITUDE_METERS)) {
    return null;
  }

  return altitude !== undefined ? { lat, lon, altitude } : { lat, lon };
};
