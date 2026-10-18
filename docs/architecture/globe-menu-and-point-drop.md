# Globe menu and point drop

## Scope

How a right click on the globe opens a menu that creates a point or copies the coordinates, the animation played when a point is created, the box a saved point opens on click, and the toast that confirms a copy. Covers the scanner hold while the menu is open, the order in which right-click uses are resolved, and the reduced motion variant. Excludes the point tool in the Features window, which creates points with a left click, and the Inspector, which computes a point's statistics once it is saved (see `feature-inspector.md`).

## Structure

```
 right click on the ground (Cesium RIGHT_CLICK)
   |  a drawing tool, a measurement or a line vertex takes it first
   v
 GlobeContextMenu ---- GlobePopupProvider: one popup at a time,
   |  Create point       closed by Escape or a press outside;
   |  Copy coordinates   the menu holds the scanner on its spot
   v
 PointDropProvider: creates the point (createPointFeature, addFeature),
   |  then runs the timeline and releases the hold
   +--> PointDropOverlay: probe and flash (DOM, clipped to the globe view)
   |      +--> ProbeImpact: glow and sonar rings (one ground disc, drawn by a shader)
   |      +--> flying dot (DOM, above every window)
   +--> FeaturePointMarker: hidden, then pops in
   +--> FeaturesList row, or the Features button in the rail: lights up

 click or right click on a point marker --> FeatureCallout (the point's box)

 Copy coordinates (menu or box) --> useCopyCoordinates --> ToastProvider --> ToastRegion
```

## Design rationale

A plain left click belongs to the drawing and measurement tools and stops the globe's spin, so points come from a menu on the right click. Cesium fires its right click only when the mouse moved less than its click tolerance, so a right-drag zoom never opens the menu. The menu and a point's box are one popup state, so opening one closes the other.

The animation tells where the point is and that it joined the Features list, while the main thread is busy: adding the point re-renders the Features list and starts the Inspector. The parts that move across the screen (the probe, the flash and the flying dot) are DOM elements in screen space, animated on transform and opacity only, which the browser's compositor plays through that work. The parts on the ground are drawn by Cesium on the ground, at a constant size on screen and flattened by the ground's tilt. Their geometry is built once per drop, since geometry rebuilt on every frame stopped drawing for most of the impact. The evidence is in `docs/measurements/point-drop-frames/`. With reduced motion, travel and growth are dropped and only fades remain.

## Components

### Popup state

`GlobePopupContext` holds the open popup: the globe menu at a click, or the box of one feature. Elements of a popup carry `data-globe-popup`; a press anywhere else closes it, in the capture phase, so the popup is closed before the press reaches the globe. A press on the marker of the open box is left to the marker, which closes the box itself.

Opening the menu holds the scanner on the clicked spot (`PointValueService.holdAt`). While held, the scanner reads that spot whether or not mouse tracking is enabled, since the cursor leaves the canvas to reach the menu. Each hold has a token, so a release from an earlier menu cannot end a newer hold. "Create point" hands the token to the drop, which releases it once the marker appears.

### Globe menu

`GlobeContextMenu` sets its own Cesium input actions. A right click is left to the active drawing tool (finishing a line or polygon) or measurement (canceling it). A line vertex under the cursor is checked at the press, before the vertex editing service deletes the vertex on the click. The header shows the coordinate as `lat, lon`, the form the search box parses, and the terrain elevation from `sampleElevation`. The menu stays at the screen position of the click, so it closes once the camera moves.

### Point drop

`PointDropProvider` adds the point once the probe's first frame is painted, so the Inspector starts computing during the animation without delaying the probe, and drives the stages on timers. With reduced motion, which has no probe, it adds the point at once. The Features target is read when the dot takes off: the new row while the Features window is open, otherwise the Features button. The marker, the row and the button read their arrival state from the provider and animate it in CSS.

`PointDropOverlay` positions each drop at the spot with `useTrackedScreenPosition`. The probe's start is set from the spot's screen height when the drop starts. The flying dot moves through points sampled along a curve from the spot to the target's icon. Each dot and the flash run one Web Animations animation, started on mount and canceled on unmount.

The Features list reserves the width of a row's widest status, and keeps its empty state as wide as a list with one row, so the Features window keeps its width while the new point arrives and its statistics compute, and the dot keeps its target.

### Ground effects

`ProbeImpact` draws the glow and the rings in one disc on the ground, with a shader, and removes it once played. `ground-effects.md` describes how ground effects are drawn and kept smooth.

### Saved point's box

`FeaturePointMarker` tells a click from a drag by movement: below Cesium's click tolerance a left press and release opens or closes the box, past it the point moves and the box closes. A right click opens the box, and the browser menu is blocked on markers. Neither works while a drawing or measurement tool is active. `FeatureCallout` is the box, in the look of the search result callout (`Callout.module.scss`), with the actions of the point's Features list row.

### Toast

"Copy coordinates", in the menu and in the box, goes through `useCopyCoordinates`, which copies `lat, lon` and confirms it, or tells that the browser refused, in a toast. `ToastProvider` shows one toast at a time; a new one replaces the current one. `ToastRegion` draws it at the bottom of the globe view inside a live region, so screen readers announce it, and fades it in without the slide when reduced motion is on.

## Configuration reference

| Concern | File |
|---|---|
| Stage times and reduced motion times | `src/components/viewer/PointDrop/pointDropTimeline.ts` |
| Probe path, trail and fly curve | `src/components/viewer/PointDrop/PointDropOverlay.tsx` |
| Ring and glow sizes, timing, easing and shader | `src/components/viewer/PointDrop/ProbeImpact.ts` |
| Probe, flash and dot looks | `src/components/viewer/PointDrop/PointDropOverlay.module.scss` |
| Marker, row and button arrival animations | `FeaturePointMarker.module.scss`, `FeaturesList.module.scss`, `SectionNavigation.module.scss` |
| Click tolerance of a marker | `src/components/navigation/FeaturesSection/components/FeaturePointMarker.tsx` |
| Reduce motion setting | `src/utils/context/AppSettingsContext.tsx` |
| Toast duration | `src/utils/context/ToastContext.tsx` |
| Toast look and placement | `src/components/viewer/Toast/ToastRegion.module.scss` |
