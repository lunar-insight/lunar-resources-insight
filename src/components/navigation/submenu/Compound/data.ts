import { DataAvailability } from 'types/dataSource';

export type CompoundCategory = 'ice' | 'lunar-soil-oxides' | 'gases-volatiles';

export interface Compound {
  id: string;              // Formula as ID (e.g., 'H₂O')
  formula: string;
  name: string;
  category: CompoundCategory;
  dataType: DataAvailability;
}

export const COMPOUNDS: Compound[] = [
  // ICE
  { id: 'H₂O', formula: 'H₂O', name: 'Water ice', category: 'ice', dataType: 'map+ground' },

  // LUNAR SOIL OXIDES
  { id: 'FeO', formula: 'FeO', name: 'Iron(II) oxide', category: 'lunar-soil-oxides', dataType: 'map+ground' },
  { id: 'TiO₂', formula: 'TiO₂', name: 'Titanium dioxide', category: 'lunar-soil-oxides', dataType: 'map+ground' },
  { id: 'Al₂O₃', formula: 'Al₂O₃', name: 'Aluminum oxide', category: 'lunar-soil-oxides', dataType: 'map+ground' },
  { id: 'MgO', formula: 'MgO', name: 'Magnesium oxide', category: 'lunar-soil-oxides', dataType: 'map+ground' },
  { id: 'CaO', formula: 'CaO', name: 'Calcium oxide', category: 'lunar-soil-oxides', dataType: 'map+ground' },
  { id: 'SiO₂', formula: 'SiO₂', name: 'Silicon dioxide', category: 'lunar-soil-oxides', dataType: 'map+ground' },

  // GASES AND VOLATILES
  { id: 'CO₂', formula: 'CO₂', name: 'Carbon dioxide', category: 'gases-volatiles', dataType: 'ground' },
  { id: 'NH₃', formula: 'NH₃', name: 'Ammonia', category: 'gases-volatiles', dataType: 'ground' },
  { id: 'CH₄', formula: 'CH₄', name: 'Methane', category: 'gases-volatiles', dataType: 'ground' },
  { id: 'SO₂', formula: 'SO₂', name: 'Sulfur dioxide', category: 'gases-volatiles', dataType: 'ground' },
  { id: 'H₂S', formula: 'H₂S', name: 'Hydrogen sulfide', category: 'gases-volatiles', dataType: 'ground' },
  { id: 'C₂H₄', formula: 'C₂H₄', name: 'Ethylene', category: 'gases-volatiles', dataType: 'ground' },
  { id: 'CH₃OH', formula: 'CH₃OH', name: 'Methanol', category: 'gases-volatiles', dataType: 'ground' },
  { id: 'CO', formula: 'CO', name: 'Carbon monoxide', category: 'gases-volatiles', dataType: 'ground' },
  { id: 'H₂', formula: 'H₂', name: 'Hydrogen', category: 'gases-volatiles', dataType: 'ground' },
];

// Mapping from compound formula to layer ID and metadata
export const COMPOUND_LAYER_MAP: Record<string, { id: string; displayName: string }> = {
  'H₂O': { id: 'h2o', displayName: 'Water ice (H₂O)' },
  'FeO': { id: 'feo', displayName: 'Iron(II) oxide (FeO)' },
  'TiO₂': { id: 'tio2', displayName: 'Titanium dioxide (TiO₂)' },
  'Al₂O₃': { id: 'al2o3', displayName: 'Aluminum oxide (Al₂O₃)' },
  'MgO': { id: 'mgo', displayName: 'Magnesium oxide (MgO)' },
  'CaO': { id: 'cao', displayName: 'Calcium oxide (CaO)' },
  'SiO₂': { id: 'sio2', displayName: 'Silicon dioxide (SiO₂)' },
  'CO₂': { id: 'co2', displayName: 'Carbon dioxide (CO₂)' },
  'NH₃': { id: 'nh3', displayName: 'Ammonia (NH₃)' },
  'CH₄': { id: 'ch4', displayName: 'Methane (CH₄)' },
  'SO₂': { id: 'so2', displayName: 'Sulfur dioxide (SO₂)' },
  'H₂S': { id: 'h2s', displayName: 'Hydrogen sulfide (H₂S)' },
  'C₂H₄': { id: 'c2h4', displayName: 'Ethylene (C₂H₄)' },
  'CH₃OH': { id: 'ch3oh', displayName: 'Methanol (CH₃OH)' },
  'CO': { id: 'co', displayName: 'Carbon monoxide (CO)' },
  'H₂': { id: 'h2', displayName: 'Hydrogen (H₂)' }
};

export const CATEGORY_INFO = {
  'ice': {
    title: 'ICE',
    description: 'Water ice is the solid form of H₂O and represents the most stable occurrence of water on the Moon. It is primarily found in permanently shadowed regions near the lunar poles, where extremely low temperatures prevent sublimation. These ice deposits can be mixed with lunar soil or form localized concentrations, and they play a key role in lunar science and future resource utilization.'
  },
  'lunar-soil-oxides': {
    title: 'LUNAR SOIL OXIDES',
    description: 'Lunar soil oxides are oxygen-based chemical compounds that constitute the bulk of the Moon\'s surface material. These compounds, often referred to as "Major Inorganic Oxides", represent the dominant chemical form of elements such as silicon, aluminum, iron, magnesium, calcium, and titanium. Rather than being isolated minerals, they describe the overall chemical composition of the lunar regolith and are commonly used in planetary science to analyze, compare, and map the Moon\'s surface.'
  },
  'gases-volatiles': {
    title: 'GASES AND VOLATILES',
    description: 'This category includes chemical compounds that readily transition between solid and gaseous states under lunar environmental conditions. Known scientifically as "Volatile Species (Simple and Organic)", these substances may exist as gases, frozen solids, or be trapped within the lunar soil depending on temperature and location. They include both simple inorganic molecules and carbon-bearing organic compounds, and they are important for understanding lunar surface processes, external delivery by comets or solar wind, and potential in-situ resource utilization.'
  }
};

