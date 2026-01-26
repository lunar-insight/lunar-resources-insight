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
  };
  insightsOpen: boolean;
  visible: boolean;
}
