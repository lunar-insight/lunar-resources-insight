import { Mineral, Rock } from './types';

export const MINERALS: Mineral[] = [
  // SILICATES
  {
    id: 'plagioclase',
    name: 'Plagioclase',
    formula: '(Ca,Na)(Al,Si)AlSi₂O₈',
    category: 'silicate',
    dataType: 'map+ground',
  },
  {
    id: 'pyroxene',
    name: 'Pyroxene',
    formula: '(Ca,Mg,Fe)₂Si₂O₆',
    category: 'silicate',
    dataType: 'map+ground',
  },
  {
    id: 'olivine',
    name: 'Olivine',
    formula: '(Mg,Fe)₂SiO₄',
    category: 'silicate',
    dataType: 'map+ground',
  },
  {
    id: 'quartz',
    name: 'Quartz',
    formula: 'SiO₂',
    category: 'silicate',
    dataType: 'ground',
  },
  {
    id: 'k-feldspar',
    name: 'K-Feldspar',
    formula: 'KAlSi₃O₈',
    category: 'silicate',
    dataType: 'ground',
  },

  // OXIDES
  {
    id: 'ilmenite',
    name: 'Ilmenite',
    formula: 'FeTiO₃',
    category: 'oxide',
    dataType: 'map+ground',
  },
  {
    id: 'hematite',
    name: 'Hematite',
    formula: 'Fe₂O₃',
    category: 'oxide',
    dataType: 'ground',
  },
  {
    id: 'spinel',
    name: 'Spinel',
    formula: 'MgAl₂O₄',
    category: 'oxide',
    dataType: 'map+ground',
  },
  {
    id: 'chromite',
    name: 'Chromite',
    formula: 'FeCr₂O₄',
    category: 'oxide',
    dataType: 'ground',
  },
  {
    id: 'ulvospinel',
    name: 'Ulvöspinel',
    formula: 'Fe₂TiO₄',
    category: 'oxide',
    dataType: 'ground',
  },

  // MOON-DISCOVERED
  {
    id: 'armalcolite',
    name: 'Armalcolite',
    formula: '(Fe,Mg)Ti₂O₅',
    category: 'moon-discovered',
    dataType: 'ground',
    mineralType: 'oxide',
    discoveryInfo: {
      mission: 'Apollo 11',
      year: 1969,
      location: 'Mare Tranquillitatis',
    },
  },
  {
    id: 'pyroxferroite',
    name: 'Pyroxferroite',
    formula: 'Fe₇Si₇O₂₁',
    category: 'moon-discovered',
    dataType: 'ground',
    mineralType: 'silicate',
    discoveryInfo: {
      mission: 'Apollo 11 & 12',
    },
  },
  {
    id: 'tranquillityite',
    name: 'Tranquillityite',
    formula: 'Fe₈(Zr,Y)₂Ti₃Si₃O₂₄',
    category: 'moon-discovered',
    dataType: 'ground',
    mineralType: 'silicate',
    discoveryInfo: {
      mission: 'Apollo 11',
      year: 1969,
      location: 'Mare Tranquillitatis',
    },
  },
  {
    id: 'changesite-y',
    name: 'Changesite-(Y)',
    formula: '(Ca₈Y)◻Fe²⁺(PO₄)₇',
    category: 'moon-discovered',
    dataType: 'ground',
    mineralType: 'phosphate',
    discoveryInfo: {
      mission: "Chang'e-5",
      year: 2020,
    },
  },
];

// Rocks with composition references to mineral IDs
export const ROCKS: Rock[] = [
  {
    id: 'anorthosite',
    name: 'Anorthosite',
    icon: '🏔️',
    rockType: 'Highland',
    composition: ['plagioclase'], // >90% plagioclase
    dataType: 'map+ground',
  },
  {
    id: 'basalt',
    name: 'Basalt',
    icon: '⬛',
    rockType: 'Mare',
    composition: ['pyroxene', 'plagioclase', 'ilmenite', 'olivine'],
    dataType: 'map+ground',
  },
  {
    id: 'breccia',
    name: 'Breccia',
    icon: '💥',
    rockType: 'Impact',
    composition: ['plagioclase', 'pyroxene', 'olivine'], // mixed fragments
    dataType: 'map+ground',
  },
  {
    id: 'kreep',
    name: 'KREEP',
    icon: '⚡',
    rockType: 'Highland',
    composition: ['plagioclase', 'pyroxene', 'k-feldspar'],
    dataType: 'map+ground',
  },
  {
    id: 'norite',
    name: 'Norite',
    icon: '🟫',
    rockType: 'Deep Crust/Highland',
    composition: ['plagioclase', 'pyroxene'],
    dataType: 'ground',
  },
  {
    id: 'troctolite',
    name: 'Troctolite',
    icon: '🟤',
    rockType: 'Deep Crust/Highland',
    composition: ['plagioclase', 'olivine'],
    dataType: 'ground',
  },
  {
    id: 'dunite',
    name: 'Dunite',
    icon: '🟢',
    rockType: 'Deep Crust/Highland',
    composition: ['olivine'], // >90% olivine
    dataType: 'ground',
  },
  {
    id: 'gabbro',
    name: 'Gabbro',
    icon: '⬜',
    rockType: 'Deep Crust/Highland',
    composition: ['plagioclase', 'pyroxene'],
    dataType: 'ground',
  },
];
