export interface ElementReferenceRange {
  min: number;
  max: number;
  units: string;
  sources: string[];
}

// Data for Ca, Fe, Ti, Mg from gamma spectrometry, magnetometry and isotope analysis

export const ELEMENT_REFERENCE_RANGES: Record<string, ElementReferenceRange> = {
  calcium: {
    min: 0,
    max: 14.3,
    units: 'wt%',
    sources: [
      'https://www.sciencedirect.com/science/article/abs/pii/S0012821X21003344',
      'https://www.lpi.usra.edu/publications/books/lunar_sourcebook/pdf/Chapter08.pdf',
    ],
  },
  iron: {
    min: 0,
    max: 15.2,
    units: 'wt%',
    sources: [
      'https://ntrs.nasa.gov/api/citations/19740018168/downloads/19740018168.pdf',
      'https://ntrs.nasa.gov/api/citations/19740018189/downloads/19740018189.pdf?attachment=true',
    ],
  },
  titanium: {
    min: 0,
    max: 6.0,
    units: 'wt%',
    sources: [
      'https://ntrs.nasa.gov/citations/19800026504',
    ],
  },
  magnesium: {
    min: 0,
    max: 13.0,
    units: 'wt%',
    sources: [
      'https://ui.adsabs.harvard.edu/abs/2013GeCoA.120....1S',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC8974359/',
    ],
  },
  hydrogen: {
    min: 0,
    max: 150,
    units: 'ppm',
    sources: [
      'https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2022JE007197', // Lawrence et al. 2022 – Global Hydrogen Abundances on the Lunar Surface (LP NS), JGR Planets
      'https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2005JE002637', // Lawrence et al. 2006 – Improved modeling of LP NS data, polar H 100–150 ppm, JGR Planets
    ],
  },
  thorium: {
    min: 0,
    max: 14.0,
    units: 'ppm',
    sources: [
      'https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/1999JE001177', // Lawrence et al. 2000 – Thorium abundances on the lunar surface (LP GRS), JGR Planets
      'https://iopscience.iop.org/article/10.1088/1674-4527/19/6/76', // Zhu et al. 2019 – Thorium distribution on the Moon (Chang'E-2 GRS), RAA
    ],
  },
};

export const COMPOUND_REFERENCE_RANGES: Record<string, ElementReferenceRange> = {
  feo: {
    min: 0,
    max: 22.0,
    units: 'wt%',
    sources: [
      'https://www.sciencedirect.com/science/article/pii/S0019103524002185', // Qiu et al. 2025 – FeO from Clementine CNN
      'https://www.sciencedirect.com/science/article/abs/pii/S0012821X21003344', // LP GRS iron data
    ],
  },
  tio2: {
    min: 0,
    max: 15.0,
    units: 'wt%',
    sources: [
      'https://www.sciencedirect.com/science/article/pii/S0019103524002185', // Qiu et al. 2025 – TiO₂ from Clementine CNN
    ],
  },
  al2o3: {
    min: 0,
    max: 35.0,
    units: 'wt%',
    sources: [
      'https://www.sciencedirect.com/science/article/pii/S0019103524002185', // Qiu et al. 2025 – Al₂O₃ from Clementine CNN
    ],
  },
  mgo: {
    min: 0,
    max: 22.0,
    units: 'wt%',
    sources: [
      'https://www.sciencedirect.com/science/article/pii/S0019103524002185', // Qiu et al. 2025 – MgO from Clementine CNN
    ],
  },
  cao: {
    min: 0,
    max: 20.0,
    units: 'wt%',
    sources: [
      'https://www.sciencedirect.com/science/article/pii/S0019103524002185', // Qiu et al. 2025 – CaO from Clementine CNN
    ],
  },
  sio2: {
    min: 0,
    max: 55.0,
    units: 'wt%',
    sources: [
      'https://doi.org/10.1029/2005JE002656', // Prettyman et al. 2006 – Figure 42 SiO2 axis range, LP GRS vs. lunar sample/meteorite data
    ],
  },
};

export const COMPOUND_SYMBOLS: Record<string, string> = {
  feo: 'FeO',
  tio2: 'TiO₂',
  al2o3: 'Al₂O₃',
  mgo: 'MgO',
  cao: 'CaO',
  sio2: 'SiO₂',
};
