/**
 * Data availability classification for lunar resources
 * - map+ground: Detectable from orbital instruments and confirmed in ground samples
 * - map: Detectable only from orbital remote sensing
 * - ground: Only detectable in returned lunar samples (ground truth)
 */
export type DataAvailability = 'map+ground' | 'ground' | 'map';
