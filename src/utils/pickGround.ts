import * as Cesium from 'cesium';

/**
 * The ground point under a screen position: on the terrain tiles drawn, or on
 * the ellipsoid where no tile answers. The ellipsoid alone lies off the
 * terrain wherever the terrain is above or below it, which in a tilted view
 * is far from the point under the cursor.
 */
export function pickGround(viewer: Cesium.CesiumWidget, screenPosition: Cesium.Cartesian2): Cesium.Cartesian3 | undefined {
  const ray = viewer.camera.getPickRay(screenPosition);
  const onTerrain = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
  return onTerrain ?? viewer.camera.pickEllipsoid(screenPosition, viewer.scene.globe.ellipsoid);
}
