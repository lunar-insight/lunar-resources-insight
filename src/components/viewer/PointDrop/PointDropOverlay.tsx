import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as Cesium from 'cesium';
import { useViewer } from 'utils/context/ViewerContext';
import { usePointDrop, type PointDrop } from 'utils/context/PointDropContext';
import { useTrackedScreenPosition } from 'hooks/useTrackedScreenPosition';
import { runWhenIdle } from 'utils/idle';
import { ProbeImpact } from './ProbeImpact';
import { FEATURES_DIALOG_ID, FLY_DURATION, PROBE_DURATION } from './pointDropTimeline';
import styles from './PointDropOverlay.module.scss';

// The probe starts this far above the top edge of the globe view, so a point
// near the top still shows some travel.
const PROBE_START_ABOVE = 30;
// Horizontal offset of the start per pixel of fall. The probe comes in on a
// slant from the upper left, which sets it apart from the fly to Features.
const PROBE_SLANT = 0.35;
const PROBE_TRAIL = 4;
const FLY_TRAIL = 6;
const TRAIL_GAP_MS = 14;
// Height of the fly's curve above its higher end, in pixels.
const FLY_LIFT = 110;
// Points sampled along the fly's curve, one keyframe each.
const FLY_SAMPLES = 19;

export const RAIL_TARGET_SELECTOR = `[data-rail-id="${FEATURES_DIALOG_ID}"] [data-fly-target]`;
export const rowTargetSelector = (featureId: string) => `[data-feature-row="${featureId}"] [data-fly-target]`;

interface TrailDot {
  delay: number;
  scale: number;
  opacity: number;
}

/** Trail dots follow the lead dot, each later, smaller and fainter. */
const trailDots = (count: number): TrailDot[] =>
  Array.from({ length: count }, (_, index) => ({
    delay: index * TRAIL_GAP_MS,
    scale: 1 - index * (0.84 / count),
    opacity: 1 - index * (0.96 / count),
  }));

interface Point {
  x: number;
  y: number;
}

/**
 * Keyframes moving a dot through points, then hiding it once it arrives.
 * Only transform and opacity change, so the browser's compositor plays the
 * animation even while the main thread is busy.
 */
export function pathKeyframes(points: Point[], dot: TrailDot): Keyframe[] {
  const last = points.length - 1;
  const at = (point: Point) => `translate(${point.x}px, ${point.y}px) scale(${dot.scale})`;
  return [
    ...points.map((point, index) => ({ transform: at(point), opacity: dot.opacity, offset: (index / last) * 0.999 })),
    { transform: at(points[last]), opacity: 0, offset: 1 },
  ];
}

/** Starts an animation on mount and cancels it on unmount. */
const AnimatedSpan: React.FC<{ className: string; keyframes: Keyframe[]; options: KeyframeAnimationOptions }> = ({
  className,
  keyframes,
  options,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const animation = ref.current?.animate?.(keyframes, { fill: 'both', ...options });
    return () => animation?.cancel();
  }, []);
  return <span ref={ref} className={className} />;
};

/** Start of the fall relative to the spot, from its screen height when the drop starts. */
export function probeStartOffset(viewer: Cesium.Viewer, position: Cesium.Cartesian3): Point {
  const screen = viewer.scene.cartesianToCanvasCoordinates(position);
  const fall = (screen?.y ?? 0) + PROBE_START_ABOVE;
  return { x: Math.round(-fall * PROBE_SLANT * 10) / 10, y: -fall };
}

/**
 * Points in viewport pixels along a quadratic curve from the spot to the fly
 * target: the new row's icon when the row is the target and on the page,
 * otherwise the Features button's icon. Null when neither is found or the spot
 * is out of view.
 */
export function flyCurve(viewer: Cesium.Viewer, drop: PointDrop): Point[] | null {
  const target = (drop.flyTarget === 'row' ? document.querySelector(rowTargetSelector(drop.featureId)) : null)
    ?? document.querySelector(RAIL_TARGET_SELECTOR);
  const screen = viewer.scene.cartesianToCanvasCoordinates(drop.position);
  if (!target || !screen) return null;

  target.scrollIntoView?.({ block: 'nearest' });
  const canvasRect = viewer.canvas.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const from = { x: canvasRect.left + screen.x, y: canvasRect.top + screen.y };
  const to = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
  const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - FLY_LIFT };

  return Array.from({ length: FLY_SAMPLES }, (_, index) => {
    const t = index / (FLY_SAMPLES - 1);
    const u = 1 - t;
    return {
      x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
    };
  });
}

