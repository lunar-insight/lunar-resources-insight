import type { Feature } from 'components/navigation/FeaturesSection/types';
import {
  boundsIntersect,
  featureAreaKm2,
  featureCenter,
  featureKind,
  geometryKey,
  gridInsideRing,
  isInsideBounds,
  ringBounds,
  ringToGeoJson,
  sampleLine,
  shapeRing,
  type FeatureKind,
  type LineSample,
  type LonLat,
} from './featureGeometry';
import { fileForLatitude, inspectorLines, type InspectorLine, type LineFile } from './inspectorLayers';
import {
  formatExtent,
  formatPolarExtent,
  statisticsOfSamples,
  type FeatureStatistics,
  type NoDataReason,
} from './inspectorStatistics';
import {
  fetchFileBounds,
  fetchPointValues,
  fetchResolutionKm,
  fetchShapeStatistics,
  sampleElevation,
  type Elevation,
} from './inspectorRequests';
import { CanceledError, RequestQueue } from './RequestQueue';

export interface LineResult {
  file: LineFile;
  /** Point value, or the average over a shape or along a line. */
  value?: number;
  stats?: FeatureStatistics;
  noData?: NoDataReason;
  /** The dataset's extent in words, for "No data" outside it. */
  extent?: string;
  /** The request for this line failed after its retry. */
  failed?: boolean;
  resolutionKm?: number;
  /** Values at each sample of a line feature, null where the dataset has no data. */
  profile?: (number | null)[];
}

export interface FeatureResults {
  featureId: string;
  geometryKey: string;
  kind: FeatureKind;
  status: 'computing' | 'ready';
  /** Dataset lines finished, out of `total`. */
  done: number;
  total: number;
  lines: Record<string, LineResult>;
  /** Requests that failed after their retry. */
  failedRequests: number;
  center?: LonLat;
  areaKm2?: number;
  samples?: LineSample[];
  /** Undefined while sampling, null without terrain. */
  elevation?: Elevation | null;
}

export interface InspectorDependencies {
  lines: InspectorLine[];
  fetchBounds: (filename: string, stac?: string) => Promise<number[]>;
  fetchResolution: (stac?: string) => Promise<number | undefined>;
  fetchPointValues: (filenames: string[], position: LonLat, signal?: AbortSignal) => Promise<Map<string, number | null>>;
  fetchShapeStatistics: (filename: string, geojson: object, signal?: AbortSignal) => Promise<FeatureStatistics | null>;
  sampleElevation: (positions: LonLat[]) => Promise<Elevation | null>;
  /** Shape requests share the tile instance: at most 4 at once, paused while the camera moves. */
  areaQueue: RequestQueue;
  /** Line samples go to the point instance, which the scanner shares. */
  sampleQueue: RequestQueue;
  /** A geometry edit recomputes once no further edit arrives for this long. */
  editSettleMs: number;
}

const GLOBAL_BOUNDS = [-180, -90, 180, 90];

export const defaultDependencies = (): InspectorDependencies => ({
  lines: inspectorLines,
  fetchBounds: fetchFileBounds,
  fetchResolution: fetchResolutionKm,
  fetchPointValues,
  fetchShapeStatistics,
  sampleElevation,
  areaQueue: new RequestQueue(4),
  // The point instance answers one batch at a time, so sending more at once is
  // no faster and makes the scanner wait behind each of them.
  sampleQueue: new RequestQueue(1),
  editSettleMs: 600,
});

interface LineTarget {
  line: InspectorLine;
  file: LineFile;
  bounds: number[];
  extent: string;
}

/**
 * Statistics for every saved feature, computed in the background as soon as
 * the feature exists and kept until it is deleted. A geometry edit recomputes
 * once the edit settles.
 */
export class InspectorStore {
  private results = new Map<string, FeatureResults>();
  private computedKeys = new Map<string, string>();
  private latestFeatures = new Map<string, Feature>();
  private editTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private runs = new Map<string, number>();
  private runCounter = 0;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(private readonly deps: InspectorDependencies = defaultDependencies()) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getVersion = (): number => this.version;

  get(featureId: string): FeatureResults | undefined {
    return this.results.get(featureId);
  }

