import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ResourceBarsVisualizer } from './ResourceBarsVisualizer';
import { LunarTerrainClassifier } from '../../../utils/LunarTerrainClassifier';

// Mock dependencies
jest.mock('../../../geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      calcium_primary: {
        filename: 'test_ca.tif',
        category: 'chemical',
        element: 'calcium',
        displayName: 'Calcium (Primary)'
      },
      iron_primary: {
        filename: 'test_fe.tif',
        category: 'chemical',
        element: 'iron',
        displayName: 'Iron (Primary)'
      },
      titanium_primary: {
        filename: 'test_ti.tif',
        category: 'chemical',
        element: 'titanium',
        displayName: 'Titanium (Primary)'
      },
      magnesium_primary: {
        filename: 'test_mg.tif',
        category: 'chemical',
        element: 'magnesium',
        displayName: 'Magnesium (Primary)'
      }
    }
  }
}));

jest.mock('../../navigation/submenu/PeriodicTable/PeriodicTable', () => ({
  elements: [
    { name: 'Calcium', symbol: 'Ca', atomicNumber: 20 },
    { name: 'Iron', symbol: 'Fe', atomicNumber: 26 },
    { name: 'Titanium', symbol: 'Ti', atomicNumber: 22 },
    { name: 'Magnesium', symbol: 'Mg', atomicNumber: 12 }
  ]
}));

jest.mock('../../../utils/LunarTerrainClassifier', () => ({
  LunarTerrainClassifier: {
    extractElements: jest.fn(),
    classifyTerrain: jest.fn()
  }
}));

// Mock ResizeObserver
const mockDisconnect = jest.fn();
const mockObserve = jest.fn();
const mockResizeObserver = jest.fn(() => ({
  observe: mockObserve,
  disconnect: mockDisconnect,
  unobserve: jest.fn()
}));

// Mock D3
const mockColorScale = jest.fn((value: number) => `rgb(${Math.floor(value * 255)}, 100, 150)`);
const mockD3Selection = {
  selectAll: jest.fn().mockReturnThis(),
  remove: jest.fn().mockReturnThis(),
  append: jest.fn().mockReturnThis(),
  attr: jest.fn().mockReturnThis(),
  style: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  call: jest.fn().mockReturnThis(),
  data: jest.fn().mockReturnThis(),
  enter: jest.fn().mockReturnThis(),
  exit: jest.fn().mockReturnThis()
};

jest.mock('d3', () => ({
  select: jest.fn(() => mockD3Selection),
  scaleSequential: jest.fn(() => {
    const scale = Object.assign(mockColorScale, {
      domain: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis()
    });
    return scale;
  }),
  interpolateRdYlBu: jest.fn(t => `rgb(${Math.floor(t * 255)}, 100, 150)`),
  scaleLinear: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis()
  })),
  scaleBand: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    padding: jest.fn().mockReturnThis(),
    bandwidth: jest.fn(() => 50)
  })),
  axisLeft: jest.fn(() => ({
    tickValues: jest.fn().mockReturnThis(),
    tickFormat: jest.fn().mockReturnThis()
  }))
}));

// @ts-ignore
global.ResizeObserver = mockResizeObserver;

