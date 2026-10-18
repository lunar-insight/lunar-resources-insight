# Point drop frames

Frames the app drew on 2026-10-18 while a point was created from the globe
menu, and while the scanner's indicator followed the pointer: how many frames
came, when the first came, where the main thread stopped drawing for over
40 ms, and which Cesium renders took over 30 ms. Covers three versions of the
drop's ground effects and two of the scanner's indicator, on the whole globe
and in a close-up, with "Copy coordinates" as the reference for a choice that
creates nothing.

## Environment

- Windows 10, NVIDIA GeForce GTX 1070. Firefox 158 headless, which renders
  WebGL on that GPU through ANGLE (it reports a generic "GeForce GTX 980, or
  similar" to pages). Driven by `scripts/firefox-bidi/drive.mjs`, Node 22.
  Window 1400 × 900.
- Development server (Vite) on port 5173, terrain and tiler running in Docker.
- For the drops, no scanner open, so Cesium rendered on request only. For the
  indicator, the Chemical Elements scanner open with no layer selected, so
  Cesium rendered continuously and no values were requested.
- Whole globe: the default camera. Close-up: 9 km above lat 22°, lon -50.5°,
  tilted 24° below the horizon.

## Reproducing

`record.js` runs in the page while the globe menu is open: it chooses a menu
item, then records every animation frame and every Cesium render over 30 ms
for 2.5 s. `report.js` summarizes the record. `frame-plans.cjs` writes the
plans that open the menu and run both.

`sweep.js` records the same way while the plan moves the pointer around a
diamond on the globe, 2.4 s per sweep.

```
node docs/measurements/point-drop-frames/frame-plans.cjs <out-dir>
node scripts/firefox-bidi/drive.mjs <out-dir>/globe.json
node scripts/firefox-bidi/drive.mjs <out-dir>/close-up.json
node scripts/firefox-bidi/drive.mjs <out-dir>/scanner.json
```

Each report line reads `frames <count> | first frame <ms> | gaps
<start>+<length> ... | slow renders <start>+<length> ...`, in milliseconds
from the start of the recording. The drop runs below predate the frame count. The first two
configurations below are earlier versions of the drop, measured with the same
recording run by hand before these scripts existed; the repository holds only
the third.

## Results

### Ground ellipse entities, point added on the click

One CLAMP_TO_GROUND ellipse entity per effect (glow and three rings), each
sized by a CallbackProperty on every frame. The point is added in the same
event as the click. Three drops on the whole globe:

| first frame | gaps over 40 ms |
|---|---|
| 180 | 410+722, then 48 to 63 ms gaps |
| 142 | 149+62, 413+757, then 41 to 70 ms gaps |
| 145 | 409+709, then 48 to 104 ms gaps |

"Copy coordinates": first frame at 21 ms.

### One ground disc drawn by a shader, point added after the first frame

One GroundPrimitive with fixed geometry; a material's uniforms set the rings
and the glow on every frame. The point is added after the probe's first frame.

| view | first frame | gaps over 40 ms | slow renders |
|---|---|---|---|
| globe | 31 | 100+139, 427+326 | not recorded |
| globe | 35 | 42+139, 410+230 | not recorded |
| globe | 38 | 51+119, 420+215 | not recorded |
| globe | – | 70+160, 418+326 | 419+310 |
| globe | – | 82+153, 423+264 | 432+255 |
| globe | – | 57+126, 412+208 | 413+194 |
| close-up | – | 73+146, 413+215 | 419+213 |
| close-up | – | 58+146, 405+202 | 407+182 |

Timed alone in the page, the first render with a new disc took 109 to 174 ms
and the next ones 7 to 10 ms, while a disc with the same shader was still in
the scene.

### One ground disc, shaders kept compiled

As above, with two hidden discs carrying the impact's shader kept in the
scene. Two runs of each plan:

| view | choice | first frame | gaps over 40 ms (start+length) | slow renders |
|---|---|---|---|---|
| globe | copy | -2, 12 | -2+47; 12+54 | none |
| globe | copy | 11, 15 | none | none |
| globe | create | 16, 36, 31 | 51+159; 48+138; 46+96, then 41 to 66 ms gaps | none |
| globe | create | 18, 44, 40 | 74+146; 51+146; 54+167, then 41 to 70 ms gaps | none |
| close-up | create | 19, 30 | 81+146; 44+153, then 41 to 63 ms gaps | 799+34 |
| close-up | create | 19, 52 | 75+139; 66+174, then 41 to 84 ms gaps | 517+41 |

### Scanner indicator: ground ellipse entities

The indicator as four CLAMP_TO_GROUND ellipse entities following the cursor,
each sized and placed by a CallbackProperty on every frame. Two runs of
`scanner.json`, frames per 2.5 s sweep, with gaps over 100 ms:

| run | whole globe | close-up |
|---|---|---|
| 1 | 55 (18+431), 83, 85 | 64 (20+362), 76, 80 |
| 2 | 68 (38+354, 837+202), 86, 91 | 82, 76, 80 |

Run 2's 202 ms gap holds a 110 ms Cesium render. In screenshots on the whole
globe, the indicator was often cut along straight lines, at times to half a
disc, and in the close-up it was drawn below the cursor.

### Scanner indicator: one ground disc drawn by a shader

One ground disc several times the indicator's size, rebuilt only when the
cursor nears its edge or the zoom changes the indicator's size a lot, with the
indicator drawn by its shader, its shaders kept compiled, and the cursor picked
on the terrain:

| run | whole globe | close-up |
|---|---|---|
| 1 | 99, 102, 99 | 94, 98, 99 |
| 2 | 93, 98, 96 | 75, 96, 102 |

No gap over 100 ms. The 75-frame sweep had gaps of 41 to 83 ms and two renders
of 31 and 42 ms. In screenshots the indicator was whole and centered on the
cursor in both views.

## Findings

1. Ground ellipse entities sized on every frame stopped drawing for 700 to
   760 ms at the impact, every time. Their geometry is rebuilt on every frame,
   which hides most of the rings' 1.1 s.
2. A ground disc whose geometry stays fixed, with the rings drawn by a shader,
   renders each frame in under 45 ms once its shader is compiled.
3. Cesium destroys a shader no primitive uses, so without a primitive keeping
   it, each impact compiled the shader again, for 180 to 310 ms. Hidden discs
   with the same shader remove that stall.
4. Ground primitives take one shader below a size and another above it, so the
   close-up and the whole globe each need their own compiled shader.
5. Adding the point (re-rendering the Features list, starting the Inspector)
   stops drawing for 100 to 175 ms. Adding it after the probe's first frame
   moves the first frame from 140 to 180 ms after the click to under 55 ms.
   The stall then falls during the probe's fall, which the browser's compositor
   animates while the main thread is busy.
6. The scanner's indicator as entities sized on every frame drew 55 to 91
   frames per 2.5 s sweep, with a 354 to 431 ms stall at the start of each
   page's first sweep. As one disc drawn by a shader it drew 93 to 102 frames
   in all sweeps but one (75), with no stall over 100 ms.
7. The indicator's position on the ellipsoid put it below the cursor in a
   tilted view, wherever the terrain is below the ellipsoid. Picking the
   terrain puts it under the cursor.

## Harness limitations

- The frame times are the main thread's. An animation the compositor plays
  keeps moving through a gap; the recording does not show it.
- Headless Firefox at a fixed window size, with the development build. A
  production build and another GPU change the lengths, not the order of the
  stalls.
- Each plan loads the page once. In the third configuration the hidden discs
  compile the shaders while the browser is idle after loading, so no drop
  includes a compile; in the second, every drop does.
