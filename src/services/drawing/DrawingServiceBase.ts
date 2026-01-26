import * as Cesium from 'cesium';
import { Feature } from 'components/navigation/FeaturesSection/types';
import { DrawingUtils } from './DrawingUtils';

/**
 * Abstract base class for all drawing services.
 * Provides common functionality for viewer management, visibility, callbacks,
 * and utility methods shared across all drawing tools.
 */
export abstract class DrawingServiceBase {
  protected viewer: Cesium.Viewer | null = null;
  protected showFeatures: boolean = true;
  protected showLabels: boolean = true;
  protected onFeatureCreated: ((feature: Feature) => void) | null = null;
  protected onDrawingFinished: (() => void) | null = null;

  /**
   * Sets the Cesium viewer instance for this service.
   * @param viewer - The Cesium viewer to use, or null to clear
   */
  setViewer(viewer: Cesium.Viewer | null): void {
    this.viewer = viewer;
  }

  /**
   * Sets visibility flags for features and labels.
   * @param showFeatures - Whether to show feature geometry
   * @param showLabels - Whether to show feature labels
   */
  setVisibility(showFeatures: boolean, showLabels: boolean): void {
    this.showFeatures = showFeatures;
    this.showLabels = showLabels;
  }

  /**
   * Sets the callback function to be invoked when a feature is created.
   * @param callback - Function that receives the created feature
   */
  setCallback(callback: (feature: Feature) => void): void {
    this.onFeatureCreated = callback;
  }

  /**
   * Sets the callback function to be invoked when drawing is finished.
   * @param callback - Function called when the drawing operation completes
   */
  setDrawingFinishedCallback(callback: () => void): void {
    this.onDrawingFinished = callback;
  }

  /**
   * Picks a position on the globe from screen coordinates.
   * Uses terrain-aware picking when available, falls back to ellipsoid.
   * @param screenPosition - The screen coordinates to pick from
   * @returns The picked 3D position, or null if picking failed
   */
  protected pickGlobePosition(screenPosition: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    if (!this.viewer) return null;
    return DrawingUtils.pickGlobePosition(this.viewer, screenPosition);
  }

  /**
   * Cleans up resources used by this service.
   * Must be implemented by each drawing service to clean up service-specific state.
   */
  abstract destroy(): void;
}
