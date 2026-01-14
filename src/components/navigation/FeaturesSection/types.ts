import * as Cesium from 'cesium';

export interface Feature {
  id: string;
  type: 'point' | 'line' | 'polygon' | 'circle' | 'two-point-circle' | 'three-point-circle';
  name: string;
  entity: Cesium.Entity;
  metadata: {
    position?: Cesium.Cartographic;
    positions?: Cesium.Cartographic[];
    createdAt: Date;
  };
  insightsOpen: boolean;
  visible: boolean;
}
