import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { layersConfig } from '../../../geoConfigExporter';
import { LunarTerrainClassifier, TerrainClassification } from '../../../utils/LunarTerrainClassifier';
import './ResourceBarsVisualizer.scss';

export type AbundanceClass = 'scarce' | 'common' | 'abundant';

export interface ResourceData {
  layerName: string;
  value: number;
  abundanceClass: AbundanceClass;
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

const ABUNDANCE_CONFIG = {
  'scarce': { symbol: '▼', label: 'Scarce', minScore: 0, maxScore: 25 },
  'common': { symbol: '—', label: 'Common', minScore: 25, maxScore: 75 },
  'abundant': { symbol: '▲', label: 'Abundant', minScore: 75, maxScore: 100 }
};

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

/**
 * Calculate geochemical score based on lunar elemental literature ranges
 */
function calculateGeochemicalScore(layerName: string, value: number): number {

  const layerEntry = Object.entries(layersConfig.layers).find(([layerId, config]) => {
    return config.displayName === layerName || layerId === layerName || config.element === layerName;
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

function classifyByAbundance(enrichmentScore: number): AbundanceClass {
  if (enrichmentScore < 25 ) return 'scarce';
  if (enrichmentScore < 75 ) return 'common';
  return 'abundant';
}

export const ResourceBarsVisualizer: React.FC<ResourceBarsVisalizerProps> = ({
  values,
  allValues,
  width = 320,
  height = 300
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Color scale (gradient from scarce to abundant)
  const colorScale = useMemo(() => {
    return d3.scaleSequential(d3.interpolateRdYlBu)
      .domain([0, 1]); // 0 = enrichment score 0%, 1 = enrichment score 100%
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

  // Convert elemental values to geochemical scores with terrain adjustment
  const resourceData = useMemo(() => {
    // Calculate terrain adjustment factor based on Ca/(Fe + 2*Ti) ratio
    const terrainAdjustmentFactor = terrainClassification ?
      LunarTerrainClassifier.getTerrainAdjustmentFactor(terrainClassification.ratio) :
      1.0;

    const data = Object.entries(values).map(([layerName, value]) => {
      // Calculate base geochemical score using literature elemental ranges
      const geochemicalScore = calculateGeochemicalScore(layerName, value);

      // Apply terrain context adjustment
      const enrichmentScore = Math.min(100, Math.max(0,
        geochemicalScore * terrainAdjustmentFactor
      ));

      const abundanceClass = classifyByAbundance(enrichmentScore);
      const symbol = ABUNDANCE_CONFIG[abundanceClass].symbol;

      const continuousPosition = enrichmentScore / 100;
      const color = colorScale(1 - continuousPosition);

      return {
        layerName,
        value,
        abundanceClass,
        geochemicalScore,
        enrichmentScore,
        continuousPosition,
        color,
        symbol
      };
    }).filter(Boolean) as ResourceData[];

    return data;
  }, [values, colorScale, terrainClassification]);

  useEffect(() => {
    if (!svgRef.current || resourceData.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 20, bottom: 60, left: 70 };
    const axisWidth = 50;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    if (terrainClassification) {
      g.append('text')
        .attr('class', 'terrain-type')
        .attr('x', innerWidth / 2)
        .attr('y', -25)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#fff')
        .style('font-weight', 'bold')
        .style('text-shadow', '0 0 3px rgba(0,0,0,0.8)')
        .text(`${terrainClassification.type.toUpperCase()} TERRAIN`);
      
      // Confidence and ratio details
      g.append('text')
        .attr('class', 'terrain-details')
        .attr('x', innerWidth / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '9px')
        .style('fill', '#ccc')
        .style('text-shadow', '0 0 3px rgba(0,0,0,0.8)')
        .text(`${terrainClassification.confidence.toUpperCase()} confidence • Ca/(Fe+2Ti) = ${terrainClassification.ratio.toFixed(2)}`);
    }

    // Chart container
    const containerRect = g.append('rect')
      .attr('class', 'chart-container')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'rgba(255, 255, 255, 0.05)')
      .attr('stroke', 'rgba(255, 255, 255, 0.2)')
      .attr('stroke-width', 1)
      .attr('rx', 5);

    const yScale = d3.scaleLinear()
      .domain([0, 1]) // 0 = enrichment score 0%, 1 = enrichment score 100%
      .range([innerHeight, 0]);

    const yAxis = d3.axisLeft(yScale)
      .tickValues([0, 0.25, 0.75, 1])
      .tickFormat((d) => {
        const labels = {
          0: 'Scarce',
          0.25: '',
          0.75: '',
          1: 'Abundant'
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
    
    const abundanceZones = [
      { start: 0, end: 0.25, class: 'scarce', color: '#2c5282', label: 'Scarce' },
      { start: 0.25, end: 0.75, class: 'common', color: '#4a5568', label: 'Common' },
      { start: 0.75, end: 1, class: 'abundant', color: '#c05621', label: 'Abundant' }
    ];

    g.selectAll('.abundance-zone')
      .data(abundanceZones)
      .enter()
      .append('rect')
      .attr('class', 'abundance-zone')
      .attr('x', 3)
      .attr('y', d => yScale(d.end))
      .attr('width', axisWidth - 6)
      .attr('height', d => yScale(d.start) - yScale(d.end))
      .attr('fill', d => d.color)
      .attr('opacity', 0.2);
    
    g.selectAll('.abundance-zone-label')
      .data(abundanceZones)
      .enter()
      .append('text')
      .attr('class', 'abundance-zone-label')
      .attr('x', axisWidth / 2)
      .attr('y', d => yScale((d.start + d.end) / 2))
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .style('font-size', '10px')
      .style('fill', '#fff')
      .style('font-weight', 'bold')
      .style('text-shadow', '0 0 3px rgba(0,0,0,0.8)')
      .text(d => d.label);
    
    // Threshold lines at 0.25 and 0.75
    g.selectAll('.threshold-line')
      .data([0.25, 0.75])
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

    // Scale for bars
    const xScale = d3.scaleBand()
      .domain(resourceData.map(d => d.layerName))
      .range([axisWidth + 10, innerWidth - 10])
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

    // Abundance symbols above bars
    resourceGroups.append('text')
      .attr('class', 'resource-symbol')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#fff')
      .style('font-weight', 'bold')
      .style('text-shadow', '0 0 3px rgba(0,0,0,0.8)')
      .text(d => d.symbol);

    // Labels outside the container (Element name labels)
    resourceGroups.append('text')
      .attr('class', 'resource-label')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', innerHeight + 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#fff')
      .text(d => {
        const name = d.layerName.replace('_primary', '');
        return name.length > 8 ? name.substring(0, 8) + '...' : name;
      });
    
    // Raw elemental values
    resourceGroups.append('text')
      .attr('class', 'resource-value')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', innerHeight + 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#ccc')
      .text(d => `${d.value.toFixed(2)} wt%`);
    
    // Terrain-adjusted enrichment scores
    resourceGroups.append('text')
      .attr('class', 'resource-enrichment')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('fill', '#999')
      .text(d => `${d.enrichmentScore.toFixed(0)}%`);
    
  }, [resourceData, width, height, colorScale, terrainClassification]);

  return (
    <div className='resource-bars-visualizer'>
      <svg ref={svgRef} width={width} height={height} />
      {/* Terrain context information */}
      {terrainClassification && (
        <div className='terrain-context'>
          <small>
            <strong>{terrainClassification.type.toUpperCase()}</strong> terrain • 
            <span style={{marginLeft: '4px'}}>
              {terrainClassification.confidence} confidence
            </span> • 
            <span style={{marginLeft: '4px'}}>
              ratio: {terrainClassification.ratio.toFixed(2)}
            </span>
          </small>
        </div>
      )}
    </div>
  );
};