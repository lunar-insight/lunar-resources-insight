import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { layersConfig, type LayerConfig } from 'geoConfigExporter';
import { elements } from 'constants/periodicTableData';
import { ELEMENT_REFERENCE_RANGES, COMPOUND_REFERENCE_RANGES, COMPOUND_SYMBOLS } from 'constants/elementReferenceRanges';
import { ElementDatasetPicker, type DatasetCandidate } from 'components/ui/ElementDatasetPicker/ElementDatasetPicker';
import styles from './ResourceBarsVisualizer.module.scss';

export interface ResourceData {
  layerName: string;
  value: number;
  abundanceScore: number;
  continuousPosition: number;
  color: string;
  symbol: string;
  elementName: string;
  units: string;
  category: 'chemical' | 'compound';
}

export interface CountRateData {
  layerName: string;
  value: number;
  symbol: string;
  displayName: string;
}

export interface NodataResourceData {
  layerName: string;
  symbol: string;
  elementName: string;
  units: string;
}

interface SymbolCandidate {
  layerName: string;
  value: number;
  layerConfig: LayerConfig;
  elementName: string;
  isCompound: boolean;
}

interface NodataSymbolCandidate {
  layerName: string;
  layerConfig: LayerConfig;
}

interface PickerInfo {
  symbol: string;
  layerName: string;
  activeLayerName: string;
  candidates: DatasetCandidate[];
}

interface PickerPosition {
  x: number;
  y: number;
}

interface ResourceBarsVisalizerProps {
  values: { [key: string]: number };
  allValues?: { [key: string]: number };
  nodataLayerIds?: string[];
  width?: number;
  height?: number;
  activeDatasetBySymbol?: Map<string, string>;
  onSelectDataset?: (symbol: string, layerName: string) => void;
  isPaused?: boolean;
}

const PANEL_HEIGHT = 220;
const MAX_HATCH_OPACITY = 0.35;

const CHART_MARGIN_TOP = 30;
const CHART_MARGIN_LEFT = 0;
const CHART_AXIS_WIDTH = 50;
const CHART_MARGIN_BOTTOM_DEFAULT = 55;
// Extra room reserved below the value row so the dataset-picker toggle
// (rendered as an HTML overlay, not SVG) never overlaps the next panel.
const CHART_MARGIN_BOTTOM_WITH_PICKER = 71;
const PICKER_Y_OFFSET = 59;

function getElementSymbol(elementName: string): string {
  const element = elements.find(el => el.name.toLowerCase() === elementName.toLowerCase());
  return element?.symbol || elementName.toUpperCase().substring(0, 2);
}

function getCompoundSymbol(compoundName: string): string {
  return COMPOUND_SYMBOLS[compoundName] ?? compoundName.substring(0, 3).toUpperCase();
}

function findLayerEntry(layerName: string): [string, LayerConfig] | undefined {
  return Object.entries(layersConfig.layers).find(([layerId, config]) => {
    return layerId === layerName || config.element === layerName;
  });
}

