// Fixtures shared by the Inspector component tests.
import * as Cesium from 'cesium';
import type { Feature } from 'components/navigation/FeaturesSection/types';
import type { LayerStats } from 'services/LayerStatsService';
import type { InspectorStore, FeatureResults, LineResult } from 'services/inspector/InspectorStore';
import { inspectorLines } from 'services/inspector/inspectorLayers';
import type { FeatureStatistics } from 'services/inspector/inspectorStatistics';

export const moonStats: LayerStats = {
  min: 0, max: 100,
  percentile_2: 2, percentile_15: 10, percentile_85: 30, percentile_95: 60, percentile_98: 80,
  loaded: true,
};

export const shapeStats = (mean: number, overrides: Partial<FeatureStatistics> = {}): FeatureStatistics => ({
  mean, median: mean, std: 1, min: mean - 4, max: mean + 4, p15: mean - 1, p85: mean + 1, count: 100, coverage: 100,
  ...overrides,
});

export const deg = (lon: number, lat: number) => Cesium.Cartographic.fromDegrees(lon, lat);

export const makeFeature = (overrides: Partial<Feature> & Pick<Feature, 'id' | 'type'>): Feature => ({
  name: overrides.id,
  entity: {} as Cesium.Entity,
  color: '#f2c14e',
  metadata: { createdAt: new Date(0) },
  inspectorOpen: true,
  visible: true,
  ...overrides,
});

/** Ready results holding a value on every line, with per-line overrides. */
export function makeResults(
  kind: FeatureResults['kind'],
  overrides: Record<string, Partial<LineResult>> = {},
  extra: Partial<FeatureResults> = {},
): FeatureResults {
  const lines: Record<string, LineResult> = {};
  inspectorLines.forEach((line, index) => {
    const value = 10 + index;
    lines[line.id] = {
      file: line.files[0],
      value,
      ...(kind === 'point' ? {} : { stats: shapeStats(value) }),
      ...(kind === 'line' ? { profile: [value - 1, null, value, value + 1] } : {}),
      ...overrides[line.id],
    };
  });
  return {
    featureId: 'f',
    geometryKey: 'k',
    kind,
    status: 'ready',
    done: inspectorLines.length,
    total: inspectorLines.length,
    lines,
    failedRequests: 0,
    areaKm2: 1e6,
    ...(kind === 'line' ? {
      samples: [0, 1, 2, 4].map(distanceKm => ({ distanceKm, lon: 0, lat: 0 })),
    } : {}),
    ...extra,
  };
}

/** A store answering from a fixed map of results. */
export function fakeStore(results: Record<string, FeatureResults | undefined> = {}) {
  const listeners = new Set<() => void>();
  let version = 0;
  const store = {
    entries: results,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getVersion: () => version,
    get: (id: string) => store.entries[id],
    set(id: string, value: FeatureResults | undefined) {
      store.entries[id] = value;
      version++;
      listeners.forEach(listener => listener());
    },
    sync: vi.fn(),
    retry: vi.fn(),
    pauseAreas: vi.fn(),
    resumeAreas: vi.fn(),
    dispose: vi.fn(),
  };
  return store as typeof store & InspectorStore;
}
