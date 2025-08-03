import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { layersConfig } from '../../../geoConfigExporter';
import { LunarTerrainClassifier, TerrainClassification } from '../../../utils/LunarTerrainClassifier';
import { elements } from '../../navigation/submenu/PeriodicTable/PeriodicTable';
import './ResourceBarsVisualizer.scss';

export interface ResourceData {
  layerName: string;
  value: number;
  geochemicalScore: number; // Score based on lunar elemental ranges (0-100)
  enrichmentScore: number; // Terrain-adjusted score (0-100)
  continuousPosition: number; // 0-1, based on enrichmentScore
  color: string;
  symbol: string;
}

interface ResourceBarsVisalizerProps {
  values: { [key: string]: number }; // For display
  allValues?: { [key: string]: number }; // For calculation
  width?: number;
  height?: number;
}

// Data for Ca, Fe, Ti, Mg from gamma spectrometry, magnetometry and isotope analysis
const LUNAR_ELEMENTAL_RANGES: Record<string, { min: number; max: number }> = {

  /**
   * (Ca) Source:
   * https://www.sciencedirect.com/science/article/abs/pii/S0012821X21003344
   * https://www.lpi.usra.edu/publications/books/lunar_sourcebook/pdf/Chapter08.pdf
   */
  'calcium': { min: 0, max: 14.3 },

  /**
   * (Fe) Source:
   * https://ntrs.nasa.gov/api/citations/19740018168/downloads/19740018168.pdf
   * https://ntrs.nasa.gov/api/citations/19740018189/downloads/19740018189.pdf?attachment=true
   */
  'iron': { min: 0, max: 15.2 },

  /**
   * (Ti) Source:
   * https://ntrs.nasa.gov/citations/19800026504
   */
  'titanium': { min: 0, max: 6.0 },

  /**
   * (Mg) Source:
   * https://ui.adsabs.harvard.edu/abs/2013GeCoA.120....1S
   * https://pmc.ncbi.nlm.nih.gov/articles/PMC8974359/
   */
  'magnesium': { min: 0, max: 13.0 }
};

/* PeriodicTable element mapping with layersConfig */
function getElementSymbol(elementName: string): string {
  const element = elements.find(el => el.name.toLowerCase() === elementName.toLowerCase());
  return element?.symbol || elementName.toUpperCase().substring(0, 2);
}

/**
 * Calculate geochemical score based on lunar elemental literature ranges
 */
function calculateGeochemicalScore(layerName: string, value: number): number {

  const layerEntry = Object.entries(layersConfig.layers).find(([layerId, config]) => {
    return layerId === layerName || config.element === layerName;
  })

  if (!layerEntry) {
    console.warn(`Layer configuration not found for: ${layerName}`);
    return 50;
  }

  const [, layerConfig] = layerEntry;
  const elementName = layerConfig.element; // ← Cette ligne manquait !

  if (!elementName) {
    console.warn(`No element defined for layer: ${layerName}`);
    return 50;
  }

  const range = LUNAR_ELEMENTAL_RANGES[elementName];

  if (!range) {
    console.warn(`No elemental range defined for element: ${elementName}. Supported elements: ${Object.keys(LUNAR_ELEMENTAL_RANGES).join(', ')}`);
    return 50;
  }

  // Calculate score based on position within literature range
  const score = ((value - range.min) / (range.max - range.min)) * 100;
  const clampedScore = Math.min(100, Math.max(0, score));

  return clampedScore;

}

