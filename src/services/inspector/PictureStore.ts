import { layersConfig } from 'geoConfigExporter';
import type { Feature } from 'components/navigation/FeaturesSection/types';
import { layerStatsService } from 'services/LayerStatsService';
import { featureCenter, featureKind, geometryKey, shapeRing } from './featureGeometry';
import type { LineFile } from './inspectorLayers';
import { fetchFilePixelKm, fetchPicture, type PicturePixels } from './inspectorRequests';
import { pointView, shapeView, type View } from './pictureGeometry';
import type { ValueRange } from './pictureValues';
import { CanceledError, type RequestQueue } from './RequestQueue';

export type PictureKind = 'data' | 'terrain';

export interface LoadedPicture extends PicturePixels {
  view: View;
  /** The values gray levels 0 to 255 stand for. */
  range: ValueRange;
}

export interface PictureEntry {
  status: 'waiting' | 'loading' | 'ready' | 'failed';
  picture?: LoadedPicture;
}

export interface PictureDependencies {
  fetchPicture: typeof fetchPicture;
  fetchFilePixelKm: typeof fetchFilePixelKm;
  /** The file's whole Moon range, the picture's rescale. Rejects when it stays unavailable. */
  fetchMoonRange: (filename: string) => Promise<ValueRange>;
}

/** The last pictures kept in memory, 253 KB each. */
export const PICTURES_KEPT = 50;

/** The terrain is a byte file, read with no rescale. */
const TERRAIN_RANGE: ValueRange = [0, 255];

async function fetchMoonRange(filename: string): Promise<ValueRange> {
  let stats = layerStatsService.getFileStats(filename);
  if (!stats.loaded) {
    await layerStatsService.retryMissing([filename]);
    stats = layerStatsService.getFileStats(filename);
  }
  if (!stats.loaded) throw new Error(`No whole Moon statistics for ${filename}`);
  return [stats.min, stats.max];
}

export const DEFAULT_DEPENDENCIES: PictureDependencies = { fetchPicture, fetchFilePixelKm, fetchMoonRange };

export const pictureKey = (feature: Feature, file: LineFile, kind: PictureKind) =>
  `${feature.id}|${geometryKey(feature)}|${file.filename}|${kind}`;

function viewOf(feature: Feature, filePixelKm: number): View {
  const center = featureCenter(feature);
  if (!center) throw new Error(`Feature ${feature.id} has no position`);
  if (featureKind(feature.type) === 'point') return pointView(center, filePixelKm);
  const ring = shapeRing(feature);
  if (!ring) throw new Error(`Feature ${feature.id} has no outline`);
  return shapeView(ring, center, filePixelKm);
}

interface Held {
  entry: PictureEntry;
  featureId: string;
  /** Identifies the latest request, so an earlier one finishing changes nothing. */
  run: number;
  load: () => void;
}

/**
 * The pictures shown in the popovers. Requests go through the queue of the tile
 * instance, ahead of queued statistics and grouped by feature, so they wait while
 * the camera moves and a feature's cancel aborts them.
 */
export class PictureStore {
  private held = new Map<string, Held>();
  private listeners = new Set<() => void>();
  private version = 0;
  private runCounter = 0;

  constructor(
    private readonly queue: RequestQueue,
    private readonly deps: PictureDependencies = DEFAULT_DEPENDENCIES,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getVersion = (): number => this.version;

  get(key: string): PictureEntry | undefined {
    return this.held.get(key)?.entry;
  }

  /** Starts the picture unless held. A terrain picture shows the ground of the file's picture. */
  request(feature: Feature, file: LineFile, kind: PictureKind): void {
    const key = pictureKey(feature, file, kind);
    const known = this.held.get(key);
    if (known) {
      // The most recently asked for goes last, so it is dropped last
      this.held.delete(key);
      this.held.set(key, known);
      return;
    }

    const held: Held = {
      entry: { status: 'loading' },
      featureId: feature.id,
      run: 0,
      load: () => this.load(key, held, feature, file, kind),
    };
    this.held.set(key, held);
    held.load();
  }

  /** Requests a failed picture again. */
  retry(key: string): void {
    this.held.get(key)?.load();
  }

  dropFeature(featureId: string): void {
    let dropped = false;
    this.held.forEach((held, key) => {
      if (held.featureId !== featureId) return;
      this.held.delete(key);
      dropped = true;
    });
    if (dropped) this.notify();
  }

  private load(key: string, held: Held, feature: Feature, file: LineFile, kind: PictureKind): void {
    const run = ++this.runCounter;
    held.run = run;
    const isCurrent = () => this.held.get(key) === held && held.run === run;
    const set = (entry: PictureEntry) => {
      held.entry = entry;
      this.notify();
    };

    set({ status: this.queue.isPaused() ? 'waiting' : 'loading' });

    this.queue.run(feature.id, async signal => {
      if (isCurrent()) set({ status: 'loading' });
      const view = viewOf(feature, await this.deps.fetchFilePixelKm(file.filename));
      if (kind === 'terrain') {
        const pixels = await this.deps.fetchPicture(layersConfig.layers.lroc_wac_basemap.filename, view, null, signal);
        return { ...pixels, view, range: TERRAIN_RANGE };
      }
      const range = await this.deps.fetchMoonRange(file.filename);
      const pixels = await this.deps.fetchPicture(file.filename, view, range, signal);
      return { ...pixels, view, range };
    }, { front: true }).then(
      picture => {
        if (!isCurrent()) return;
        set({ status: 'ready', picture });
        this.dropOldest();
      },
      error => {
        if (!isCurrent()) return;
        if (error instanceof CanceledError) {
          this.held.delete(key);
          this.notify();
          return;
        }
        console.error(`Inspector picture failed for ${file.filename}:`, error);
        set({ status: 'failed' });
        this.dropOldest();
      },
    );
  }

  private dropOldest(): void {
    const settled = [...this.held].filter(([, held]) => held.entry.status === 'ready' || held.entry.status === 'failed');
    settled.slice(0, Math.max(0, settled.length - PICTURES_KEPT)).forEach(([key]) => this.held.delete(key));
  }

  private notify(): void {
    this.version++;
    this.listeners.forEach(listener => listener());
  }
}
