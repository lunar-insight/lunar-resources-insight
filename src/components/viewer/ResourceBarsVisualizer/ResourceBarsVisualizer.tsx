import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { layerStatsService, GeochemicalClass } from '../../../services/LayerStatsService';
import './ResourceBarsVisualizer.scss';

export interface ResourceData {
  layerName: string;
  value: number;
  classification: GeochemicalClass;
  exactPercentile: number;
  continuousPosition: number; // 0-1
  color: string;
  symbol: string;
}

interface ResourceBarsVisalizerProps {
  values: { [key: string]: number };
  width?: number;
  height?: number;
}

const GEOCHEMICAL_CONFIG = {
  'highly-depleted': { symbol: '▼▼', label: 'Highly Depleted', threshold: 2 },
  'depleted': { symbol: '▼', label: 'Depleted', threshold: 15 },
  'background': { symbol: '—', label: 'Background', threshold: 85 },
  'enriched': { symbol: '▲', label: 'Enriched', threshold: 95 },
  'highly-enriched': { symbol: '▲▲', label: 'Highly Enriched', threshold: 98 },
  'anomalous': { symbol: '★', label: 'Anomalous', threshold: 100 }
};

export const ResourceBarsVisualizer: React.FC<ResourceBarsVisalizerProps> = ({
  values,
  width = 320,
  height = 300
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Color scale (gradient from depleted to enriched)
  const colorScale = useMemo(() => {
    return d3.scaleSequential(d3.interpolateRdYlBu)
      .domain([0, 1]); // 0 = percentile 0%, 1 = percentile 100%
  }, []);

  // Raw to normalized values
  const resourceData = useMemo(() => {
    const data = Object.entries(values).map(([layerName, value]) => {
      const layerId = layerStatsService.getAllLayerIds()
        .find(id => {
          const config = layerStatsService.getLayerConfig(id);

          // Verification
          return config?.name === layerName ||
                 config?.displayName === layerName ||
                 id === layerName;
        });

      if (!layerId) {
        console.warn(`No layerId found for layerName: ${layerName}`); 
        return null;
      }

      const classification = layerStatsService.classifyGeochemicalValue(layerId, value);
      const continuousPosition = layerStatsService.calculateContinuousPercentilePosition(layerId, value);
      const exactPercentile = layerStatsService.getExactPercentile(layerId, value);
      const color = colorScale(1 - continuousPosition);
      const symbol = GEOCHEMICAL_CONFIG[classification].symbol;

      // console.log(`Layer: ${layerName}, Value: ${value}, percentile=${exactPercentile.toFixed(1)}%, position=${continuousPosition.toFixed(3)}`);

      return {
        layerName,
        value,
        classification,
        exactPercentile,
        continuousPosition,
        color,
        symbol
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

    const margin = { top: 40, right: 20, bottom: 60, left: 20 };
    const axisWidth = 25;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Container
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
      .domain([0, 1]) // 0 = 0%, 1 = 100%
      .range([innerHeight, 0]);
    
    const yAxis = d3.axisLeft(yScale)
      .tickValues([0, 0.02, 0.15, 0.85, 0.95, 0.98, 1])
      .tickFormat(d => ''); // No ticks text yet
    
    g.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${axisWidth}, 0)`)
      .call(yAxis)
      .selectAll('line')
      .style('stroke', '#ccc')
    
    // Classification zones background rectangles
    const zones = [
      { start: 0, end: 0.02, class: 'highly-depleted', color: '#1a365d' },
      { start: 0.02, end: 0.15, class: 'depleted', color: '#2c5282' },
      { start: 0.15, end: 0.85, class: 'background', color: '#4a5568' },
      { start: 0.85, end: 0.95, class: 'enriched', color: '#c05621' },
      { start: 0.95, end: 0.98, class: 'highly-enriched', color: '#e53e3e' },
      { start: 0.98, end: 1, class: 'anomalous', color: '#9c1c1c' }
    ];

    g.selectAll('.zone-rect')
      .data(zones)
      .enter()
      .append('rect')
      .attr('class', 'zone-rect')
      .attr('x', 3)
      .attr('y', d => yScale(d.end))
      .attr('width', axisWidth - 6)
      .attr('height', d => yScale(d.start) - yScale(d.end))
      .attr('fill', d => d.color)
      .attr('opacity', 0.3);

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

    // Fixed resource symbols 
    resourceGroups.append('text')
      .attr('class', 'resource-symbol')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#fff')
      .style('font-weight', 'bold')
      .style('text-shadow', '0 0 3px rgba(0,0,0,0.8)')
      .text(d => d.symbol);

    // Labels outside the container
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
    
    // Values with percentage
    resourceGroups.append('text')
      .attr('class', 'resource-value')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', innerHeight + 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#ccc')
      .text(d => `${d.value.toFixed(3)} wt%`);
    
    // Exact percentile
    resourceGroups.append('text')
      .attr('class', 'resource-percentile')
      .attr('x', xScale.bandwidth() / 2)
      .attr('y', innerHeight + 45)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('fill', '#999')
      .text(d => `P${d.exactPercentile.toFixed(1)}`);
    
  }, [resourceData, width, height, colorScale]);

  return (
    <div className='resource-bars-visualizer'>
      <svg ref={svgRef} width={width} height={height} />
    </div>
  );
};