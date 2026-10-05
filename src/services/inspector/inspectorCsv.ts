import type { Feature } from 'components/navigation/FeaturesSection/types';
import type { FeatureResults, LineResult } from './InspectorStore';
import type { InspectorLine } from './inspectorLayers';
import { SHAPE_MAX_SIZE } from './inspectorRequests';
import { shapeWord } from './featureGeometry';

type Cell = string | number | null | undefined;

function escapeCell(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  const text = typeof cell === 'number' ? (Number.isFinite(cell) ? String(cell) : '') : cell;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map(row => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

const STATISTICS_HEADER = [
  'Symbol', 'Name', 'Dataset', 'Variant', 'Unit', 'Status',
  'Average', 'Median', 'Std dev', 'Lowest', 'Highest', 'P15', 'P85',
  'Count', 'Coverage (%)', 'Read at',
];

function status(result?: LineResult): string {
  if (!result) return 'not computed';
  if (result.failed) return 'failed';
  if (result.noData) return 'no data';
  return 'ok';
}

// Shape statistics come from an overview capped in size; a point reads the file itself.
function readAt(kind: FeatureResults['kind'], result?: LineResult): string {
  if (!result || result.value === undefined) return '';
  if (kind === 'point') return 'full resolution';
  if (kind === 'line') return `${result.profile?.length ?? 0} point samples`;
  return `overview capped at ${SHAPE_MAX_SIZE} px`;
}

function statisticsRow(line: InspectorLine, kind: FeatureResults['kind'], result?: LineResult): Cell[] {
  const stats = result?.stats;
  return [
    line.symbol, line.cardName, line.datasetLabel, line.variantLabel, line.unit, status(result),
    result?.value, stats?.median, stats?.std, stats?.min, stats?.max, stats?.p15, stats?.p85,
    stats?.count, stats?.coverage, readAt(kind, result),
  ];
}

/** One row per dataset line: the full statistics of a point, a shape, or a line's samples. */
export function statisticsCsv(lines: InspectorLine[], results: FeatureResults): string {
  return toCsv([
    STATISTICS_HEADER,
    ...lines.map(line => statisticsRow(line, results.kind, results.lines[line.id])),
  ]);
}

/** Column heading of a dataset line in the profile, since one symbol can have several datasets. */
export function profileHeading(line: InspectorLine): string {
  const name = [line.symbol, line.datasetLabel, line.variantLabel].filter(Boolean).join(' · ');
  return line.unit ? `${name} (${line.unit})` : name;
}

/** One row per sample of a line feature, one column per dataset line. */
export function profileCsv(lines: InspectorLine[], results: FeatureResults): string {
  const samples = results.samples ?? [];
  return toCsv([
    ['Distance (km)', 'Latitude', 'Longitude', ...lines.map(profileHeading)],
    ...samples.map((sample, index) => [
      sample.distanceKm, sample.lat, sample.lon,
      ...lines.map(line => results.lines[line.id]?.profile?.[index] ?? null),
    ]),
  ]);
}

/** The statistics of every compared feature, one row per feature and dataset line. */
export function comparisonCsv(
  lines: InspectorLine[],
  features: { feature: Feature; results?: FeatureResults }[],
): string {
  return toCsv([
    ['Feature', 'Type', ...STATISTICS_HEADER],
    ...features.flatMap(({ feature, results }) => lines.map(line => [
      feature.name,
      shapeWord(feature.type),
      ...statisticsRow(line, results?.kind ?? 'point', results?.lines[line.id]),
    ])),
  ]);
}

/** File name from a feature name: lowercase words joined by dashes. */
export function csvFileName(name: string, suffix: string): string {
  const slug = name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'feature'}-${suffix}.csv`;
}

export function downloadCsv(fileName: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
