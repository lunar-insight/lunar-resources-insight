export const mapServerUrl = import.meta.env.VITE_SERVER_URL;
export const workspacePath = import.meta.env.VITE_WORKSPACE_PATH;

export const tilerEndpoints = {
  tiles: `${mapServerUrl}/cog/tiles/MoonGeographicSphere/{z}/{x}/{y}`,
  tilejson: `${mapServerUrl}/cog/MoonGeographicSphere/tilejson.json`,
  stacPoint: `${mapServerUrl}/stac/point/{lon},{lat}`,
  info: `${mapServerUrl}/cog/info`,
  statistics: `${mapServerUrl}/cog/statistics`,
  preview: `${mapServerUrl}/cog/preview`,
  colorMap: `${mapServerUrl}/colorMaps/{colormap}`
};

// The point index, a STAC item holding every raster as an asset, read by the
// tiler from its own mount. scripts/generate-point-index.mjs writes it.
export const pointIndexItemPath = `${workspacePath}/index/point-index.json`;

// The asset keys that item holds, served by the proxy from the same directory.
export const pointIndexAssetsUrl = `${mapServerUrl}/point-index/assets.json`;

if (mapServerUrl === undefined) {
  throw new Error('VITE_SERVER_URL is not defined in environment variables.');
}

if (!workspacePath) {
  throw new Error('VITE_WORKSPACE_PATH is not defined in environment variables.');
}

export type { LayerVariant, LayerConfig, LayersConfig } from './types/layers';

export interface CogBandStatistics {
  min: number;
  max: number;
  mean: number;
  std: number;
  median: number;
  count: number;
  sum: number;
  histogram: [number[], number[]]; // [counts, bins]
  percentile_2: number;
  percentile_15: number;
  percentile_85: number;
  percentile_95: number;
  percentile_98: number;
  majority: number;
  minority: number;
  unique: number;
  valid_percent: number;
  masked_pixels: number;
  valid_pixels: number;
}

export interface CogStatistics {
  // Band support
  b1?: CogBandStatistics;
  b2?: CogBandStatistics;
  b3?: CogBandStatistics;
  
  // Fallback for compatibility)
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  median?: number;
  histogram?: [number[], number[]];
}

import { layersConfig } from './layersConfig';
export { layersConfig };

export function getLayersByCompound(compoundId: string): string[] {
  return Object.entries(layersConfig.layers)
    .filter(([, config]) => config.compound === compoundId)
    .map(([id]) => id);
}

export function buildCogTileUrl(filename: string, options: {
  colormap?: string;
  rescale?: [number, number];
  bidx?: number[];
  expression?: string;
  nodata?: number;
  return_mask?: boolean;
  format?: string;
} = {}): string {
  const fileUrl = `${workspacePath}/${filename}`;
  const encodedFileUrl = safeEncodeURI(fileUrl);
  
  let url = `${tilerEndpoints.tiles}?url=${encodedFileUrl}`;

  if (options.colormap) {
    url += `&colormap_name=${options.colormap}`;
  }

  if (options.rescale && options.rescale.length === 2) {
    url += `&rescale=${options.rescale[0]},${options.rescale[1]}`;
  }

  if (options.bidx && options.bidx.length > 0) {
    url += `&bidx=${options.bidx.join(',')}`;
  }

  if (options.expression) {
    url += `&expression=${encodeURIComponent(options.expression)}`;
  }

  if (options.nodata !== undefined) {
    url += `&nodata=${options.nodata}`;
  }

  if (options.return_mask !== undefined) {
    url += `&return_mask=${options.return_mask}`;
  }

  if (options.format) {
    url += `&format=${options.format}`;
  }

  return url;
}


// TODO check if saved cache on app start
export async function fetchCogInfo(filename: string): Promise<{
  bounds: number[];
}> {
  const fileUrl = `${workspacePath}/${filename}`;
  const encodedFileUrl = safeEncodeURI(fileUrl);
  const url = `${tilerEndpoints.info}?url=${encodedFileUrl}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching COG info: ${response.statusText}`);
    }
    const data = await response.json();

    return {
      bounds: data.bounds || [-180.0, -90, 180.0, 90.0]
    };
  } catch (error) {
    console.error("Failed to fetch COG info:", error);
    throw error;
  }
}

