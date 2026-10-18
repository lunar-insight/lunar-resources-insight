import * as Cesium from 'cesium';
import { cubicBezier, easeInOut, easeOut, keyframeValue, type Keyframes } from 'utils/easing';
import { IMPACT_DURATION, REDUCED_RING_DURATION } from './pointDropTimeline';
import { createGroundDisc, keepShadersCompiled } from '../groundDisc';

export interface GroundEffect {
  kind: 'ring' | 'glow';
  /** Diameter on screen at full scale, in CSS pixels. For a ring, the outer edge of its line. */
  sizePx: number;
  /** Milliseconds from the impact. */
  delay: number;
  duration: number;
  easing: (t: number) => number;
  /** Keyframes on the eased progress, as in the Web Animations model. */
  scale: Keyframes;
  opacity: Keyframes;
}

const SONAR_EASING = cubicBezier(0.15, 0.55, 0.3, 1);
const RING_SCALE: Keyframes = [[0, 0.04], [0.06, 0.12], [1, 1]];
const RING_OPACITY: Keyframes = [[0, 0], [0.06, 1], [1, 0]];

/** A ground glow, then three sonar rings spreading out from the spot. */
export const IMPACT_EFFECTS: readonly GroundEffect[] = [
  {
    kind: 'glow', sizePx: 70, delay: 0, duration: IMPACT_DURATION, easing: easeOut,
    scale: [[0, 0.4], [0.2, 1], [1, 1.1]], opacity: [[0, 0], [0.2, 1], [1, 0]],
  },
  { kind: 'ring', sizePx: 120, delay: 0, duration: 950, easing: SONAR_EASING, scale: RING_SCALE, opacity: RING_OPACITY },
  { kind: 'ring', sizePx: 104, delay: 140, duration: 950, easing: SONAR_EASING, scale: RING_SCALE, opacity: RING_OPACITY },
  { kind: 'ring', sizePx: 88, delay: 280, duration: 820, easing: SONAR_EASING, scale: RING_SCALE, opacity: RING_OPACITY },
];

/** One ring at a fixed size, fading in and out in place. */
export const REDUCED_EFFECTS: readonly GroundEffect[] = [
  {
    kind: 'ring', sizePx: 44, delay: 0, duration: REDUCED_RING_DURATION, easing: easeInOut,
    scale: [[0, 1], [1, 1]], opacity: [[0, 0], [0.25, 1], [1, 0]],
  },
];

/** Room past a ring's line for its halo, in CSS pixels. */
const HALO_PX = 8;
const RING_LINE_PX = 2;

// Distances are in units of the disc's radius, from its center. A ring's line
// fades out over one pixel, its halo over HALO_PX pixels. The glow fades to
// nothing at 70% of its radius.
const SHADER = `
uniform vec3 radii;
uniform vec3 widths;
uniform vec3 alphas;
uniform vec2 glow;
uniform float pixel;

czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  float r = length(materialInput.st * 2.0 - 1.0);
  float line = 0.0;
  float halo = 0.0;
  for (int i = 0; i < 3; i++) {
    float d = abs(r - radii[i]);
    float halfWidth = widths[i] * 0.5;
    line = max(line, alphas[i] * 0.95 * (1.0 - smoothstep(halfWidth, halfWidth + pixel, d)));
    halo = max(halo, alphas[i] * 0.65 * (1.0 - smoothstep(halfWidth, halfWidth + ${HALO_PX.toFixed(1)} * pixel, d)));
  }
  float core = glow.y * 0.45 * (1.0 - smoothstep(0.0, glow.x * 0.7, r));
  float under = max(halo, core) * (1.0 - line);
  material.alpha = line + under;
  material.diffuse = mix(vec3(0.357, 0.722, 0.706), vec3(0.588, 0.859, 0.847), line / max(material.alpha, 0.0001));
  return material;
}
`;

const INVISIBLE_UNIFORMS = () => ({
  radii: new Cesium.Cartesian3(),
  widths: new Cesium.Cartesian3(),
  alphas: new Cesium.Cartesian3(),
  glow: new Cesium.Cartesian2(0.0001, 0),
  pixel: 0.01,
});

/** The uniform values for one frame, in units of the disc's radius. */
export interface ImpactUniforms {
  radii: Cesium.Cartesian3;
  widths: Cesium.Cartesian3;
  alphas: Cesium.Cartesian3;
  glow: Cesium.Cartesian2;
  pixel: number;
}

/**
 * The ground part of a point drop: one disc on the ground, a GroundPrimitive
 * draped on the terrain and so flattened by the surface's tilt toward the
 * viewer. A shader draws the glow and the rings inside it from uniforms set on
 * every frame. The geometry stays fixed while the effect plays, so Cesium
 * builds it once. Sizes are set in screen pixels: the disc is sized at the
 * spot's distance when the impact starts, and the uniforms follow the camera's
 * distance from then on, so the effect keeps its size on screen while the
 * camera moves within the disc. Removes itself once played.
 */
