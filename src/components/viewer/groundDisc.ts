import * as Cesium from 'cesium';

/**
 * A disc on the ground drawn with a material: a GroundPrimitive draped on the
 * terrain, left out of picking. Built on its first frame, not in a worker, so
 * it shows on the frame it is needed.
 */
export function createGroundDisc(
  viewer: Cesium.Viewer,
  center: Cesium.Cartesian3,
  radius: number,
  material: Cesium.Material
): Cesium.GroundPrimitive {
  return new Cesium.GroundPrimitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.EllipseGeometry({
        center,
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        ellipsoid: viewer.scene.globe.ellipsoid,
      }),
    }),
    appearance: new Cesium.MaterialAppearance({ material, flat: true }),
    asynchronous: false,
    allowPicking: false,
  });
}

// The most renders the discs get to be built and drawn.
const MAX_PREPARE_RENDERS = 120;
const prepared = new WeakMap<Cesium.Viewer, Set<string>>();

/**
 * Keeps a material's shaders compiled. Cesium compiles a shader on its first
 * draw, only for what is in view, and destroys it once no primitive uses it,
 * so a disc with that material would otherwise stall the frame it first shows
 * on, every time it comes back. Two discs with the material are drawn at the
 * view's center, a small one and one the size of the globe view, since ground
 * primitives take a different shader above a size. They then stay in the
 * scene, hidden. `key` names the material, which is prepared once per viewer.
 */
export function keepShadersCompiled(viewer: Cesium.Viewer, key: string, createMaterial: () => Cesium.Material): void {
  const keys = prepared.get(viewer) ?? new Set<string>();
  if (keys.has(key)) return;
  const canvas = viewer.scene.canvas;
  const center = viewer.camera.pickEllipsoid(
    new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
    viewer.scene.globe.ellipsoid
  );
  if (!center) return;
  keys.add(key);
  prepared.set(viewer, keys);

  const discs = [1_000, 300_000].map(radius =>
    viewer.scene.groundPrimitives.add(createGroundDisc(viewer, center, radius, createMaterial())) as Cesium.GroundPrimitive
  );

  // A disc is drawn in the frame it becomes ready.
  let renders = 0;
  const removePostRender = viewer.scene.postRender.addEventListener(() => {
    renders += 1;
    if (!discs.every(disc => disc.ready) && renders < MAX_PREPARE_RENDERS) {
      viewer.scene.requestRender();
      return;
    }
    removePostRender();
    discs.forEach(disc => { disc.show = false; });
  });
  viewer.scene.requestRender();
}
