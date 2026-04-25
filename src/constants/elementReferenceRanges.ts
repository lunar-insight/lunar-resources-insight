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
};
