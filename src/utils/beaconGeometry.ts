import * as Cesium from 'cesium';

// Target apparent height, in screen pixels, for a beacon line regardless of
// camera distance. The real-world offset is clamped between
// BEACON_MIN_METERS and BEACON_MAX_METERS so it stays a sane visible size at
// any zoom level.
const BEACON_TARGET_PIXELS = 32;
const BEACON_MIN_METERS = 2;
const BEACON_MAX_METERS = 50000;

// Point offset upward from a ground position along the local surface
// normal, scaled so it projects to roughly BEACON_TARGET_PIXELS on screen at
// the current camera distance.
export const computeBeaconTopPosition = (
  viewer: Cesium.Viewer,
  groundCartesian: Cesium.Cartesian3
): Cesium.Cartesian3 => {
  const ellipsoid = viewer.scene.globe.ellipsoid;
  const normal = ellipsoid.geodeticSurfaceNormal(groundCartesian, new Cesium.Cartesian3());

  const metersPerPixel = viewer.camera.getPixelSize(
    new Cesium.BoundingSphere(groundCartesian, 0),
    viewer.scene.drawingBufferWidth,
    viewer.scene.drawingBufferHeight
  );
  const heightMeters = Cesium.Math.clamp(metersPerPixel * BEACON_TARGET_PIXELS, BEACON_MIN_METERS, BEACON_MAX_METERS);

  return Cesium.Cartesian3.add(
    groundCartesian,
    Cesium.Cartesian3.multiplyByScalar(normal, heightMeters, new Cesium.Cartesian3()),
    new Cesium.Cartesian3()
  );
};

// Positions a beacon's wrapper element at the ground point's screen
// projection and points its SVG line element at the top point's screen
// projection, relative to that origin. Hides the wrapper when the ground
// point itself doesn't project (off-screen or behind the globe); collapses
// the line to a dot when only the top point fails to project.
export const applyBeaconProjection = (
  wrapperElement: HTMLElement,
  lineElement: SVGLineElement,
  groundScreen: Cesium.Cartesian2 | undefined,
  topScreen: Cesium.Cartesian2 | undefined
): void => {
  if (!groundScreen) {
    wrapperElement.style.display = 'none';
    return;
  }

  wrapperElement.style.display = '';
  wrapperElement.style.transform = `translate(${groundScreen.x}px, ${groundScreen.y}px)`;

  if (topScreen) {
    lineElement.setAttribute('x2', String(topScreen.x - groundScreen.x));
    lineElement.setAttribute('y2', String(topScreen.y - groundScreen.y));
  } else {
    lineElement.setAttribute('x2', '0');
    lineElement.setAttribute('y2', '0');
  }
};