  /** Starts new features, schedules edited ones, drops deleted ones. */
  sync(features: Feature[]): void {
    const ids = new Set(features.map(feature => feature.id));
    [...this.computedKeys.keys()].filter(id => !ids.has(id)).forEach(id => this.drop(id));

    features.forEach(feature => {
      const key = geometryKey(feature);
      const known = this.computedKeys.get(feature.id);
      this.latestFeatures.set(feature.id, feature);
      if (known === undefined) {
        this.computedKeys.set(feature.id, key);
        this.start(feature);
      } else if (known !== key) {
        this.computedKeys.set(feature.id, key);
        this.scheduleEdit(feature.id);
      }
    });
  }

  retry(featureId: string): void {
    const feature = this.latestFeatures.get(featureId);
    if (feature) this.start(feature);
  }

  pauseAreas(): void {
    this.deps.areaQueue.pause();
  }

  resumeAreas(): void {
    this.deps.areaQueue.resume();
  }

  dispose(): void {
    [...this.computedKeys.keys()].forEach(id => this.drop(id));
    this.listeners.clear();
  }

  private notify(): void {
    this.version++;
    this.listeners.forEach(listener => listener());
  }

  private drop(featureId: string): void {
    this.cancel(featureId);
    this.results.delete(featureId);
    this.computedKeys.delete(featureId);
    this.latestFeatures.delete(featureId);
    this.runs.delete(featureId);
    this.notify();
  }

  private cancel(featureId: string): void {
    clearTimeout(this.editTimers.get(featureId));
    this.editTimers.delete(featureId);
    this.deps.areaQueue.cancelGroup(featureId);
    this.deps.sampleQueue.cancelGroup(featureId);
  }

  private scheduleEdit(featureId: string): void {
    clearTimeout(this.editTimers.get(featureId));
    this.editTimers.set(featureId, setTimeout(() => {
      this.editTimers.delete(featureId);
      const feature = this.latestFeatures.get(featureId);
      if (feature) this.start(feature);
    }, this.deps.editSettleMs));
  }

  private start(feature: Feature): void {
    this.cancel(feature.id);
    const run = ++this.runCounter;
    this.runs.set(feature.id, run);

    const kind = featureKind(feature.type);
    this.results.set(feature.id, {
      featureId: feature.id,
      geometryKey: geometryKey(feature),
      kind,
      status: 'computing',
      done: 0,
      total: this.deps.lines.length,
      lines: {},
      failedRequests: 0,
    });
    this.notify();

    const isCurrent = () => this.runs.get(feature.id) === run;
    const update = (change: (current: FeatureResults) => Partial<FeatureResults>) => {
      const current = this.results.get(feature.id);
      if (!current || !isCurrent()) return;
      this.results.set(feature.id, { ...current, ...change(current) });
      this.notify();
    };

    const computation = kind === 'point' ? this.computePoint(feature, update)
      : kind === 'line' ? this.computeLine(feature, update)
      : this.computeShape(feature, update);

    computation
      .catch(error => {
        if (!(error instanceof CanceledError)) console.error(`Inspector computation failed for ${feature.id}:`, error);
      })
      .finally(() => update(() => ({ status: 'ready' })));
  }

  private async boundsOf(file: LineFile): Promise<number[]> {
    try {
      return await this.deps.fetchBounds(file.filename, file.stac);
    } catch {
      // Unknown bounds let the request decide whether the dataset has data there.
      return GLOBAL_BOUNDS;
    }
  }

  private async targets(latitude: number): Promise<LineTarget[]> {
    return Promise.all(this.deps.lines.map(async line => {
      const file = fileForLatitude(line, latitude);
      const allBounds = await Promise.all(line.files.map(f => this.boundsOf(f)));
      const bounds = allBounds[line.files.indexOf(file)];
      const extent = line.files.length > 1 ? formatPolarExtent(allBounds) : formatExtent(bounds);
      return { line, file, bounds, extent };
    }));
  }

  private elevation(positions: LonLat[], update: (change: () => Partial<FeatureResults>) => void): Promise<void> {
    return this.deps.sampleElevation(positions)
      .catch((): null => null)
      .then(elevation => update(() => ({ elevation })));
  }

