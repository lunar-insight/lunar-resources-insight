# Ground effects

## Scope

How the app draws animated effects on the lunar ground with Cesium: the rings of a point drop and the scanner's indicator under the cursor. Covers the disc they are drawn in, the shaders that draw them, how their shaders stay compiled, the bounds every ground primitive uses on the Moon, and how the ground under the cursor is picked. Excludes the drop's timeline and screen-space parts (see `globe-menu-and-point-drop.md`) and the drawing of saved feature shapes.

## Structure

```
 effect (ProbeImpact, ScanIndicator)
   |  sizes in screen pixels, converted to meters at the spot each frame
   v
 createGroundDisc: one GroundPrimitive, a disc draped on the terrain,
   |  built once and kept while the effect stays inside it
   v
 material shader: draws the effect inside the disc from uniforms set before each frame
   |
   +-- keepShadersCompiled: hidden discs keep each effect's shaders compiled
   +-- applyLunarTerrainBounds: the volume of every ground primitive covers the Moon's terrain

 pickGround: the terrain under the cursor, else the ellipsoid
   --> the scanner's indicator and the point the scanner reads
```

## Design rationale

An effect on the ground keeps its size on screen at every zoom and is flattened by the ground's tilt toward the viewer, as a ground primitive draped on the terrain is. Ground geometry whose size changes on every frame is rebuilt on every frame, which stops drawing for long stretches and leaves the shape incomplete. Each effect is therefore one disc whose geometry stays fixed, with the animation in its shader's uniforms. The evidence is in `docs/measurements/point-drop-frames/`.

## Components

### Ground discs

`createGroundDisc` builds a GroundPrimitive from an ellipse on the Moon's ellipsoid and a material, left out of picking, and built on its first frame instead of in a worker, so it shows on the frame it is needed.

Cesium compiles a shader on its first draw, only for what is in view, and destroys it once no primitive uses it. `keepShadersCompiled` draws two discs with an effect's material at the view's center while the browser is idle, a small one and one the size of the globe view, since ground primitives take a different shader above a size, then keeps them in the scene hidden. Each effect does this once per viewer. When an effect replaces its disc, it adds the new one before removing the old one.

### Point drop rings

`ProbeImpact` sizes its disc in screen pixels at the spot's distance when the impact starts, and its shader draws the glow and the rings by distance from the disc's center, using the disc's texture coordinates. The uniforms follow the camera's distance, so the rings keep their size on screen while the camera moves within the disc.

### Scanner indicator

`ScanIndicator` draws a pulsing dot and three pulsing circles at the cursor, by distance from the cursor in its shader. The disc is several times the indicator's size and the cursor moves inside it through the uniforms; a new disc replaces it when the cursor nears its edge, or when the zoom halves or doubles the indicator's size. The disc stays in the scene, hidden, while the scanner pauses.

The shader reads the ground under each fragment back from the globe's depth, as the ground primitive's own shader does, and measures the distance to the cursor along the ground, without the height between them. The material's `positionToEyeEC` is not used for this: under a logarithmic depth buffer it is not divided by `w`, so its direction is right but its length is not in meters.

### Ground under the cursor

`pickGround` intersects the camera's ray with the terrain tiles drawn, and falls back to the ellipsoid where no tile answers. The ellipsoid alone lies off the terrain wherever the terrain is above or below it, which in a tilted view is far from the point under the cursor. The scanner's indicator and the point the scanner reads both come from it.

### Lunar terrain bounds

Ground primitives draw inside a volume bounded by Cesium's `ApproximateTerrainHeights`, a table of Earth's terrain by tile. The Moon's terrain at the same latitude and longitude often falls outside it, and the shape is then not drawn. `applyLunarTerrainBounds` replaces the table before the viewer is created, so every tile takes bounds that cover the whole Moon. This applies to every ground primitive in the app, the saved shapes included.

## Configuration reference

| Concern | File |
|---|---|
| Disc creation and shader keep-alive | `src/components/viewer/groundDisc.ts` |
| Point drop rings: sizes, timing, shader | `src/components/viewer/PointDrop/ProbeImpact.ts` |
| Scanner indicator: sizes, pulse, disc size, shader | `src/components/viewer/ScanIndicator/ScanIndicator.ts` |
| Ground under the cursor | `src/utils/pickGround.ts` |
| Ground primitive bounds | `src/utils/lunarTerrainBounds.ts` |
| Running work when the browser is idle | `src/utils/idle.ts` |