export class ProbeImpact {
  private readonly primitive: Cesium.GroundPrimitive;
  private readonly material: Cesium.Material;
  private readonly effects: readonly GroundEffect[];
  private readonly startTime = performance.now();
  private readonly duration: number;
  /** Disc radius in CSS pixels at the start. */
  private readonly discRadiusPx: number;
  private readonly startMetersPerPixel: number;
  private readonly removePreRender: Cesium.Event.RemoveCallback;
  private frameId = 0;
  private destroyed = false;

  constructor(
    private readonly viewer: Cesium.Viewer,
    private readonly position: Cesium.Cartesian3,
    reduceMotion: boolean
  ) {
    this.effects = reduceMotion ? REDUCED_EFFECTS : IMPACT_EFFECTS;
    this.duration = Math.max(...this.effects.map(effect => effect.delay + effect.duration));
    this.discRadiusPx = Math.max(...this.effects.map(effect =>
      (effect.sizePx / 2) * Math.max(...effect.scale.map(([, scale]) => scale)) + (effect.kind === 'ring' ? HALO_PX : 0)
    ));
    this.startMetersPerPixel = this.metersPerPixel();

    this.material = new Cesium.Material({
      fabric: { uniforms: { ...this.uniformsAt(0, this.startMetersPerPixel) }, source: SHADER },
      translucent: true,
    });
    this.primitive = createGroundDisc(viewer, position, this.discRadiusPx * this.startMetersPerPixel, this.material);
    viewer.scene.groundPrimitives.add(this.primitive);
    this.removePreRender = viewer.scene.preRender.addEventListener(this.updateFrame);
    this.tick();
  }

  private metersPerPixel(): number {
    const canvas = this.viewer.scene.canvas;
    return this.viewer.camera.getPixelSize(
      new Cesium.BoundingSphere(this.position, 0),
      Math.max(1, canvas.clientWidth),
      Math.max(1, canvas.clientHeight)
    );
  }

  private updateFrame = () => {
    Object.assign(this.material.uniforms, this.uniformsAt(performance.now() - this.startTime, this.metersPerPixel()));
  };

  /** Uniform values at a time from the impact, for the camera's current meters per pixel at the spot. */
  uniformsAt(elapsed: number, metersPerPixel: number): ImpactUniforms {
    // The disc's radius in CSS pixels now, given its fixed size on the ground.
    const discPx = (this.discRadiusPx * this.startMetersPerPixel) / metersPerPixel;
    const rings = { radii: [0, 0, 0], widths: [0, 0, 0], alphas: [0, 0, 0] };
    let glow = new Cesium.Cartesian2(0.0001, 0);
    let ring = 0;

    for (const effect of this.effects) {
      const t = Math.min(1, Math.max(0, (elapsed - effect.delay) / effect.duration));
      const progress = effect.easing(t);
      const scale = keyframeValue(progress, effect.scale);
      const opacity = keyframeValue(progress, effect.opacity);
      if (effect.kind === 'glow') {
        glow = new Cesium.Cartesian2(Math.max(0.0001, (scale * effect.sizePx) / 2 / discPx), opacity);
      } else {
        // The line sits inside the ring's outer edge, and scales with the ring.
        rings.radii[ring] = (scale * (effect.sizePx / 2 - RING_LINE_PX / 2)) / discPx;
        rings.widths[ring] = (scale * RING_LINE_PX) / discPx;
        rings.alphas[ring] = opacity;
        ring += 1;
      }
    }

    return {
      radii: Cesium.Cartesian3.fromArray(rings.radii),
      widths: Cesium.Cartesian3.fromArray(rings.widths),
      alphas: Cesium.Cartesian3.fromArray(rings.alphas),
      glow,
      pixel: 1 / discPx,
    };
  }

  /** Keeps the impact's shaders compiled, so no impact stalls on compiling them. */
  static keepShadersCompiled(viewer: Cesium.Viewer): void {
    keepShadersCompiled(viewer, 'probe-impact', () => new Cesium.Material({
      fabric: { uniforms: { ...INVISIBLE_UNIFORMS() }, source: SHADER },
      translucent: true,
    }));
  }

  // requestRenderMode renders only on request, so each animation frame requests one.
  private tick = () => {
    if (performance.now() - this.startTime >= this.duration) {
      this.destroy();
      return;
    }
    this.viewer.scene.requestRender();
    this.frameId = requestAnimationFrame(this.tick);
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    this.removePreRender();
    this.viewer.scene.groundPrimitives.remove(this.primitive);
    this.viewer.scene.requestRender();
  }
}
