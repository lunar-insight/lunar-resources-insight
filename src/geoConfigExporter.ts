export const mapServerUrl = process.env.REACT_APP_SERVER_URL;
export const workspacePath = process.env.REACT_APP_WORKSPACE_PATH;

export const tilerEndpoints = {
  tiles: `${mapServerUrl}/cog/tiles/MoonGeographicSphere/{z}/{x}/{y}`,
  tilejson: `${mapServerUrl}/cog/MoonGeographicSphere/tilejson.json`,
  point: `${mapServerUrl}/cog/point/{lon},{lat}`,
  info: `${mapServerUrl}/cog/info`,
  statistics: `${mapServerUrl}/cog/statistics`,
  preview: `${mapServerUrl}/cog/preview`,
  colorMap: `${mapServerUrl}/colorMaps/{colormap}`
};

if (!mapServerUrl) {
  throw new Error('REACT_APP_SERVER_URL is not defined in environment variables.');
}

if (!workspacePath) {
  throw new Error('REACT_APP_WORKSPACE_PATH is not defined in environment variables.');
}

export type LayerConfig = {
  filename: string;
  category: string;
  element?: string;
  displayName?: string;
  metadata?: {
    source?: string;
    resolution?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

export type LayersConfig = {
  layers: {
    [layerId: string]: LayerConfig;
  }
}

import layersConfigJson from './layersConfig.json';
export const layersConfig: LayersConfig = layersConfigJson;

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
    url += `&colormap=${encodeURIComponent(options.colormap)}`;
  }

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

export async function fetchCogStatistics(filename: string): Promise<{
  min: number;
  max: number;
  mean?: number;
  std?: number;
  median?: number;
}> {
  const fileUrl = `${workspacePath}/${filename}`;
  const encodedFileUrl = safeEncodeURI(fileUrl);
  const url = `${tilerEndpoints.statistics}?url=${encodedFileUrl}&bidx=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error fetching COG statistics: ${response.statusText}`);
    }
    const rawData  = await response.json();

    return {
      min: rawData ?.b1?.min ?? 0,
      max: rawData ?.b1?.max ?? 100,
      mean: rawData ?.b1?.mean,
      std: rawData ?.b1?.std,
      median: rawData ?.b1?.median
    }
  } catch (error) {
    console.error("Failed to fetch COG statistics:", error);
    return { min: 0, max: 100 };
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

export function getPointValueUrl(filename: string, lon: number, lat: number, options: {
  bidx?: number[];
  expression?: string;
} = {}): string {
  const fileUrl = `${workspacePath}/${filename}`;
  const encodedFileUrl = safeEncodeURI(fileUrl);

  let url = tilerEndpoints.point.replace('{lon}', lon.toString()).replace('{lat}', lat.toString());
  url += `?url=${encodedFileUrl}`;

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

export function getGradientPreviewUrl(colormap: string, width: number): string {
  return `${tilerEndpoints.colorMap.replace('{colormap}', colormap)}?format=png&width=${width}&height=30`;
};

function safeEncodeURI(uri: string): string {
  if (uri.includes('%20') || uri.includes('%3A')) {
    return uri;
  }
  return encodeURIComponent(uri);
}