export const ResourceBarsVisualizer: React.FC<ResourceBarsVisalizerProps> = ({
  values,
  allValues,
  width: propWidth,
  height: propHeight
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({
    width: propWidth,
    height: propHeight
  })

  // Measure container and respond to size changes
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: propWidth || width,
          height: propHeight || height
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [propWidth, propHeight]);

  const { width, height } = dimensions;

  // Color scale (gradient from scarce to abundant)
  const colorScale = useMemo(() => {
    return d3.scaleSequential(d3.interpolateGreens)
      .domain([1, 0]); // 0 = enrichment score 0%, 1 = enrichment score 100%
  }, []);

  // Lunar terrain classification based on Ca/(Fe + 2*Ti) ratio
  const terrainClassification = useMemo((): TerrainClassification | null => {
    const valuesForCalculation = allValues || values;
    const elements = LunarTerrainClassifier.extractElements(valuesForCalculation);
    if (elements) {
      return LunarTerrainClassifier.classifyTerrain(elements.calcium, elements.iron, elements.titanium);
    }
    return null;
  }, [allValues, values]);

  // Convert elemental values to geochemical scores
  const resourceData = useMemo(() => {
    const data = Object.entries(values).map(([layerName, value]) => {
      // Calculate base geochemical score using literature elemental ranges
      const geochemicalScore = calculateGeochemicalScore(layerName, value);

      // Apply terrain context adjustment
      const enrichmentScore = geochemicalScore;

      const continuousPosition = enrichmentScore / 100;
      const color = colorScale(1 - continuousPosition);

      // Get element symbol from layersConfig
      const layerEntry = Object.entries(layersConfig.layers).find(([layerId, config]) => {
        return layerId === layerName || config.element === layerName;
      });

      const elementName = layerEntry?.[1]?.element;
      const symbol = elementName ? getElementSymbol(elementName) : layerName.substring(0, 2).toUpperCase();

      return {
        layerName,
        value,
        geochemicalScore,
        enrichmentScore,
        continuousPosition,
        color,
        symbol,
      };
    }).filter(Boolean) as ResourceData[];

    return data;
  }, [values, colorScale]);

  useEffect(() => {
    if (!svgRef.current || resourceData.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const svgElement = svgRef.current;
    const actualWidth = svgElement.clientWidth;
    const actualHeight = svgElement.clientHeight;

    const margin = { 
      top: 30, 
      right: 0,
      bottom: 55, 
      left: 0
    };

    const axisWidth = 50; 
    const innerWidth = actualWidth - margin.left - margin.right;
    const innerHeight = actualHeight - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const yScale = d3.scaleLinear()
      .domain([0, 1])
      .range([innerHeight, 0]);

    const yAxis = d3.axisLeft(yScale)
      .tickValues([0, 0.25, 0.5, 0.75, 1])
      .tickFormat((d) => {
        const labels = {
          0: 'LOW',
          0.25: '0.25%',
          0.5: 'MED',
          0.75: '0.75%',
          1: 'HIGH'
        };
        return labels[d as number] || '';
      });
    
    g.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${axisWidth}, 0)`)
      .call(yAxis)
      .selectAll('text')
      .style('fill', '#ccc')
      .style('font-size', '11px')
      .style('font-weight', 'bold');
    
    g.selectAll('.y-axis line')
      .style('stroke', '#ccc');
    
    // Threshold lines
    g.selectAll('.threshold-line')
      .data([0.25, 0.5, 0.75])
      .enter()
      .append('line')
      .attr('class', 'threshold-line')
      .attr('x1', axisWidth)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .style('stroke', '#fff')
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.4);
    
    const referenceData = [
      { position: 0, label: '0%' },
      { position: 1, label: '100%' }
    ];

    g.selectAll('.reference-bar')
      .data(referenceData)
      .enter()
      .append('line')
      .attr('class', 'reference-bar')
      .attr('x1', axisWidth)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d.position))
      .attr('y2', d => yScale(d.position))
      .style('stroke', ' #ffffff')
      .style('opacity', 0.4)

    // Scale for bars
    const xScale = d3.scaleBand()
      .domain(resourceData.map(d => d.layerName))
      .range([axisWidth, innerWidth])
      .padding(0.3)
    
    // Groups for each resources
    const resourceGroups = g.selectAll('.resource-group')
      .data(resourceData)
      .enter()
      .append('g')
      .attr('class', 'resource-group')
      .attr('transform', d => `translate(${xScale(d.layerName)}, 0)`);
    
    // Main bars
    resourceGroups.append('rect')
      .attr('class', 'resource-bar')
      .attr('x', 0)
      .attr('y', d => yScale(d.continuousPosition))
      .attr('width', xScale.bandwidth())
      .attr('height', d => yScale(0) - yScale(d.continuousPosition))
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('opacity', 0.9);
    
    // Vertical separator between elements symbol and value
    g.selectAll('.element-separator')
      .data(resourceData.slice(0, -1)) // no separator for the last element
      .enter()
      .append('line')
      .attr('class', 'element-separator')
      .attr('x1', d => (xScale(d.layerName) || 0) + xScale.bandwidth() + xScale.padding() * xScale.bandwidth() / 2)
      .attr('x2', d => (xScale(d.layerName) || 0) + xScale.bandwidth() + xScale.padding() * xScale.bandwidth() / 2)
      .attr('y1', innerHeight + 5)
      .attr('y2', innerHeight + 45)
      .style('stroke', '#fff')
      .style('stroke-width', 1)
      .style('opacity', 0.3);
    
    // Square for chemical elements
    resourceGroups.append('rect')
      .attr('class', 'element-symbol-square')
      .attr('x', xScale.bandwidth() / 2 - 12) // Centered square of 24x24
      .attr('y', innerHeight + 8)
      .attr('width', 24)
      .attr('height', 24)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .attr('rx', 2); // Rounded border
    
    // Chemical element inside the square
    resourceGroups.append('text')
      .attr('class', 'element-symbol')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', innerHeight + 8 + 12) // Verticaly centered inside the square
      .attr('dy', '0.32em')
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#fff')
      .style('font-family', 'Arial, sans-serif')
      .text(d => d.symbol);
    
    // Raw elemental values
    resourceGroups.append('text')
      .attr('class', 'resource-value')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#dcdcdc')
      .style('font-family', 'Courier New, monospace')
      .text(d => `${d.value.toFixed(2)} wt%`);
    
  }, [resourceData, colorScale, terrainClassification]);

  return (
    <div 
      ref={containerRef}
      className='resource-bars-visualizer'
    >
      <svg ref={svgRef} width={width} height={height} />
      {/* Terrain context information */}
      {terrainClassification && (
        <div className='terrain-context'>
          <small>
            <strong>{terrainClassification.type.charAt(0).toUpperCase() + terrainClassification.type.slice(1)}</strong> terrain
          </small>
        </div>
      )}
    </div>
  );
};