export function calculateAbundanceScore(layerName: string, value: number): number {
  const layerEntry = findLayerEntry(layerName);

  if (!layerEntry) {
    console.warn(`Layer configuration not found for: ${layerName}`);
    return 50;
  }

  const [, layerConfig] = layerEntry;

  if (layerConfig.category === 'compound' && layerConfig.compound) {
    const range = COMPOUND_REFERENCE_RANGES[layerConfig.compound];
    if (!range) return 50;
    const score = ((value - range.min) / (range.max - range.min)) * 100;
    return Math.min(100, Math.max(0, score));
  }

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

interface ScaleRefs {
  yScale: d3.ScaleLinear<number, number>;
  xScale: d3.ScaleBand<string>;
  innerHeight: number;
}

function shallowEqualNodataLayers(a: NodataResourceData[], b: NodataResourceData[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item.layerName === b[i].layerName);
}

function updateBarsOnly(
  svgEl: SVGSVGElement,
  data: ResourceData[],
  valueTextFill: string
): void {
  const svg = d3.select(svgEl);

  const groups = svg.selectAll<SVGGElement, ResourceData>('.resource-group')
    .data(data, d => d.layerName);

  groups.select<SVGTextElement>('.data-value')
    .style('fill', valueTextFill)
    .text(d => d.value.toFixed(2));

  groups.each(function(d) {
    const groupId = d.layerName.replace(/[^a-zA-Z0-9]/g, '-');
    d3.select(svgEl)
      .selectAll(`#hatch-grad-${groupId} stop`)
      .filter((_, i) => i === 1)
      .attr('stop-opacity', d.continuousPosition * MAX_HATCH_OPACITY);
  });
}

function renderBarsPanel(
  svgEl: SVGSVGElement,
  data: ResourceData[],
  nodataData: NodataResourceData[],
  getColor: (d: ResourceData) => string,
  valueTextFill: string,
  marginBottom: number
): ScaleRefs {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const defs = svg.append('defs');
  defs.append('pattern')
    .attr('id', 'resource-hatch-white')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 4)
    .attr('height', 4)
    .append('line')
    .attr('x1', 0).attr('y1', 0)
    .attr('x2', 4).attr('y2', 4)
    .attr('stroke', 'white')
    .attr('stroke-width', 0.75);

  const actualWidth = svgEl.clientWidth;
  const actualHeight = svgEl.clientHeight;

  const margin = { top: CHART_MARGIN_TOP, right: 0, bottom: marginBottom, left: CHART_MARGIN_LEFT };
  const axisWidth = CHART_AXIS_WIDTH;
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

  const allLayerNames = [
    ...data.map(d => d.layerName),
    ...nodataData.map(d => d.layerName),
  ];

  const xScale = d3.scaleBand()
    .domain(allLayerNames)
    .range([axisWidth, innerWidth])
    .padding(0.3);

  const effectiveBandwidth = Math.min(
    xScale.bandwidth(),
    (innerWidth - axisWidth) * (1 - xScale.padding()) / 4
  );
  const xOffset = (xScale.bandwidth() - effectiveBandwidth) / 2;

  const resourceGroups = g.selectAll('.resource-group')
    .data(data)
    .enter()
    .append('g')
    .attr('class', 'resource-group')
    .attr('transform', d => `translate(${xScale(d.layerName)}, 0)`);

  const HATCH_BOTTOM_Y = innerHeight + 56;

  resourceGroups.each(function(d) {
    const groupId = d.layerName.replace(/[^a-zA-Z0-9]/g, '-');
    const gradId  = `hatch-grad-${groupId}`;
    const maskId  = `hatch-mask-${groupId}`;

    const grad = defs.append('linearGradient')
      .attr('id', gradId)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', 0).attr('y2', HATCH_BOTTOM_Y);

    grad.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'white')
      .attr('stop-opacity', 0);

    grad.append('stop')
      .attr('offset', `${((innerHeight / HATCH_BOTTOM_Y) * 100).toFixed(1)}%`)
      .attr('stop-color', 'white')
      .attr('stop-opacity', d.continuousPosition * MAX_HATCH_OPACITY);

    grad.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'white')
      .attr('stop-opacity', 0);

    const mask = defs.append('mask').attr('id', maskId);
    mask.append('rect')
      .attr('x', xOffset)
      .attr('y', 0)
      .attr('width', effectiveBandwidth)
      .attr('height', HATCH_BOTTOM_Y)
      .attr('fill', `url(#${gradId})`);

    d3.select(this)
      .insert('rect', ':first-child')
      .attr('class', 'resource-hatch-bg')
      .attr('x', xOffset)
      .attr('y', 0)
      .attr('width', effectiveBandwidth)
      .attr('height', HATCH_BOTTOM_Y)
      .attr('fill', 'url(#resource-hatch-white)')
      .attr('mask', `url(#${maskId})`);
  });

  const NOISE_COUNT = 5;
  const noiseBarW = (effectiveBandwidth / NOISE_COUNT) * 0.65;
  const noiseStep = effectiveBandwidth / NOISE_COUNT;

  const noiseGroups = resourceGroups.append('g')
    .attr('class', 'resource-noise-group');

  noiseGroups.each(function(d) {
    const noiseGroup = d3.select(this);
    for (let i = 0; i < NOISE_COUNT; i++) {
      noiseGroup.append('rect')
        .attr('class', 'noise-bar')
        .attr('x', xOffset + i * noiseStep + (noiseStep - noiseBarW) / 2)
        .attr('width', noiseBarW)
        .attr('fill', getColor(d))
        .attr('opacity', 0.75)
        .attr('y', yScale(0))
        .attr('height', 0);
    }
  });

  noiseGroups.each(function() {
    const groupEl = this;
    const resourceGroupEl = groupEl.parentElement!;

    d3.select(groupEl).selectAll<SVGRectElement, unknown>('.noise-bar').each(function() {
      const barEl = this;
      const bar = d3.select(this);

      function animateNoise() {
        if (!barEl.isConnected) return;
        const datum = d3.select<SVGGElement, ResourceData>(resourceGroupEl as unknown as SVGGElement).datum();
        const maxH = Math.max(
          yScale(0) - yScale(datum.continuousPosition),
          innerHeight * 0.08
        );
        const jitter = 0.15;
        const h = maxH * (1 - jitter + Math.random() * jitter);
        bar.transition()
          .duration(150 + Math.random() * 200)
          .ease(d3.easeSinInOut)
          .attr('fill', getColor(datum))
          .attr('y', yScale(0) - h)
          .attr('height', h)
          .on('end', animateNoise);
      }
      animateNoise();
    });
  });

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
    .attr('x', xOffset + effectiveBandwidth / 2 - 12)
    .attr('y', innerHeight + 8)
    .attr('width', 24)
    .attr('height', 24)
    .attr('fill', 'none')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .attr('rx', 2);

  resourceGroups.append('text')
    .attr('class', 'element-symbol')
    .attr('x', xOffset + effectiveBandwidth / 2)
    .attr('y', innerHeight + 8 + 12)
    .attr('dy', '0.32em')
    .attr('text-anchor', 'middle')
    .style('font-size', d => d.symbol.length > 4 ? '8px' : d.symbol.length > 3 ? '10px' : '12px')
    .style('font-weight', 'bold')
    .style('fill', '#fff')
    .style('font-family', 'Arial, sans-serif')
    .text(d => d.symbol);

  resourceGroups.append('text')
    .attr('class', 'resource-value data-value')
    .attr('x', xOffset + effectiveBandwidth / 2)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', valueTextFill)
    .style('font-family', 'Courier New, monospace')
    .text(d => d.value.toFixed(2));

  const nodataGroups = g.selectAll<SVGGElement, NodataResourceData>('.nodata-group')
    .data(nodataData)
    .enter()
    .append('g')
    .attr('class', 'nodata-group')
    .attr('transform', d => `translate(${xScale(d.layerName)}, 0)`)
    .style('opacity', 0.2);

  nodataGroups.append('rect')
    .attr('class', 'nodata-bar')
    .attr('x', xOffset)
    .attr('y', 0)
    .attr('width', effectiveBandwidth)
    .attr('height', innerHeight)
    .attr('fill', 'none')
    .attr('stroke', '#666')
    .attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '5,3');

  nodataGroups.append('text')
    .attr('class', 'nodata-label')
    .attr('x', xOffset + effectiveBandwidth / 2)
    .attr('y', innerHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('font-size', '11px')
    .style('font-weight', 'bold')
    .style('fill', '#bbb')
    .style('font-family', 'Courier New, monospace')
    .style('letter-spacing', '0.08em')
    .text('N/A');

  nodataGroups.append('rect')
    .attr('class', 'element-symbol-square')
    .attr('x', xOffset + effectiveBandwidth / 2 - 12)
    .attr('y', innerHeight + 8)
    .attr('width', 24)
    .attr('height', 24)
    .attr('fill', 'none')
    .attr('stroke', '#666')
    .attr('stroke-width', 1.5)
    .attr('rx', 2);

  nodataGroups.append('text')
    .attr('class', 'element-symbol')
    .attr('x', xOffset + effectiveBandwidth / 2)
    .attr('y', innerHeight + 20)
    .attr('dy', '0.32em')
    .attr('text-anchor', 'middle')
    .style('font-size', d => d.symbol.length > 4 ? '8px' : d.symbol.length > 3 ? '10px' : '12px')
    .style('font-weight', 'bold')
    .style('fill', '#666')
    .style('font-family', 'Arial, sans-serif')
    .text(d => d.symbol);

  nodataGroups.append('text')
    .attr('class', 'resource-value')
    .attr('x', xOffset + effectiveBandwidth / 2)
    .attr('y', innerHeight + 45)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#555')
    .style('font-family', 'Courier New, monospace')
    .text('—');

  const rollDur = 40;
  const rollPts = 30;
  const rollBaseY = innerHeight * 0.96;
  const rollAmp = innerHeight * 0.038;
  const rollLineGen = d3.line<{ x: number; y: number }>()
    .x(d => d.x)
    .y(d => d.y)
    .curve(d3.curveBasis);
  const genRollPts = () =>
    Array.from({ length: rollPts }, (_, i) => ({
      x: xOffset + (i / (rollPts - 1)) * effectiveBandwidth,
      y: rollBaseY + (Math.random() - 0.5) * rollAmp * 2,
    }));

  nodataGroups.each(function() {
    const rollGroup = this;
    const rollPath = d3.select(rollGroup)
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', '#aaa')
      .attr('stroke-width', 1)
      .attr('stroke-linecap', 'round')
      .style('opacity', 0.75)
      .attr('d', rollLineGen(genRollPts()) ?? '');

    function rollMorph() {
      if (!rollGroup.isConnected) return;
      rollPath
        .transition()
        .duration(rollDur + Math.random() * rollDur * 0.25)
        .ease(d3.easeSinInOut)
        .attr('d', rollLineGen(genRollPts()) ?? '')
        .on('end', rollMorph);
    }
    rollMorph();
  });

  nodataGroups.each(function() {
    const node = this;
    function pulse() {
      d3.select(node)
        .transition()
        .duration(1200)
        .ease(d3.easeSinInOut)
        .style('opacity', 0.8)
        .transition()
        .duration(1200)
        .ease(d3.easeSinInOut)
        .style('opacity', 0.2)
        .on('end', pulse);
    }
    pulse();
  });

  return { yScale, xScale, innerHeight };
}

