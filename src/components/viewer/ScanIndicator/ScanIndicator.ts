/**
 * ScanIndicator - A visual scanning animation component for Cesium globe
 * 
 * Creates an animated radar-like scanning indicator that follows the mouse cursor
 * on the lunar Cesium globe. The indicator consists of a central pulsing
 * ellipse surrounded by expanding ring animations.
 * 
 * Features:
 * - Adaptive sizing that maintains consistent visual size regardless of camera zoom level
 * - Smooth pulsing animations with multiple concentric rings
 * - Automatic position tracking and visibility management
 * - Performance-optimized with proper cleanup and animation frame management
 * 
 * @example
 * ```typescript
 * const scanIndicator = new ScanIndicator(viewer);
 * 
 * // Update position based on mouse movement
 * scanIndicator.updatePosition(mouseScreenPosition);
 * 
 * // Cleanup when done
 * scanIndicator.destroy();
 * ```
 */

import * as Cesium from 'cesium';

export class ScanIndicator {
  private viewer: Cesium.Viewer | null = null;
  private scanIndicator: Cesium.Entity | null = null;
  private ringEntities: Cesium.Entity[] = [];
  private currentWorldPosition: Cesium.Cartesian3 | null = null;
  private pulseStartTime: number = 0;
  private isVisible: boolean = false;
  private animationFrameId: number | null = null;

  constructor(viewer: Cesium.Viewer | null = null) {
    this.viewer = viewer;
  }

  setViewer(viewer: Cesium.Viewer | null) {
    this.viewer = viewer;
  }

  updatePosition(screenPosition: Cesium.Cartesian2): boolean {
    if (!this.viewer) return false;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const cartesian = this.viewer.camera.pickEllipsoid(screenPosition, ellipsoid);

    if (cartesian) {
      this.currentWorldPosition = cartesian;
      this.show();
      this.updateEntityPositions();
      return true;
    } else {
      this.hide();
      return false;
    }
  }

  private updateEntityPositions() {
    if (!this.currentWorldPosition) return;

    if (this.scanIndicator) {
      this.scanIndicator.position = new Cesium.ConstantPositionProperty(this.currentWorldPosition);
    }

    this.ringEntities.forEach(entity => {
      entity.position = new Cesium.ConstantPositionProperty(this.currentWorldPosition!);
    });
  }

  private getCameraHeight(): number {
    if (!this.viewer || !this.currentWorldPosition) return 100000;
    
    const cartographic = Cesium.Cartographic.fromCartesian(this.currentWorldPosition, this.viewer.scene.globe.ellipsoid);
    const cameraCartographic = Cesium.Cartographic.fromCartesian(this.viewer.camera.position, this.viewer.scene.globe.ellipsoid);
    
    // Height of camera above the target point on the globe surface
    const height = cameraCartographic.height - cartographic.height;
    return Math.max(1000, height); // Minimum 1km
  }

  /**
   * Calculates adaptive size to maintain consistent visual appearance across all zoom levels
   * The animation size stays constant in screen pixels regardless of camera distance
   */
  private getAdaptiveSize(baseSize: number): number {
    if (!this.viewer || !this.currentWorldPosition) return baseSize;
    
    // Reference size calibrated so max ring diameter ≈ mouse cursor size (~16 pixels)
    // baseSize=600 with +40% pulsation should reach ~8 pixels radius
    const referencePixelSize = 1.375; // pixels radius for baseSize = 100
    
    // Calculate approximate meters per pixel based on camera height and canvas size
    const height = this.getCameraHeight();
    const canvas = this.viewer.scene.canvas;
    const metersPerPixelApprox = height / canvas.clientHeight;
    
    // Convert pixel size to world size and apply baseSize proportion
    const referenceSizeInMeters = referencePixelSize * metersPerPixelApprox;
    const proportionalSize = referenceSizeInMeters * (baseSize / 100);
    
    return proportionalSize;
  }
    
  show() {
    if (!this.viewer || !this.currentWorldPosition) return;

    if (!this.scanIndicator) {
      this.createIndicator();
      this.startAnimation();
    }

    if (this.scanIndicator) {
      this.scanIndicator.show = true;
      this.ringEntities.forEach(entity => {
        entity.show = true;
      });
      this.isVisible = true;
    }
  }

  hide() {
    if (this.scanIndicator) {
      this.scanIndicator.show = false;
    }
    this.ringEntities.forEach(entity => {
      entity.show = false;
    });
    this.isVisible = false;
    this.stopAnimation();
  }

