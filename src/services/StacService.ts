export const STAC_BASE_PATH = '/stac';

export interface StacItemProperties {
  title?: string;
  mission?: string;
  platform?: string;
  instruments?: string[];
  spatial_resolution_m?: number;
  spatial_resolution_km?: number;
  achieved_resolution_km?: number;
  grid_size_deg?: number;
  grid_size_km?: number;
  [key: string]: unknown;
}

export interface StacItem {
  properties: StacItemProperties;
  [key: string]: unknown;
}

class StacService {
  private cache = new Map<string, Promise<StacItem | null>>();

  fetchStacItem(stacPath: string): Promise<StacItem | null> {
    if (!this.cache.has(stacPath)) {
      this.cache.set(stacPath, this.load(stacPath));
    }
    return this.cache.get(stacPath)!;
  }

  private async load(stacPath: string): Promise<StacItem | null> {
    try {
      const response = await fetch(`${STAC_BASE_PATH}/${stacPath}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Failed to fetch STAC item: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch STAC item at ${stacPath}:`, error);
      return null;
    }
  }
}

export const stacService = new StacService();

export function getStacSourceLabel(properties: StacItemProperties): string | undefined {
  const source = properties.mission || properties.platform;
  if (!source) return undefined;

  const instrument = properties.instruments?.[0];
  return instrument ? `${source} · ${instrument}` : source;
}

export function getStacResolutionLabel(properties: StacItemProperties): string | undefined {
  if (properties.spatial_resolution_m !== undefined) {
    return `${properties.spatial_resolution_m}m/pixel`;
  }
  if (properties.spatial_resolution_km !== undefined) {
    return `${properties.spatial_resolution_km}km/pixel`;
  }
  if (properties.achieved_resolution_km !== undefined) {
    return `${properties.achieved_resolution_km}km/pixel`;
  }
  if (properties.grid_size_km !== undefined) {
    return `${properties.grid_size_km}km/pixel`;
  }
  if (properties.grid_size_deg !== undefined) {
    return `${properties.grid_size_deg}°`;
  }
  return undefined;
}