/** The parts of a drop at the spot: the probe, the flash and, through ProbeImpact, the ground effects. */
const DropSpot: React.FC<{ viewer: Cesium.Viewer; drop: PointDrop }> = ({ viewer, drop }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const cartographic = useMemo(() => Cesium.Cartographic.fromCartesian(drop.position, Cesium.Ellipsoid.MOON), [drop.position]);
  useTrackedScreenPosition(
    viewer,
    Cesium.Math.toDegrees(cartographic.longitude),
    Cesium.Math.toDegrees(cartographic.latitude),
    elementRef,
    '',
    true,
    cartographic.height
  );
  const [start] = useState(() => probeStartOffset(viewer, drop.position));

  const hasLanded = drop.stage !== 'probe';
  useEffect(() => {
    if (!hasLanded) return;
    const impact = new ProbeImpact(viewer, drop.position, drop.reduceMotion);
    return () => impact.destroy();
  }, [hasLanded, viewer, drop.position, drop.reduceMotion]);

  return (
    <div ref={elementRef} className={styles.spot} style={{ display: 'none' }}>
      {!drop.reduceMotion && drop.stage !== 'fly' && trailDots(PROBE_TRAIL).map(dot => (
        <AnimatedSpan
          key={dot.delay}
          className={styles.probeDot}
          keyframes={pathKeyframes([start, { x: 0, y: 0 }], dot)}
          options={{ duration: PROBE_DURATION, delay: dot.delay, easing: 'cubic-bezier(0.55, 0, 0.85, 0.5)' }}
        />
      ))}
      {!drop.reduceMotion && drop.stage === 'impact' && (
        <AnimatedSpan
          className={styles.flash}
          keyframes={[{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(1.35)', opacity: 0 }]}
          options={{ duration: 320, easing: 'ease-out' }}
        />
      )}
    </div>
  );
};

/** The dot flying from the spot into the interface, above everything. */
const FlyingDot: React.FC<{ viewer: Cesium.Viewer; drop: PointDrop }> = ({ viewer, drop }) => {
  const [curve, setCurve] = useState<Point[] | null>(null);

  // Measured after the row is laid out, before the browser paints.
  useLayoutEffect(() => {
    setCurve(flyCurve(viewer, drop));
  }, []);

  if (!curve) return null;

  return createPortal(
    <div className={styles.flyLayer}>
      {trailDots(FLY_TRAIL).map(dot => (
        <AnimatedSpan
          key={dot.delay}
          className={styles.flyDot}
          keyframes={pathKeyframes(curve, dot)}
          options={{ duration: FLY_DURATION, delay: dot.delay, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' }}
        />
      ))}
    </div>,
    document.body
  );
};

/**
 * Draws the point drops in screen space. The probe and flash sit in a layer
 * clipped to the globe view, below the floating windows. Must be mounted
 * inside .viewerContainer, like FeaturePointsOverlay.
 */
const PointDropOverlay: React.FC = () => {
  const { viewer } = useViewer();
  const { drops } = usePointDrop();

  // Compiles the impact's shaders while the browser is idle, ahead of the first drop.
  useEffect(() => {
    if (!viewer) return;
    return runWhenIdle(() => ProbeImpact.keepShadersCompiled(viewer));
  }, [viewer]);

  if (!viewer) return null;

  return (
    <>
      <div className={styles.sceneLayer}>
        {drops.map(drop => <DropSpot key={drop.id} viewer={viewer} drop={drop} />)}
      </div>
      {drops
        .filter(drop => drop.stage === 'fly' && !drop.reduceMotion)
        .map(drop => <FlyingDot key={drop.id} viewer={viewer} drop={drop} />)}
    </>
  );
};

export default PointDropOverlay;