  private async computePoint(feature: Feature, update: (change: (c: FeatureResults) => Partial<FeatureResults>) => void) {
    const center = featureCenter(feature);
    if (!center) return;
    update(() => ({ center }));
    const elevation = this.elevation([center], update);

    const targets = await this.targets(center.lat);
    const inside = targets.filter(t => isInsideBounds(center, t.bounds));
    const lines: Record<string, LineResult> = {};
    targets.filter(t => !inside.includes(t)).forEach(t => {
      lines[t.line.id] = { file: t.file, noData: 'outside', extent: t.extent };
    });

    let failedRequests = 0;
    try {
      const values = await this.deps.fetchPointValues(inside.map(t => t.file.filename), center);
      inside.forEach(t => {
        const value = values.get(t.file.filename);
        lines[t.line.id] = typeof value === 'number' ? { file: t.file, value } : { file: t.file, noData: 'inside' };
      });
    } catch (error) {
      console.error('Inspector point request failed:', error);
      failedRequests = 1;
      inside.forEach(t => { lines[t.line.id] = { file: t.file, failed: true }; });
    }

    update(() => ({ lines, done: targets.length, failedRequests }));
    await elevation;
  }

  private async computeShape(feature: Feature, update: (change: (c: FeatureResults) => Partial<FeatureResults>) => void) {
    const ring = shapeRing(feature);
    const center = featureCenter(feature);
    if (!ring || !center) return;

    const areaKm2 = featureAreaKm2(feature) ?? 0;
    update(() => ({ center, areaKm2 }));
    const elevation = this.elevation(gridInsideRing(ring), update);

    const geojson = ringToGeoJson(ring);
    const shapeBounds = ringBounds(ring);
    const setLine = (lineId: string, result: LineResult, failed = false) => update(current => ({
      lines: { ...current.lines, [lineId]: result },
      done: current.done + 1,
      failedRequests: current.failedRequests + (failed ? 1 : 0),
    }));

    const targets = await this.targets(center.lat);
    await Promise.all(targets.map(async ({ line, file, bounds, extent }) => {
      if (!boundsIntersect(shapeBounds, bounds)) {
        setLine(line.id, { file, noData: 'outside', extent });
        return;
      }
      try {
        const stats = await this.deps.areaQueue.run(feature.id, signal =>
          this.deps.fetchShapeStatistics(file.filename, geojson, signal));
        if (!stats) {
          setLine(line.id, { file, noData: 'inside', extent });
          return;
        }
        // Read after the statistics, so catalog requests stay paced by the queue
        const resolutionKm = await this.deps.fetchResolution(file.stac).catch((): undefined => undefined);
        setLine(line.id, { file, value: stats.mean, stats, resolutionKm });
      } catch (error) {
        if (error instanceof CanceledError) throw error;
        console.error(`Inspector shape request failed for ${file.filename}:`, error);
        setLine(line.id, { file, failed: true }, true);
      }
    }));

    await elevation;
  }

  private async computeLine(feature: Feature, update: (change: (c: FeatureResults) => Partial<FeatureResults>) => void) {
    const positions = feature.metadata.positions ?? [];
    const center = featureCenter(feature);
    if (positions.length < 2 || !center) return;

    const samples = sampleLine(positions);
    update(() => ({ center, samples }));
    const elevation = this.elevation(samples, update);

    const targets = await this.targets(center.lat);
    const profiles = new Map(targets.map(t => [t.line.id, new Array<number | null>(samples.length).fill(null)]));
    const total = targets.length;
    let finished = 0;
    let failedRequests = 0;

    await Promise.all(samples.map(async (sample, index) => {
      const inside = targets.filter(t => isInsideBounds(sample, t.bounds));
      try {
        if (inside.length > 0) {
          const values = await this.deps.sampleQueue.run(feature.id, signal =>
            this.deps.fetchPointValues(inside.map(t => t.file.filename), sample, signal));
          inside.forEach(t => {
            const value = values.get(t.file.filename);
            profiles.get(t.line.id)![index] = typeof value === 'number' ? value : null;
          });
        }
      } catch (error) {
        if (error instanceof CanceledError) throw error;
        failedRequests++;
      }
      finished++;
      update(() => ({ done: Math.floor((total * finished) / samples.length), failedRequests }));
    }));

    const allFailed = failedRequests === samples.length;
    const lines: Record<string, LineResult> = {};
    targets.forEach(({ line, file, bounds, extent }) => {
      const profile = profiles.get(line.id)!;
      if (allFailed) {
        lines[line.id] = { file, failed: true };
        return;
      }
      const stats = statisticsOfSamples(profile);
      if (stats) {
        lines[line.id] = { file, value: stats.mean, stats, profile };
      } else {
        const reaches = samples.some(sample => isInsideBounds(sample, bounds));
        lines[line.id] = { file, noData: reaches ? 'inside' : 'outside', extent, profile };
      }
    });

    update(() => ({ lines, done: total }));
    await elevation;
  }
}