  private startAnimation() {
    if (!this.viewer) return;
    
    this.pulseStartTime = Date.now();
    
    // Recursive animation loop using requestAnimationFrame for smooth performance
    const animate = () => {
      if (!this.isVisible || !this.viewer) return;
      
      this.viewer.scene.requestRender();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
  }

  private stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private createIndicator() {
    if (!this.viewer || !this.currentWorldPosition) return;

    this.pulseStartTime = Date.now();

    // Central pulsing ellipse
    this.scanIndicator = this.viewer.entities.add({
      position: new Cesium.ConstantPositionProperty(this.currentWorldPosition),
      ellipse: {
        // CallbackProperty enables real-time animation by recalculating values each frame
        semiMinorAxis: new Cesium.CallbackProperty(() => {
          const elapsed = (Date.now() - this.pulseStartTime) % 2000;
          const phase = elapsed / 2000;
          const baseSize = this.getAdaptiveSize(100);
          const pulseAmplitude = baseSize * 0.3;
          return baseSize + pulseAmplitude * Math.sin(phase * Math.PI * 2);
        }, false),
        semiMajorAxis: new Cesium.CallbackProperty(() => {
          const elapsed = (Date.now() - this.pulseStartTime) % 2000;
          const phase = elapsed / 2000;
          const baseSize = this.getAdaptiveSize(100);
          const pulseAmplitude = baseSize * 0.3;
          const semiMinor = baseSize + pulseAmplitude * Math.sin(phase * Math.PI * 2);
          return semiMinor + Math.max(1, baseSize * 0.01); // Ensure semiMajor > semiMinor
        }, false),
        material: new Cesium.ColorMaterialProperty(
          new Cesium.CallbackProperty(() => {
            const elapsed = (Date.now() - this.pulseStartTime) % 2000;
            const phase = elapsed / 2000;
            const baseAlpha = 0.9;
            const pulseAlpha = 0.1;
            const alpha = baseAlpha + pulseAlpha * Math.sin(phase * Math.PI * 2);
            return Cesium.Color.CYAN.withAlpha(alpha);
          }, false)
        ),
        outline: true,
        outlineColor: new Cesium.CallbackProperty(() => {
          return Cesium.Color.WHITE.withAlpha(0.8);
        }, false),
        height: 0,
        extrudedHeight: 0,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    });

    this.createRingEllipses();
  }

  private createRingEllipses() {
    if (!this.viewer || !this.currentWorldPosition) return;

    // Configuration for three expanding rings with staggered timing
    const ringConfigs = [
      { baseSize: 200, delay: 0, duration: 3000 },
      { baseSize: 400, delay: 500, duration: 3500 },
      { baseSize: 600, delay: 1000, duration: 4000 }
    ];

    ringConfigs.forEach((config, index) => {
      const ringEllipse = this.viewer!.entities.add({
        position: new Cesium.ConstantPositionProperty(this.currentWorldPosition!),
        ellipse: {
          semiMinorAxis: new Cesium.CallbackProperty(() => {
            const elapsed = (Date.now() - this.pulseStartTime - config.delay) % config.duration;
            const phase = elapsed / config.duration;
            const baseSize = this.getAdaptiveSize(config.baseSize);
            const pulseAmplitude = baseSize * 0.4;
            const size = baseSize + pulseAmplitude * Math.sin(phase * Math.PI * 2);
            return Math.max(this.getAdaptiveSize(100), size);
          }, false),
          semiMajorAxis: new Cesium.CallbackProperty(() => {
            const elapsed = (Date.now() - this.pulseStartTime - config.delay) % config.duration;
            const phase = elapsed / config.duration;
            const baseSize = this.getAdaptiveSize(config.baseSize);
            const pulseAmplitude = baseSize * 0.4;
            const semiMinor = baseSize + pulseAmplitude * Math.sin(phase * Math.PI * 2);
            const size = Math.max(this.getAdaptiveSize(100), semiMinor);
            return size + Math.max(1, baseSize * 0.01); // Ensure semiMajor > semiMinor
          }, false),
          material: new Cesium.ColorMaterialProperty(
            new Cesium.CallbackProperty(() => {
              const elapsed = (Date.now() - this.pulseStartTime - config.delay) % config.duration;
              const phase = elapsed / config.duration;
              const baseAlpha = 0.3 / (index + 1);
              const pulseAlpha = 0.2 / (index + 1);
              const alpha = baseAlpha + pulseAlpha * Math.sin(phase * Math.PI * 2);
              return Cesium.Color.CYAN.withAlpha(Math.max(0.05, alpha));
            }, false)
          ),
          outline: true,
          outlineColor: new Cesium.CallbackProperty(() => {
            const elapsed = (Date.now() - this.pulseStartTime - config.delay) % config.duration;
            const phase = elapsed / config.duration;
            const alpha = (0.4 + 0.2 * Math.sin(phase * Math.PI * 2)) / (index + 1);
            return Cesium.Color.CYAN.withAlpha(Math.max(0.1, alpha));
          }, false),
          height: 0,
          extrudedHeight: 0,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      });

      this.ringEntities.push(ringEllipse);
    });
  }

  isActive(): boolean {
    return this.isVisible;
  }

  /**
   * Cleanup method - removes all entities and stops animations
   * Important: Always call this when the component is no longer needed
   */
  destroy() {
    this.stopAnimation();
    
    if (!this.viewer) return;

    if (this.scanIndicator) {
      this.viewer.entities.remove(this.scanIndicator);
      this.scanIndicator = null;
    }

    this.ringEntities.forEach(entity => {
      this.viewer!.entities.remove(entity);
    });
    this.ringEntities = [];

    this.isVisible = false;
  }
}