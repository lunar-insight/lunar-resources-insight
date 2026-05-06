export type LayerVariant = {
  label: string;
  filename: string;
  stac: string;
};

export type LayerConfig = {
  filename: string;
  category: string;
  displayName?: string;
  element?: string;
  compound?: string;
  units?: string;
  available?: boolean;
  stac?: string;
  layerType?: 'raster' | 'point';
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
