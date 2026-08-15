import React, { useMemo } from 'react';
import { DERIVED_INDEX_BY_LAYER_ID } from 'components/navigation/submenu/DerivedIndices/data';
import { layersConfig } from 'geoConfigExporter';
import { useLayerContext } from 'utils/context/LayerContext';
import { colormapService } from 'services/ColormapService';
import { layerStatsService } from 'services/LayerStatsService';
import styles from './DerivedIndexVisualizer.module.scss';

export function normalizePosition(value: number, range: [number, number]): number {
  const [min, max] = range;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

interface DerivedIndexVisualizerProps {
  values: { [layerId: string]: number };
  nodataLayerIds?: string[];
  unavailableLayerIds?: string[];
  width?: number;
}

interface DerivedIndexRow {
  layerId: string;
  displayName: string;
  lowLabel: string;
  highLabel: string;
  value: number | null;
  position: number | null;
  gradientUrl: string;
  // True when the layer's request failed, so no reading exists for this point.
  // False when the server reported no data at the point.
  isUnavailable: boolean;
}

interface RowProps {
  row: DerivedIndexRow;
}

const Row: React.FC<RowProps> = ({ row }) => {
  const isNodata = row.value === null;

  return (
    <div className={`${styles.row} ${isNodata ? styles.rowNodata : ''}`}>
      <div className={styles.labelRow}>
        <div className={styles.rowLabel}>{row.displayName}</div>
        {!isNodata && (
          <span className={styles.value}>{row.value!.toFixed(3)}</span>
        )}
      </div>

      <div className={styles.trackWrapper}>
        <span className={styles.lowLabel}>{row.lowLabel}</span>

        <div className={styles.trackContainer}>
          <div
            className={styles.track}
            style={{ backgroundImage: `url('${row.gradientUrl}')` }}
          />

          {!isNodata && row.position !== null && (
            <div
              className={styles.marker}
              style={{ left: `${row.position * 100}%` }}
              aria-label={`Value: ${row.value?.toFixed(3)}`}
            />
          )}

          {isNodata && (
            <span className={styles.nodataLabel}>{row.isUnavailable ? '?' : 'N/A'}</span>
          )}
        </div>

        <span className={styles.highLabel}>{row.highLabel}</span>
      </div>
    </div>
  );
};

export const DerivedIndexVisualizer: React.FC<DerivedIndexVisualizerProps> = ({
  values,
  nodataLayerIds = [],
  unavailableLayerIds = [],
  width,
}) => {
  const { getLayerStyle } = useLayerContext();

  const rows = useMemo((): DerivedIndexRow[] => {
    const getRange = (layerId: string): [number, number] => {
      const style = getLayerStyle(layerId);
      const stats = layerStatsService.getLayerStats(layerId);
      const min = style?.min ?? stats.min;
      const max = style?.max ?? stats.max;
      return [min, max];
    };

    const activeRows = Object.entries(values).flatMap(([layerId, value]) => {
      const meta = DERIVED_INDEX_BY_LAYER_ID[layerId];
      if (!meta) return [];
      const raw = layersConfig.layers[layerId]?.displayName ?? layerId;
      const displayName = raw.split('·')[0].trim();
      const position = normalizePosition(value, getRange(layerId));
      const gradientUrl = colormapService.getGradientUrl(getLayerStyle(layerId)?.type ?? 'gray');
      return [{ layerId, displayName, lowLabel: meta.lowLabel, highLabel: meta.highLabel, value, position, gradientUrl, isUnavailable: false }];
    });

    const buildValuelessRow = (layerId: string, isUnavailable: boolean): DerivedIndexRow[] => {
      const meta = DERIVED_INDEX_BY_LAYER_ID[layerId];
      if (!meta) return [];
      const raw = layersConfig.layers[layerId]?.displayName ?? layerId;
      const displayName = raw.split('·')[0].trim();
      const gradientUrl = colormapService.getGradientUrl(getLayerStyle(layerId)?.type ?? 'gray');
      const row: DerivedIndexRow = { layerId, displayName, lowLabel: meta.lowLabel, highLabel: meta.highLabel, value: null, position: null, gradientUrl, isUnavailable };
      return [row];
    };

    const nodataRows = nodataLayerIds.flatMap(layerId => buildValuelessRow(layerId, false));
    const unavailableRows = unavailableLayerIds.flatMap(layerId => buildValuelessRow(layerId, true));

    return [...activeRows, ...nodataRows, ...unavailableRows];
  }, [values, nodataLayerIds, unavailableLayerIds, getLayerStyle]);

  if (rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No derived index layers active.</p>
        <small>Select a layer from Derived Indices to begin.</small>
      </div>
    );
  }

  return (
    <div className={styles.visualizer} style={width ? { width } : undefined}>
      {rows.map(row => (
        <Row key={row.layerId} row={row} />
      ))}
    </div>
  );
};
