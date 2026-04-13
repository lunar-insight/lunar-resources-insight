/**
 * Data availability classification for lunar resources
 * - map+ground: Both a raster and a point layer are available
 * - map: Raster layer (COG, served via TiTiler)
 * - ground:  Vector point layer (discrete sample/measurement locations)
 */
export type DataAvailability = 'map+ground' | 'ground' | 'map';
