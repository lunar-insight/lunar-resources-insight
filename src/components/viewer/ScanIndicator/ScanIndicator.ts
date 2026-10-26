import * as Cesium from 'cesium';
import { createGroundDisc, keepShadersCompiled } from '../groundDisc';
import { pickGround } from 'utils/pickGround';
import { runWhenIdle } from 'utils/idle';

// A pulsing dot under the cursor, then three pulsing discs around it, each a
// filled circle in the scanner's cyan. Sizes are relative to the dot's: 100.
const DOT = { base: 100, pulse: 0.3, period: 2000 };
const RINGS = [
  { base: 200, delay: 0, period: 3000 },
  { base: 400, delay: 500, period: 3500 },
  { base: 600, delay: 1000, period: 4000 },
];
const RING_PULSE = 0.4;
// The dot's radius in screen pixels at base 100.
const DOT_RADIUS_PX = 1.375;
// The disc drawn on the ground is this many times the largest ring, so the
// cursor moves within it for a while before a new disc is needed.
const DISC_SCALE = 8;

// The ground under a fragment is read back from the globe's depth, as the
// ground primitive's own shader does: the material's positionToEyeEC is not
// divided by w under a logarithmic depth buffer, so its length is not in
// meters. Distances are horizontal, in meters: the cursor point and the ground
// under a fragment can be at different heights. Each circle's edge fades over
// one pixel. The circles stack like the separate translucent discs they stand for.
const SHADER = `
uniform vec3 cursor;
uniform vec3 up;
uniform vec4 radii;
uniform vec4 alphas;
uniform float pixel;

vec3 groundEC() {
  float depth = czm_unpackDepth(texture(czm_globeDepthTexture, gl_FragCoord.xy / czm_viewport.zw));
  vec4 eye = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
  return eye.xyz / eye.w;
}

czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec3 offset = groundEC() - cursor;
  float d = length(offset - dot(offset, up) * up);
  float clear = 1.0;
  for (int i = 0; i < 4; i++) {
    clear *= 1.0 - alphas[i] * (1.0 - smoothstep(radii[i] - pixel, radii[i], d));
  }
  material.diffuse = vec3(0.0, 1.0, 1.0);
  material.alpha = 1.0 - clear;
  return material;
}
`;

const createMaterial = () => new Cesium.Material({
  fabric: {
    uniforms: {
      cursor: new Cesium.Cartesian3(),
      up: new Cesium.Cartesian3(0, 0, 1),
      radii: new Cesium.Cartesian4(),
      alphas: new Cesium.Cartesian4(),
      pixel: 1,
    },
    source: SHADER,
  },
  translucent: true,
});

/** Radii in meters and opacities of the dot and the three rings at a time, for meters per pixel at the spot. */
export function indicatorShape(elapsed: number, metersPerPixel: number): { radii: Cesium.Cartesian4; alphas: Cesium.Cartesian4 } {
  const size = (base: number) => DOT_RADIUS_PX * metersPerPixel * (base / 100);
  const wave = (offset: number, period: number) => Math.sin((((elapsed - offset) % period) / period) * Math.PI * 2);

  const dotWave = wave(0, DOT.period);
  const radii = [size(DOT.base) * (1 + DOT.pulse * dotWave)];
  const alphas = [0.9 + 0.1 * dotWave];
  RINGS.forEach((ring, index) => {
    const ringWave = wave(ring.delay, ring.period);
    radii.push(Math.max(size(DOT.base), size(ring.base) * (1 + RING_PULSE * ringWave)));
    alphas.push(Math.max(0.05, (0.3 + 0.2 * ringWave) / (index + 1)));
  });
  return { radii: Cesium.Cartesian4.fromArray(radii), alphas: Cesium.Cartesian4.fromArray(alphas) };
}

/**
 * The scanner's indicator under the cursor: a pulsing dot and rings drawn on
 * the ground, at a constant size on screen. A shader draws them, by distance
 * from the cursor, inside a disc on the ground several times their size. The
 * cursor moves within the disc through the shader's uniforms; a new disc
 * replaces it only when the cursor nears its edge or the zoom changes the
 * indicator's size a lot, so the ground geometry is rarely rebuilt.
 */
export class ScanIndicator {
  private viewer: Cesium.CesiumWidget | null = null;
  private disc: Cesium.GroundPrimitive | null = null;
  private material: Cesium.Material | null = null;
  private discCenter: Cesium.Cartesian3 | null = null;
  private discRadius = 0;
  private currentWorldPosition: Cesium.Cartesian3 | null = null;
  private pulseStartTime = performance.now();
  private isVisible = false;
  private animationFrameId: number | null = null;
  private removePreRender: Cesium.Event.RemoveCallback | null = null;
  private cancelPrepare: (() => void) | null = null;

  constructor(viewer: Cesium.CesiumWidget | null = null) {
    this.setViewer(viewer);
  }

