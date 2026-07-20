// Shared naming convention for feature points saved from a typed coordinate,
// so the search UI and the drag-to-reposition rename logic stay in sync.

// Caps at 6 decimal places but drops trailing zeros, so a round input like
// "12.34" reads as "12.34°" instead of a padded "12.340000°".
export const formatDegrees = (value: number): string => Number(value.toFixed(6)).toString();

export const formatCoordinateFeatureName = (lon: number, lat: number): string =>
  `Lat ${formatDegrees(lat)}°, Lon ${formatDegrees(lon)}°`;

// Matches only names still in the auto-generated form above, so a feature the
// user has manually renamed is never silently overwritten by a later drag.
export const COORDINATE_FEATURE_NAME_PATTERN = /^Lat -?\d+(\.\d+)?°, Lon -?\d+(\.\d+)?°$/;
