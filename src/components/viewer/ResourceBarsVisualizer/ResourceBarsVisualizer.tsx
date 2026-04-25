import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { layersConfig } from 'geoConfigExporter';
import { LunarTerrainClassifier, TerrainClassification } from 'utils/LunarTerrainClassifier';
import { elements } from 'constants/periodicTableData';
import { ELEMENT_REFERENCE_RANGES } from 'constants/elementReferenceRanges';
import styles from './ResourceBarsVisualizer.module.scss';

export interface ResourceData {
  layerName: string;
  value: number;
  geochemicalScore: number;
  enrichmentScore: number;
  continuousPosition: number;
  color: string;
  symbol: string;
  elementName: string;
  units: string;
}

interface ResourceBarsVisalizerProps {
  values: { [key: string]: number };
  allValues?: { [key: string]: number };
  width?: number;
  height?: number;
}

const PANEL_HEIGHT = 220;

function getElementSymbol(elementName: string): string {
  const element = elements.find(el => el.name.toLowerCase() === elementName.toLowerCase());
  return element?.symbol || elementName.toUpperCase().substring(0, 2);
}

export function calculateGeochemicalScore(layerName: string, value: number): number {
  const layerEntry = Object.entries(layersConfig.layers).find(([layerId, config]) => {
    return layerId === layerName || config.element === layerName;
  });

  if (!layerEntry) {
    console.warn(`Layer configuration not found for: ${layerName}`);
    return 50;
  }

  const [, layerConfig] = layerEntry;
  const elementName = layerConfig.element;

  if (!elementName) {
    console.warn(`No element defined for layer: ${layerName}`);
    return 50;
  }

  const range = ELEMENT_REFERENCE_RANGES[elementName];

  if (!range) {
    console.warn(`No elemental range defined for element: ${elementName}. Supported elements: ${Object.keys(ELEMENT_REFERENCE_RANGES).join(', ')}`);
    return 50;
  }

  const score = ((value - range.min) / (range.max - range.min)) * 100;
  return Math.min(100, Math.max(0, score));
}

