import { DataAvailability } from 'types/dataSource';

export interface DerivedIndexInfo {
  title: string;
  body: string;
}

export interface DerivedIndex {
  id: string;
  symbol: string;
  name: string;
  formula: string;
  inputs: string[];
  purpose: string;
  lowLabel: string;
  highLabel: string;
  info: DerivedIndexInfo;
  dataType: DataAvailability;
  layerId?: string;
  disabled?: boolean;
}

export const DERIVED_INDEX_LAYER_MAP: Record<string, { id: string; displayName: string }> = {
  'mg-number': { id: 'mg_number', displayName: 'Mg# Magnesium Number' },
};

export const DERIVED_INDEX_BY_LAYER_ID: Record<string, {
  lowLabel: string;
  highLabel: string;
  range: [number, number];
}> = {
  mg_number: { lowLabel: 'Mare', highLabel: 'Highland', range: [0, 1] },
};

export const DERIVED_INDICES: DerivedIndex[] = [
  {
    id: 'mg-number',
    symbol: 'Mg#',
    name: 'Magnesium Number',
    formula: 'MgO / (MgO + FeO) × 100',
    inputs: ['mgo', 'feo'],
    purpose: 'Discriminates mare basalt from highland crust and flags potential mantle exposures.',
    lowLabel: 'Mare',
    highLabel: 'Highland',
    info: {
      title: 'Magnesium Number (Mg#)',
      body: 'Mg# is a derived petrological index that measures magma evolution. Low values indicate evolved mare basalt, typically richer in FeO and potentially ilmenite. High values indicate primitive, mantle-like highland material. Unlike raw oxide maps that show how much of a compound is present, Mg# answers what type of terrain this is, replacing the need to overlay MgO and FeO maps mentally. High Mg# anomalies inside large impact craters can also flag excavated mantle or lower-crustal material.',
    },
    dataType: 'map',
    layerId: 'mg_number',
  },
  {
    id: 'ti-fe-ratio',
    symbol: 'Ti/Fe',
    name: 'Ilmenite Proxy',
    formula: 'TiO₂ / FeO',
    inputs: ['tio2', 'feo'],
    purpose: 'Proxy for ilmenite concentration, the primary target for lunar oxygen production',
    lowLabel: 'Low ilmenite',
    highLabel: 'High ilmenite',
    info: {
      title: 'TiO₂ / FeO (Ilmenite Proxy)',
      body: 'Ilmenite (FeTiO₃) is the primary target for lunar oxygen production via hydrogen reduction. A high Ti/Fe ratio identifies ilmenite-rich zones, directly actionable for ISRU prospecting. This map is not yet available.',
    },
    dataType: 'map',
    disabled: true,
  },
  {
    id: 'al-fe-ratio',
    symbol: 'Al/Fe',
    name: 'Highland Discriminator',
    formula: 'Al₂O₃ / FeO',
    inputs: ['al2o3', 'feo'],
    purpose: 'Identifies anorthosite-rich highland zones, source of aluminium for structural materials',
    lowLabel: 'Mare',
    highLabel: 'Highland',
    info: {
      title: 'Al₂O₃ / FeO (Highland Discriminator)',
      body: 'Anorthosite-rich highland zones are Al-rich and structurally relevant for base construction. This ratio complements Mg# with an aluminium-focused terrain signal. This map is not yet available.',
    },
    dataType: 'map',
    disabled: true,
  },
  {
    id: 'feo-tio2-product',
    symbol: 'FeO × TiO₂',
    name: 'Combined Ilmenite Signal',
    formula: 'FeO × TiO₂',
    inputs: ['feo', 'tio2'],
    purpose: 'More direct ilmenite abundance proxy than either oxide alone',
    lowLabel: 'Low',
    highLabel: 'High ilmenite',
    info: {
      title: 'FeO × TiO₂ (Combined Ilmenite Signal)',
      body: 'The product of FeO and TiO₂ is a stronger ilmenite indicator than either ratio alone, since ilmenite requires both Fe and Ti to be simultaneously elevated. This map is not yet available.',
    },
    dataType: 'map',
    disabled: true,
  },
];
