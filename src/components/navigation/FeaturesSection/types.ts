import * as Cesium from 'cesium';

export interface Feature {
  id: string;
  type: 'point' | 'line' | 'polygon' | 'circle' | 'two-point-circle' | 'three-point-circle';
  name: string;
  entity: Cesium.Entity;
  color: string;
  metadata: {
    position?: Cesium.Cartographic;
    positions?: Cesium.Cartographic[];
    center?: Cesium.Cartographic;
    centerPosition?: Cesium.Cartographic;
    radius?: number;
    edgePosition?: Cesium.Cartographic;
    diameterEndpoints?: Cesium.Cartographic[];
    circumferencePoints?: Cesium.Cartographic[];
    createdAt: Date;
    /** Identifies the search result this feature was created from, if any (used to detect "already saved" results). Cleared when the point is dragged, since it's no longer "at" that result's coordinate. */
    sourceId?: string;
    autoNamedFromCoordinate?: boolean;
  };
  insightsOpen: boolean;
  visible: boolean;
}