export async function fetchCogStatistics(filename: string): Promise<CogStatistics> {
  const fileUrl = `${workspacePath}/${filename}`;
  const encodedFileUrl = safeEncodeURI(fileUrl);
  const url = `${tilerEndpoints.statistics}?url=${encodedFileUrl}&bidx=1&p=2&p=15&p=85&p=95&p=98`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching COG statistics: ${response.statusText}`);
    }

    const rawData  = await response.json();
    console.log(`Full API response for ${filename}:`, rawData);

    return rawData;

  } catch (error) {
    console.error("Failed to fetch COG statistics:", error);

    // Return error with valid structure
    return { 
      min: 0, 
      max: 100,
      mean: 50,
      std: 0,
      median: 50
    };
  }
}

export function getCogTileJsonUrl(filename: string, options: {
  colormap?: string;
  rescale?: [number, number];
  bidx?: number[];
  expression?: string;
} = {}): string {
  const fileUrl = `${workspacePath}/${filename}`;
  const encodedFileUrl = safeEncodeURI(fileUrl);

  let url = `${tilerEndpoints.tilejson}?url=${encodedFileUrl}`;

  if (options.colormap) {
    url += `&colormap_name=${options.colormap}`;
  }

  if (options.rescale && options.rescale.length === 2) {
    url += `&rescale=${options.rescale[0]},${options.rescale[1]}`;
  }

  if (options.bidx && options.bidx.length > 0) {
    options.bidx.forEach(band => {
      url += `&bidx=${band}`;
    });
  }

  if (options.expression) {
    url += `&expression=${encodeURIComponent(options.expression)}`;
  }

  return url;
}

/**
 * Asset key for a raster: the basename without its extension and without a
 * trailing _COG. scripts/generate-point-index.mjs applies the same rule.
 */
export function pointIndexAssetKey(filename: string): string {
  const base = filename.slice(filename.lastIndexOf('/') + 1);
  return base.replace(/\.[^.]*$/, '').replace(/_cog$/i, '');
}

/**
 * Builds the URL for reading several rasters at one coordinate in one request.
 * The tiler opens only the assets named here.
 */
export function getBatchedPointValueUrl(assetKeys: string[], lon: number, lat: number, options: {
  coord_crs?: string;
} = {}): string {
  let url = tilerEndpoints.stacPoint.replace('{lon}', lon.toString()).replace('{lat}', lat.toString());
  url += `?url=${safeEncodeURI(pointIndexItemPath)}`;

  assetKeys.forEach(key => {
    url += `&assets=${encodeURIComponent(key)}`;
  });

  // Names each band for its asset, so values map back by name and not by
  // position. An asset holding more than one band is rejected.
  url += '&asset_as_band=true';

  if (options.coord_crs) {
    url += `&coord_crs=${encodeURIComponent(options.coord_crs)}`;
  }

  return url;
}


export function buildCustomColormapUrl(filename: string, colors: string[], values: number[]) {
  // Format expected by TiTiler: colormap=[(0, 0, 0), (255, 255, 255), etc]
  const rgbColors = colors.map(color => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `(${r}, ${g}, ${b})`;
  });

  const colormapParam = encodeURIComponent(`[${rgbColors.join(',')}]`);
  const fileUrl = `${workspacePath}/${filename}`;
  const encodedFileUrl = safeEncodeURI(fileUrl);

  return `${tilerEndpoints.tiles}?url=${encodedFileUrl}&colormap=${colormapParam}&rescale=${values[0]},${values[values.length-1]}`;
}

export const colormapCategories = {
  'Single Hue Gradients': ['gray', 'binary', 'blues', 'greens', 'oranges', 'purples', 'reds'],
  'Multi-Hue Gradients': ['bugn', 'bupu', 'gnbu', 'orrd', 'pubu', 'pubugn', 'purd', 'rdpu', 'ylgn', 'ylgnbu', 'ylorbr', 'ylorrd'],
  'Scientific Visualization': ['viridis', 'plasma', 'inferno', 'magma', 'cividis'],
};

export const getAllColormaps = (): string[] => {
  return Object.values(colormapCategories).flat();
}

export const getFormattedColormaps = () => {
  const allColormaps = getAllColormaps();

  return allColormaps.map(colormap => {
    let category = 'Other';
    for (const [cat, maps] of Object.entries(colormapCategories)) {
      if (maps.includes(colormap)) {
        category = cat;
        break;
      }
    }
    return {
      category,
      label: colormap,
      value: colormap
    };
  });
};


export async function fetchColormapData(colormapName: string): Promise<Record<string, number[]>> {
  const url = `${tilerEndpoints.colorMap.replace('{colormap}', colormapName)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching colormap data: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch colormap data for ${colormapName}:`, error);
    throw error;
  }
}

/**
 * Builds the URL to obtain a preview image of a color gradient
 * @param colormapName Name of the colormap (ex: 'viridis', 'plasma', 'gray')
 * @param width Image width in pixels
 * @param height Image height in pixels (optional, default: 30)
 * @returns Preview image URL
 */
export function buildGradientPreviewUrl(
  colormapName: string,
  width: number,
  height: number = 30
): string {
  return `${tilerEndpoints.colorMap.replace('{colormap}', colormapName)}?f=png&width=${width}&height=${height}`;
}

/**
 * Builds the URL to obtain a preview image of a layer
 * @param filename Layer filename
 * @param width Image width in pixels (optional, default: 512)
 * @param height Image height in pixels (optional, default: 256)
 * @param bbox Bounding box to crop the preview [minLon, minLat, maxLon, maxLat] (optional)
 * @returns Preview image URL from TiTiler
 */
export function buildLayerPreviewUrl(
  filename: string,
  width: number = 512,
  height: number = 256,
  bbox?: [number, number, number, number]
): string {
  const fileUrl = `${workspacePath}/${filename}`;
  const encodedFileUrl = safeEncodeURI(fileUrl);
  let url = `${tilerEndpoints.preview}?url=${encodedFileUrl}&max_size=${width}&height=${height}&format=png`;

  // Add bounding box if provided to limit latitude/longitude range
  if (bbox && bbox.length === 4) {
    url += `&bbox=${bbox.join(',')}`;
  }

  return url;
}

function safeEncodeURI(uri: string): string {
  if (uri.includes('%20') || uri.includes('%3A')) {
    return uri;
  }
  return encodeURIComponent(uri);
}