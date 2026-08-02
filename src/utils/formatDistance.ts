// Formats a distance in meters as a short human-readable string, switching to
// kilometers once the value would otherwise show four or more integer digits.
export const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(1)} m`;
};
