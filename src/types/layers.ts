export type LayerVariant = {
  label: string;
  filename: string;
  stac: string;
};

export type LayerCategory =
  | 'basemap'
  | 'geographical'
  | 'chemical'
  | 'compound'
  | 'derived-index'
  | 'rock'
  | 'mineral';

export type LayerConfig = {
  filename: string;
  category: LayerCategory;
  displayName?: string;
  element?: string;
  compound?: string;
  units?: string;
  available?: boolean;
  isDerivedIndex?: boolean;
  stac?: string;
  layerType?: 'raster' | 'point' | 'vector';
  variants?: LayerVariant[];
  metadata?: {
    source?: string;
    resolution?: string;
    description?: string;
  };
};

export type LayersConfig = {
  layers: Record<string, LayerConfig>;
};