function computePickerPositions(pickers: PickerInfo[], scales: ScaleRefs): Record<string, PickerPosition> {
  const positions: Record<string, PickerPosition> = {};
  pickers.forEach(picker => {
    const bandStart = scales.xScale(picker.layerName);
    if (bandStart === undefined) return;
    positions[picker.symbol] = {
      x: CHART_MARGIN_LEFT + bandStart + scales.xScale.bandwidth() / 2,
      y: CHART_MARGIN_TOP + scales.innerHeight + PICKER_Y_OFFSET,
    };
  });
  return positions;
}

export const ResourceBarsVisualizer: React.FC<ResourceBarsVisalizerProps> = ({
  values,
  nodataLayerIds = [],
  width: propWidth,
  activeDatasetBySymbol,
  onSelectDataset,
  isPaused = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgElementWtRef = useRef<SVGSVGElement>(null);
  const svgElementPpmRef = useRef<SVGSVGElement>(null);
  const svgCompoundRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(propWidth);
  const elementWtScalesRef = useRef<ScaleRefs | null>(null);
  const elementPpmScalesRef = useRef<ScaleRefs | null>(null);
  const compoundScalesRef = useRef<ScaleRefs | null>(null);
  const prevNodataElementWt = useRef<NodataResourceData[]>([]);
  const prevNodataElementPpm = useRef<NodataResourceData[]>([]);
  const prevNodataCompound = useRef<NodataResourceData[]>([]);
  const prevHasPickersElementWt = useRef(false);
  const prevHasPickersElementPpm = useRef(false);
  const prevHasPickersCompound = useRef(false);

  const [internalActiveDataset, setInternalActiveDataset] = useState<Map<string, string>>(new Map());
  const activeDataset = activeDatasetBySymbol ?? internalActiveDataset;
  const selectDataset = (symbol: string, layerName: string) => {
    if (onSelectDataset) {
      onSelectDataset(symbol, layerName);
    } else {
      setInternalActiveDataset(prev => new Map(prev).set(symbol, layerName));
    }
  };

  const [elementWtPositions, setElementWtPositions] = useState<Record<string, PickerPosition>>({});
  const [elementPpmPositions, setElementPpmPositions] = useState<Record<string, PickerPosition>>({});
  const [compoundPositions, setCompoundPositions] = useState<Record<string, PickerPosition>>({});

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

  const compoundColorScale = useMemo(() =>
    d3.scaleSequential(d3.interpolateGreens).domain([1, 0])
  , []);

  // Every selected layer that currently has a value, grouped by the symbol
  // it resolves to. A symbol with more than one candidate needs the caller
  // to pick which one is active, via activeDatasetBySymbol.
  const symbolGroups = useMemo(() => {
    const groups = new Map<string, SymbolCandidate[]>();

    Object.entries(values).forEach(([layerName, value]) => {
      const layerEntry = findLayerEntry(layerName);
      const layerConfig = layerEntry?.[1];
      if (!layerConfig || layerConfig.units === 'count_rate') return;

      const isCompound = layerConfig.category === 'compound';
      const compoundName = isCompound ? (layerConfig.compound ?? '') : '';
      const elementName = isCompound ? '' : (layerConfig.element ?? '');

      const symbol = isCompound && compoundName
        ? getCompoundSymbol(compoundName)
        : elementName ? getElementSymbol(elementName) : layerName.substring(0, 2).toUpperCase();

      const list = groups.get(symbol) ?? [];
      list.push({ layerName, value, layerConfig, elementName, isCompound });
      groups.set(symbol, list);
    });

    return groups;
  }, [values]);

  // Every selected layer that has no value at the current point, grouped by
  // the symbol it resolves to. A symbol's total candidate count (this plus
  // symbolGroups) determines whether its picker is shown, so the picker
  // stays available even while its preferred layer is temporarily nodata.
  const nodataSymbolGroups = useMemo(() => {
    const groups = new Map<string, NodataSymbolCandidate[]>();

    nodataLayerIds.forEach(layerName => {
      const layerConfig = layersConfig.layers[layerName];
      if (!layerConfig || layerConfig.units === 'count_rate') return;

      const isCompound = layerConfig.category === 'compound';
      const compoundName = isCompound ? (layerConfig.compound ?? '') : '';
      const elementName = isCompound ? '' : (layerConfig.element ?? '');

      const symbol = isCompound && compoundName
        ? getCompoundSymbol(compoundName)
        : elementName ? getElementSymbol(elementName) : layerName.substring(0, 2).toUpperCase();

      const list = groups.get(symbol) ?? [];
      list.push({ layerName, layerConfig });
      groups.set(symbol, list);
    });

    return groups;
  }, [nodataLayerIds]);

  const resourceData = useMemo(() => {
    const result: ResourceData[] = [];

    symbolGroups.forEach((candidates, symbol) => {
      const preferredLayerName = activeDataset.get(symbol);

      // A picked candidate with no current value is excluded here, so the
      // symbol renders as nodata.
      if (preferredLayerName && !candidates.some(c => c.layerName === preferredLayerName)) return;

      const active = candidates.find(c => c.layerName === preferredLayerName) ?? candidates[0];
      const { layerName, value, isCompound, elementName } = active;

      let units: string;
      if (isCompound) {
        units = 'wt%';
      } else {
        const range = ELEMENT_REFERENCE_RANGES[elementName];
        units = range?.units ?? 'wt%';
      }

      const abundanceScore = calculateAbundanceScore(layerName, value);
      const continuousPosition = abundanceScore / 100;
      const color = colorScale(1 - continuousPosition);
      const category: 'chemical' | 'compound' = isCompound ? 'compound' : 'chemical';

      result.push({ layerName, value, abundanceScore, continuousPosition, color, symbol, elementName, units, category });
    });

    return result;
  }, [symbolGroups, activeDataset, colorScale]);

  const countRateData = useMemo((): CountRateData[] => {
    return Object.entries(values).flatMap(([layerName, value]) => {
      const layerEntry = Object.entries(layersConfig.layers).find(([layerId]) => layerId === layerName);
      const layerConfig = layerEntry?.[1];
      if (layerConfig?.units !== 'count_rate') return [];
      const elementName = layerConfig.element ?? '';
      const symbol = elementName ? getElementSymbol(elementName) : layerName.substring(0, 2).toUpperCase();
      return [{ layerName, value, symbol, displayName: layerConfig.displayName ?? layerName }];
    });
  }, [values]);

  const elementWtData = useMemo(() => resourceData.filter(d => d.units === 'wt%' && d.category !== 'compound'), [resourceData]);
  const elementPpmData = useMemo(() => resourceData.filter(d => d.units === 'ppm'), [resourceData]);
  const compoundResourceData = useMemo(() => resourceData.filter(d => d.category === 'compound'), [resourceData]);

  // One nodata layer per symbol: the picked candidate when it's nodata,
  // otherwise the first nodata candidate. Keeps the N/A placeholder bar tied
  // to the same layer the picker highlights as active.
  const representativeNodataBySymbol = useMemo(() => {
    const map = new Map<string, NodataSymbolCandidate>();
    nodataSymbolGroups.forEach((candidates, symbol) => {
      const preferredLayerName = activeDataset.get(symbol);
      map.set(symbol, candidates.find(c => c.layerName === preferredLayerName) ?? candidates[0]);
    });
    return map;
  }, [nodataSymbolGroups, activeDataset]);

  const nodataElementWtData = useMemo((): NodataResourceData[] => {
    const realSymbols = new Set(resourceData.map(d => d.symbol));
    const result: NodataResourceData[] = [];
    representativeNodataBySymbol.forEach(({ layerName, layerConfig }, symbol) => {
      if (realSymbols.has(symbol) || layerConfig.units === 'count_rate' || layerConfig.category === 'compound') return;
      const elementName = layerConfig.element ?? '';
      const range = ELEMENT_REFERENCE_RANGES[elementName];
      const units = range?.units ?? 'wt%';
      if (units !== 'wt%') return;
      result.push({ layerName, symbol, elementName, units });
    });
    return result;
  }, [representativeNodataBySymbol, resourceData]);

  const nodataElementPpmData = useMemo((): NodataResourceData[] => {
    const realSymbols = new Set(resourceData.map(d => d.symbol));
    const result: NodataResourceData[] = [];
    representativeNodataBySymbol.forEach(({ layerName, layerConfig }, symbol) => {
      if (realSymbols.has(symbol) || layerConfig.units === 'count_rate' || layerConfig.category === 'compound') return;
      const elementName = layerConfig.element ?? '';
      const range = ELEMENT_REFERENCE_RANGES[elementName];
      const units = range?.units ?? 'wt%';
      if (units !== 'ppm') return;
      result.push({ layerName, symbol, elementName, units });
    });
    return result;
  }, [representativeNodataBySymbol, resourceData]);

  const nodataCompoundLayerData = useMemo((): NodataResourceData[] => {
    const realSymbols = new Set(resourceData.map(d => d.symbol));
    const result: NodataResourceData[] = [];
    representativeNodataBySymbol.forEach(({ layerName, layerConfig }, symbol) => {
      if (realSymbols.has(symbol) || layerConfig.category !== 'compound') return;
      result.push({ layerName, symbol, elementName: layerConfig.compound ?? '', units: 'wt%' });
    });
    return result;
  }, [representativeNodataBySymbol, resourceData]);

  const nodataCountRateData = useMemo((): NodataResourceData[] => {
    return nodataLayerIds.flatMap(layerName => {
      const layerConfig = layersConfig.layers[layerName];
      if (layerConfig?.units !== 'count_rate') return [];
      const elementName = layerConfig.element ?? '';
      const symbol = elementName ? getElementSymbol(elementName) : layerName.substring(0, 2).toUpperCase();
      return [{ layerName, symbol, elementName, units: 'count_rate' }];
    });
  }, [nodataLayerIds]);

  const buildCandidateList = (symbol: string, units: string): DatasetCandidate[] => [
    ...(symbolGroups.get(symbol) ?? []).map(c => ({
      layerName: c.layerName,
      label: c.layerConfig.displayName ?? c.layerName,
      valueLabel: `${c.value.toFixed(2)} ${units}`,
    })),
    ...(nodataSymbolGroups.get(symbol) ?? []).map(c => ({
      layerName: c.layerName,
      label: c.layerConfig.displayName ?? c.layerName,
      valueLabel: 'No data here',
    })),
  ];

  // May be a nodata layer: the bar always falls back to a real value, but
  // the popover still highlights the actual picked candidate.
  const activeLayerNameFor = (symbol: string): string => {
    const realCandidates = symbolGroups.get(symbol) ?? [];
    const nodataCandidates = nodataSymbolGroups.get(symbol) ?? [];
    const defaultLayerName = realCandidates[0]?.layerName ?? nodataCandidates[0]?.layerName ?? symbol;
    return activeDataset.get(symbol) ?? defaultLayerName;
  };

  // A picker anchors to whichever bar is actually drawn for its symbol: the
  // real bar when at least one candidate currently has a value, otherwise
  // the dashed nodata placeholder (both are part of the same xScale domain).
  // This keeps the picker available even when every candidate for a symbol
  // is nodata at the current point, not only when some of them are.
  const buildPickers = (panelData: ResourceData[], panelNodataData: NodataResourceData[]): PickerInfo[] => {
    const pickers: PickerInfo[] = [];
    const handledSymbols = new Set<string>();

    panelData.forEach(d => {
      handledSymbols.add(d.symbol);
      const totalCandidates = (symbolGroups.get(d.symbol) ?? []).length + (nodataSymbolGroups.get(d.symbol) ?? []).length;
      if (totalCandidates < 2) return;
      pickers.push({
        symbol: d.symbol,
        layerName: d.layerName,
        activeLayerName: activeLayerNameFor(d.symbol),
        candidates: buildCandidateList(d.symbol, d.units),
      });
    });

    panelNodataData.forEach(nd => {
      if (handledSymbols.has(nd.symbol)) return;
      handledSymbols.add(nd.symbol);
      const totalCandidates = (symbolGroups.get(nd.symbol) ?? []).length + (nodataSymbolGroups.get(nd.symbol) ?? []).length;
      if (totalCandidates < 2) return;
      pickers.push({
        symbol: nd.symbol,
        layerName: nd.layerName,
        activeLayerName: activeLayerNameFor(nd.symbol),
        candidates: buildCandidateList(nd.symbol, nd.units),
      });
    });

    return pickers;
  };

  const elementWtPickers = useMemo(
    () => buildPickers(elementWtData, nodataElementWtData),
    [elementWtData, nodataElementWtData, symbolGroups, nodataSymbolGroups]
  );
  const elementPpmPickers = useMemo(
    () => buildPickers(elementPpmData, nodataElementPpmData),
    [elementPpmData, nodataElementPpmData, symbolGroups, nodataSymbolGroups]
  );
  const compoundPickers = useMemo(
    () => buildPickers(compoundResourceData, nodataCompoundLayerData),
    [compoundResourceData, nodataCompoundLayerData, symbolGroups, nodataSymbolGroups]
  );

  useEffect(() => {
    if (!svgElementWtRef.current || (elementWtData.length === 0 && nodataElementWtData.length === 0)) return;
    const hasPickers = elementWtPickers.length > 0;
    if (
      !elementWtScalesRef.current ||
      !shallowEqualNodataLayers(prevNodataElementWt.current, nodataElementWtData) ||
      prevHasPickersElementWt.current !== hasPickers
    ) {
      prevNodataElementWt.current = nodataElementWtData;
      prevHasPickersElementWt.current = hasPickers;
      const marginBottom = hasPickers ? CHART_MARGIN_BOTTOM_WITH_PICKER : CHART_MARGIN_BOTTOM_DEFAULT;
      elementWtScalesRef.current = renderBarsPanel(svgElementWtRef.current, elementWtData, nodataElementWtData, d => d.color, '#e0e0e0', marginBottom);
      setElementWtPositions(computePickerPositions(elementWtPickers, elementWtScalesRef.current));
    } else {
      updateBarsOnly(svgElementWtRef.current, elementWtData, '#e0e0e0');
    }
  }, [elementWtData, nodataElementWtData, elementWtPickers]);

  useEffect(() => {
    if (!svgElementPpmRef.current || (elementPpmData.length === 0 && nodataElementPpmData.length === 0)) return;
    const getColor = (d: ResourceData) => ppmColorScale(1 - d.continuousPosition);
    const hasPickers = elementPpmPickers.length > 0;
    if (
      !elementPpmScalesRef.current ||
      !shallowEqualNodataLayers(prevNodataElementPpm.current, nodataElementPpmData) ||
      prevHasPickersElementPpm.current !== hasPickers
    ) {
      prevNodataElementPpm.current = nodataElementPpmData;
      prevHasPickersElementPpm.current = hasPickers;
      const marginBottom = hasPickers ? CHART_MARGIN_BOTTOM_WITH_PICKER : CHART_MARGIN_BOTTOM_DEFAULT;
      elementPpmScalesRef.current = renderBarsPanel(svgElementPpmRef.current, elementPpmData, nodataElementPpmData, getColor, '#e0e0e0', marginBottom);
      setElementPpmPositions(computePickerPositions(elementPpmPickers, elementPpmScalesRef.current));
    } else {
      updateBarsOnly(svgElementPpmRef.current, elementPpmData, '#e0e0e0');
    }
  }, [elementPpmData, nodataElementPpmData, elementPpmPickers, ppmColorScale]);

  useEffect(() => {
    if (!svgCompoundRef.current || (compoundResourceData.length === 0 && nodataCompoundLayerData.length === 0)) return;
    const getColor = (d: ResourceData) => compoundColorScale(1 - d.continuousPosition);
    const hasPickers = compoundPickers.length > 0;
    if (
      !compoundScalesRef.current ||
      !shallowEqualNodataLayers(prevNodataCompound.current, nodataCompoundLayerData) ||
      prevHasPickersCompound.current !== hasPickers
    ) {
      prevNodataCompound.current = nodataCompoundLayerData;
      prevHasPickersCompound.current = hasPickers;
      const marginBottom = hasPickers ? CHART_MARGIN_BOTTOM_WITH_PICKER : CHART_MARGIN_BOTTOM_DEFAULT;
      compoundScalesRef.current = renderBarsPanel(svgCompoundRef.current, compoundResourceData, nodataCompoundLayerData, getColor, '#e0e0e0', marginBottom);
      setCompoundPositions(computePickerPositions(compoundPickers, compoundScalesRef.current));
    } else {
      updateBarsOnly(svgCompoundRef.current, compoundResourceData, '#e0e0e0');
    }
  }, [compoundResourceData, nodataCompoundLayerData, compoundPickers, compoundColorScale]);

  const renderPickers = (pickers: PickerInfo[], positions: Record<string, PickerPosition>) =>
    pickers.map(picker => {
      const position = positions[picker.symbol];
      if (!position) return null;
      return (
        <ElementDatasetPicker
          key={picker.symbol}
          symbolLabel={picker.symbol}
          candidates={picker.candidates}
          activeLayerName={picker.activeLayerName}
          onSelect={layerName => selectDataset(picker.symbol, layerName)}
          style={{ left: position.x, top: position.y }}
        />
      );
    });

  return (
    <div
      ref={containerRef}
      className={`${styles.resourceBarsVisualizer}${isPaused ? ` ${styles.paused}` : ''}`}
    >

      {(elementWtData.length > 0 || nodataElementWtData.length > 0) && (
        <>
          <div className={styles.panelHeader}>
            <span className={`${styles.panelTitle} ${styles.wt}`}>Major Elements</span>
            <div className={styles.panelRule} />
            <span className={`${styles.unitBadge} ${styles.wt}`}>wt%</span>
          </div>
          <div className={styles.svgWrapper}>
            <svg ref={svgElementWtRef} width={width} height={PANEL_HEIGHT} />
            {renderPickers(elementWtPickers, elementWtPositions)}
          </div>
        </>
      )}

      {(elementPpmData.length > 0 || nodataElementPpmData.length > 0) && (
        <>
          <div className={styles.panelSep} />
          <div className={styles.panelHeader}>
            <span className={`${styles.panelTitle} ${styles.ppm}`}>Trace Elements</span>
            <div className={styles.panelRule} />
            <span className={`${styles.unitBadge} ${styles.ppm}`}>ppm</span>
          </div>
          <div className={styles.svgWrapper}>
            <svg ref={svgElementPpmRef} width={width} height={PANEL_HEIGHT} />
            {renderPickers(elementPpmPickers, elementPpmPositions)}
          </div>
        </>
      )}

      {(compoundResourceData.length > 0 || nodataCompoundLayerData.length > 0) && (
        <>
          {(elementWtData.length > 0 || nodataElementWtData.length > 0 ||
            elementPpmData.length > 0 || nodataElementPpmData.length > 0) && (
            <div className={styles.panelSep} />
          )}
          <div className={styles.panelHeader}>
            <span className={`${styles.panelTitle} ${styles.wt}`}>Compounds</span>
            <div className={styles.panelRule} />
            <span className={`${styles.unitBadge} ${styles.wt}`}>wt%</span>
          </div>
          <div className={styles.svgWrapper}>
            <svg ref={svgCompoundRef} width={width} height={PANEL_HEIGHT} />
            {renderPickers(compoundPickers, compoundPositions)}
          </div>
        </>
      )}

      {(countRateData.length > 0 || nodataCountRateData.length > 0) && (
        <>
          <div className={styles.panelSep} />
          <div className={styles.panelHeader}>
            <span className={`${styles.panelTitle} ${styles.countRate}`}>Spatial Signal</span>
            <div className={styles.panelRule} />
            <span className={`${styles.unitBadge} ${styles.countRate}`}>count rate</span>
          </div>
          <div className={styles.countRateRows}>
            {countRateData.map(d => (
              <div key={d.layerName} className={styles.countRateRow}>
                <span className={styles.countRateSymbol}>{d.symbol}</span>
                <span className={styles.countRateLabel}>{d.displayName}</span>
                <span className={styles.countRateValue}>{d.value.toFixed(4)}</span>
              </div>
            ))}
            {nodataCountRateData.map(d => (
              <div key={d.layerName} className={`${styles.countRateRow} ${styles.countRateRowNodata}`}>
                <span className={`${styles.countRateSymbol} ${styles.nodataMuted}`}>{d.symbol}</span>
                <span className={styles.countRateLabel}>{d.elementName}</span>
                <span className={`${styles.countRateValue} ${styles.nodataMuted}`}>—</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* terrainClassification display disabled */}
    </div>
  );
};