  setViewer(viewer: Cesium.CesiumWidget | null) {
    if (viewer === this.viewer) return;
    this.destroy();
    this.viewer = viewer;
    // Compiles the indicator's shaders while the browser is idle, ahead of its first showing.
    if (viewer) this.cancelPrepare = runWhenIdle(() => keepShadersCompiled(viewer, 'scan-indicator', createMaterial));
  }

  updatePosition(screenPosition: Cesium.Cartesian2): boolean {
    if (!this.viewer) return false;

    const position = pickGround(this.viewer, screenPosition);
    if (position) {
      this.currentWorldPosition = position;
      this.show();
      return true;
    }
    this.hide();
    return false;
  }

  /** Shows the indicator at a world position, independent of the cursor. */
  showAt(position: Cesium.Cartesian3): void {
    this.currentWorldPosition = position;
    this.show();
  }

  /** Meters per screen pixel at the indicator, from the camera's height above it and the canvas height. */
  private metersPerPixel(position: Cesium.Cartesian3): number {
    const viewer = this.viewer!;
    const ellipsoid = viewer.scene.globe.ellipsoid;
    const point = ellipsoid.cartesianToCartographic(position);
    const camera = ellipsoid.cartesianToCartographic(viewer.camera.position);
    const height = Math.max(1000, camera.height - point.height);
    return height / Math.max(1, viewer.scene.canvas.clientHeight);
  }

  /** Puts a disc under the cursor when there is none, or the cursor or the zoom left the current one behind. */
  private ensureDisc(position: Cesium.Cartesian3, largestRing: number): void {
    const viewer = this.viewer!;
    const ellipsoid = viewer.scene.globe.ellipsoid;
    const wanted = DISC_SCALE * largestRing;
    // Measured on the ellipsoid, since the cursor's ground height varies.
    const onSurface = (point: Cesium.Cartesian3) => ellipsoid.scaleToGeodeticSurface(point, new Cesium.Cartesian3());
    const fits = this.disc !== null
      && Cesium.Cartesian3.distance(onSurface(position), onSurface(this.discCenter!)) + largestRing <= this.discRadius
      && wanted >= this.discRadius / 2
      && wanted <= this.discRadius * 2;
    if (fits) return;

    // The new disc is added before the old one goes, so their shared shader stays compiled.
    const previous = this.disc;
    this.material = createMaterial();
    this.disc = viewer.scene.groundPrimitives.add(createGroundDisc(viewer, position, wanted, this.material)) as Cesium.GroundPrimitive;
    this.discCenter = Cesium.Cartesian3.clone(position);
    this.discRadius = wanted;
    if (previous) viewer.scene.groundPrimitives.remove(previous);
  }

  // Runs only while shown, so a viewer and a position are set.
  private updateFrame = () => {
    const viewer = this.viewer!;
    const position = this.currentWorldPosition!;

    const metersPerPixel = this.metersPerPixel(position);
    const { radii, alphas } = indicatorShape(performance.now() - this.pulseStartTime, metersPerPixel);
    this.ensureDisc(position, (DOT_RADIUS_PX * metersPerPixel * RINGS[2].base * (1 + RING_PULSE)) / 100);

    const view = viewer.camera.viewMatrix;
    const normal = viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(position, new Cesium.Cartesian3());
    Object.assign(this.material!.uniforms, {
      cursor: Cesium.Matrix4.multiplyByPoint(view, position, new Cesium.Cartesian3()),
      up: Cesium.Cartesian3.normalize(Cesium.Matrix4.multiplyByPointAsVector(view, normal, new Cesium.Cartesian3()), new Cesium.Cartesian3()),
      radii,
      alphas,
      pixel: metersPerPixel,
    });
  };

  show() {
    if (!this.viewer || !this.currentWorldPosition) return;
    if (!this.isVisible) {
      this.isVisible = true;
      this.updateFrame();
      this.startAnimation();
    }
    this.disc!.show = true;
  }

  hide() {
    if (this.disc) this.disc.show = false;
    this.isVisible = false;
    this.stopAnimation();
  }

  // requestRenderMode renders only on request, so each animation frame requests one.
  private startAnimation() {
    const viewer = this.viewer!;
    this.removePreRender = viewer.scene.preRender.addEventListener(this.updateFrame);
    const animate = () => {
      viewer.scene.requestRender();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private stopAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.removePreRender?.();
    this.removePreRender = null;
  }

  isActive(): boolean {
    return this.isVisible;
  }

  /** Removes the indicator from the scene. Call it when the indicator is no longer needed. */
  destroy() {
    this.stopAnimation();
    this.isVisible = false;
    this.cancelPrepare?.();
    this.cancelPrepare = null;
    if (this.viewer && this.disc) this.viewer.scene.groundPrimitives.remove(this.disc);
    this.disc = null;
    this.material = null;
    this.discCenter = null;
  }
}