// Mock console.warn
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('ResourceBarsVisualizer', () => {
  const defaultProps = {
    values: {
      calcium_primary: 8.5,
      iron_primary: 12.3,
      titanium_primary: 3.2,
      magnesium_primary: 7.8
    },
    width: 400,
    height: 300
  };

  const mockTerrainClassification = {
    type: 'highlands' as const,
    confidence: 'high' as const,
    description: 'Typical anorthosite highlands',
    ratio: 1.8
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleWarn.mockClear();
    (LunarTerrainClassifier.extractElements as jest.Mock).mockReturnValue({
      calcium: 8.5,
      iron: 12.3,
      titanium: 3.2
    });
    (LunarTerrainClassifier.classifyTerrain as jest.Mock).mockReturnValue(mockTerrainClassification);
  });

  afterAll(() => {
    mockConsoleWarn.mockRestore();
  });

  describe('Component Rendering', () => {
    it('renders without crashing', () => {
      render(<ResourceBarsVisualizer {...defaultProps} />);
      expect(document.querySelector('.resource-bars-visualizer')).toBeInTheDocument();
    });

    it('renders with custom dimensions', () => {
      render(<ResourceBarsVisualizer {...defaultProps} width={500} height={400} />);
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '500');
      expect(svg).toHaveAttribute('height', '400');
    });

    it('renders without explicit dimensions', () => {
      const { values } = defaultProps;
      render(<ResourceBarsVisualizer values={values} />);
      expect(document.querySelector('.resource-bars-visualizer')).toBeInTheDocument();
    });
  });

  describe('Data Processing', () => {
    it('handles valid elemental data', () => {
      render(<ResourceBarsVisualizer {...defaultProps} />);
      expect(document.querySelector('.resource-bars-visualizer')).toBeInTheDocument();
      expect(mockColorScale).toHaveBeenCalled();
    });

    it('handles empty values object', () => {
      render(<ResourceBarsVisualizer values={{}} />);
      expect(document.querySelector('.resource-bars-visualizer')).toBeInTheDocument();
    });

    it('handles unknown elements gracefully', () => {
      const unknownElementValues = {
        unknown_element: 5.0
      };
      
      render(<ResourceBarsVisualizer values={unknownElementValues} />);
      expect(document.querySelector('.resource-bars-visualizer')).toBeInTheDocument();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Layer configuration not found for: unknown_element')
      );
    });

    it('handles extreme values correctly', () => {
      const extremeValues = {
        calcium_primary: 100, // Way above max
        iron_primary: -10,    // Below min
        titanium_primary: 3.2,
        magnesium_primary: 7.8
      };
      
      render(<ResourceBarsVisualizer values={extremeValues} />);
      expect(document.querySelector('.resource-bars-visualizer')).toBeInTheDocument();
    });
  });

  describe('Terrain Classification Integration', () => {
    it('displays terrain context when classification available', () => {
      render(<ResourceBarsVisualizer {...defaultProps} />);
      
      // Just check that terrain context div exists
      expect(document.querySelector('.terrain-context')).toBeInTheDocument();
      expect(LunarTerrainClassifier.extractElements).toHaveBeenCalledWith(defaultProps.values);
    });

    it('handles missing terrain classification', () => {
      (LunarTerrainClassifier.extractElements as jest.Mock).mockReturnValue(null);
      
      render(<ResourceBarsVisualizer {...defaultProps} />);
      
      expect(document.querySelector('.terrain-context')).not.toBeInTheDocument();
    });

    it('uses allValues for terrain classification when provided', () => {
      const allValues = {
        ...defaultProps.values,
        additional_element: 5.0
      };
      
      render(<ResourceBarsVisualizer {...defaultProps} allValues={allValues} />);
      
      expect(LunarTerrainClassifier.extractElements).toHaveBeenCalledWith(allValues);
    });
  });

  describe('Responsive Behavior', () => {
    it('sets up ResizeObserver on mount', () => {
      render(<ResourceBarsVisualizer {...defaultProps} />);
      expect(mockResizeObserver).toHaveBeenCalled();
      expect(mockObserve).toHaveBeenCalled();
    });

    it('cleans up ResizeObserver on unmount', () => {
      const { unmount } = render(<ResourceBarsVisualizer {...defaultProps} />);
      unmount();
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('D3 Visualization', () => {
    it('initializes D3 visualization correctly', async () => {
      render(<ResourceBarsVisualizer {...defaultProps} />);
      
      await waitFor(() => {
        expect(mockD3Selection.selectAll).toHaveBeenCalled();
        expect(mockColorScale).toHaveBeenCalled();
      });
    });

    it('handles visualization re-renders', () => {
      const { rerender } = render(<ResourceBarsVisualizer {...defaultProps} />);
      
      const newValues = { ...defaultProps.values, calcium_primary: 10.0 };
      rerender(<ResourceBarsVisualizer {...defaultProps} values={newValues} />);
      
      expect(mockD3Selection.remove).toHaveBeenCalled();
    });
  });
});