function renderBarsPanel(
  svgEl: SVGSVGElement,
  data: ResourceData[],
  getColor: (d: ResourceData) => string,
  valueTextFill: string
): void {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const actualWidth = svgEl.clientWidth;
  const actualHeight = svgEl.clientHeight;

  const margin = { top: 30, right: 0, bottom: 55, left: 0 };
  const axisWidth = 50;
  const innerWidth = actualWidth - margin.left - margin.right;
  const innerHeight = actualHeight - margin.top - margin.bottom;

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const yScale = d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

  const yAxis = d3.axisLeft(yScale)
    .tickValues([0, 0.25, 0.5, 0.75, 1])
    .tickFormat((d) => {
      const labels: Record<number, string> = {
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
    .style('fill', '#e0e0e0')
    .style('font-size', '11px')
    .style('font-weight', 'bold');

  g.selectAll('.y-axis line').style('stroke', '#e0e0e0');

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

  g.selectAll('.reference-bar')
    .data([{ position: 0 }, { position: 1 }])
    .enter()
    .append('line')
    .attr('class', 'reference-bar')
    .attr('x1', axisWidth)
    .attr('x2', innerWidth)
    .attr('y1', d => yScale(d.position))
    .attr('y2', d => yScale(d.position))
    .style('stroke', '#ffffff')
    .style('opacity', 0.4);

  const xScale = d3.scaleBand()
    .domain(data.map(d => d.layerName))
    .range([axisWidth, innerWidth])
    .padding(0.3);

  const resourceGroups = g.selectAll('.resource-group')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'resource-group')
    .attr('transform', d => `translate(${xScale(d.layerName)}, 0)`);

  resourceGroups.append('rect')
    .attr('class', 'resource-bar')
    .attr('x', 0)
    .attr('y', d => yScale(d.continuousPosition))
    .attr('width', xScale.bandwidth())
    .attr('height', d => yScale(0) - yScale(d.continuousPosition))
    .attr('fill', d => getColor(d))
    .attr('stroke', '#fff')
    .attr('stroke-width', 1)
    .attr('opacity', 0.9);

  g.selectAll('.element-separator')
    .data(data.slice(0, -1))
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

  resourceGroups.append('rect')
    .attr('class', 'element-symbol-square')
    .attr('x', xScale.bandwidth() / 2 - 12)
    .attr('y', innerHeight + 8)
    .attr('width', 24)
    .attr('height', 24)
    .attr('fill', 'none')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .attr('rx', 2);

  resourceGroups.append('text')
    .attr('class', 'element-symbol')
    .attr('x', xScale.bandwidth() / 2)
    .attr('y', innerHeight + 8 + 12)
    .attr('dy', '0.32em')
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('font-weight', 'bold')
    .style('fill', '#fff')
    .style('font-family', 'Arial, sans-serif')
    .text(d => d.symbol);

  resourceGroups.append('text')
    .attr('class', 'resource-value')
    .attr('x', xScale.bandwidth() / 2)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', valueTextFill)
    .style('font-family', 'Courier New, monospace')
    .text(d => d.value.toFixed(2));
}

export const ResourceBarsVisualizer: React.FC<ResourceBarsVisalizerProps> = ({
  values,
  allValues,
  width: propWidth
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgWtRef = useRef<SVGSVGElement>(null);
  const svgPpmRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(propWidth);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(propWidth || entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [propWidth]);

  const colorScale = useMemo(() =>
    d3.scaleSequential(d3.interpolateGreens).domain([1, 0])
  , []);

  const ppmColorScale = useMemo(() =>
    d3.scaleSequential(d3.interpolateBlues).domain([1, 0])
  , []);

  const terrainClassification = useMemo((): TerrainClassification | null => {
    const valuesForCalculation = allValues || values;
    const els = LunarTerrainClassifier.extractElements(valuesForCalculation);
    if (els) {
      return LunarTerrainClassifier.classifyTerrain(els.calcium, els.iron, els.titanium);
    }
    return null;
  }, [allValues, values]);

  const resourceData = useMemo(() => {
    const seenSymbols = new Set<string>();

    return Object.entries(values).flatMap(([layerName, value]) => {
      const layerEntry = Object.entries(layersConfig.layers).find(([layerId, config]) => {
        return layerId === layerName || config.element === layerName;
      });

      const elementName = layerEntry?.[1]?.element ?? '';
      const symbol = elementName ? getElementSymbol(elementName) : layerName.substring(0, 2).toUpperCase();

      if (seenSymbols.has(symbol)) return [];
      seenSymbols.add(symbol);

      const range = ELEMENT_REFERENCE_RANGES[elementName];
      const units = range?.units ?? 'wt%';

      const geochemicalScore = calculateGeochemicalScore(layerName, value);
      const enrichmentScore = geochemicalScore;
      const continuousPosition = enrichmentScore / 100;
      const color = colorScale(1 - continuousPosition);

      return [{ layerName, value, geochemicalScore, enrichmentScore, continuousPosition, color, symbol, elementName, units }];
    }) as ResourceData[];
  }, [values, colorScale]);

  const wtResourceData = useMemo(() => resourceData.filter(d => d.units === 'wt%'), [resourceData]);
  const ppmResourceData = useMemo(() => resourceData.filter(d => d.units === 'ppm'), [resourceData]);

  useEffect(() => {
    if (!svgWtRef.current || wtResourceData.length === 0) return;
    renderBarsPanel(svgWtRef.current, wtResourceData, d => d.color, '#e0e0e0');
  }, [wtResourceData]);

  useEffect(() => {
    if (!svgPpmRef.current || ppmResourceData.length === 0) return;
    renderBarsPanel(
      svgPpmRef.current,
      ppmResourceData,
      d => ppmColorScale(1 - d.continuousPosition),
      '#e0e0e0'
    );
  }, [ppmResourceData, ppmColorScale]);

  return (
    <div ref={containerRef} className={styles.resourceBarsVisualizer}>

      <div className={styles.panelHeader}>
        <span className={`${styles.panelTitle} ${styles.wt}`}>Major Elements</span>
        <div className={styles.panelRule} />
        <span className={`${styles.unitBadge} ${styles.wt}`}>wt%</span>
      </div>
      {wtResourceData.length > 0 && <svg ref={svgWtRef} width={width} height={PANEL_HEIGHT} />}

      {ppmResourceData.length > 0 && (
        <>
          <div className={styles.panelSep} />
          <div className={styles.panelHeader}>
            <span className={`${styles.panelTitle} ${styles.ppm}`}>Trace Elements</span>
            <div className={styles.panelRule} />
            <span className={`${styles.unitBadge} ${styles.ppm}`}>ppm</span>
          </div>
          <svg ref={svgPpmRef} width={width} height={PANEL_HEIGHT} />
        </>
      )}

      {terrainClassification && (
        <div className={styles.terrainContext}>
          <small>
            <strong>{terrainClassification.type.charAt(0).toUpperCase() + terrainClassification.type.slice(1)}</strong> terrain
          </small>
        </div>
      )}
    </div>
  );
};
