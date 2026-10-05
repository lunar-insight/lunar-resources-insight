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
  mineral?: string;
  units?: string;
  available?: boolean;
  isDerivedIndex?: boolean;
  stac?: string;
  layerType?: 'raster' | 'point' | 'vector';
  variants?: LayerVariant[];
  /** Dataset name on the Inspector's line, e.g. "LP GRS (Prettyman 2006)". */
  datasetLabel?: string;
  /** Dataset name on a chart legend tag, e.g. "Prettyman". */
  datasetShort?: string;
  /** Decimals displayed for a value of this dataset. */
  decimals?: number;
  /** Layers sharing this id form one Inspector line, reading the file on the feature's side of the Moon. */
  inspectorPair?: string;
};

export type LayersConfig = {
  layers: Record<string, LayerConfig>;
};
