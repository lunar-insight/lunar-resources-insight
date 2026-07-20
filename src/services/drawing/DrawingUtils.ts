import * as Cesium from 'cesium';

/**
 * Shared utility functions for drawing services.
 * Contains common operations used across multiple drawing services.
 */
export class DrawingUtils {
  /**
   * Picks a position on the globe from screen coordinates.
   * Uses scene.pickPosition() first (which picks actual rendered terrain),
   * then falls back to camera.pickEllipsoid() if terrain picking fails.
   *
   * @param viewer - The Cesium viewer instance
   * @param screenPosition - The screen coordinates to pick from
   * @returns The picked 3D position, or null if picking failed
   */
  static pickGlobePosition(
    viewer: Cesium.Viewer,
    screenPosition: Cesium.Cartesian2
  ): Cesium.Cartesian3 | null {
    // Try to pick the actual rendered surface first (includes terrain)
    const pickedPosition = viewer.scene.pickPosition(screenPosition);
    if (pickedPosition) {
      return pickedPosition;
    }

    // Fall back to ellipsoid surface if terrain picking fails
    const ellipsoid = viewer.scene.globe.ellipsoid;
    return viewer.camera.pickEllipsoid(screenPosition, ellipsoid) || null;
  }
}
