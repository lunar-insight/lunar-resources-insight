# Dark theme contrast

Contrast of every text and icon of the interface against WCAG AA, with the
glass panes over the brightest part of the globe. Covers the app before the
dark contrast change (commit `4dd51167`, 2026-10-05), the proposed values
applied as overrides (2026-10-06), the implementation (2026-10-11), and the
implementation with a glass filter that darkens the backdrop (2026-10-11). Also
covers the lowest glass opacity each surface, text color and backdrop
brightness needs, computed outside the app.

Requirements: text 4.5:1 (WCAG 1.4.3); large text (24 px, or 18.66 px bold),
icons and state indicators 3:1 (1.4.3, 1.4.11). Disabled elements need no
ratio.

## Environment

- Windows 10, Firefox headless (157 for the 2026-10-11 runs), driven by
  `scripts/firefox-bidi/drive.mjs`, Node 22. Window 1500 × 950.
- Development server (Vite) on port 5173, with the tiler running in Docker.
- On 2026-10-05 and 2026-10-06 the globe had no imagery, and the scanner showed
  its empty state in every run. On 2026-10-11 the globe had imagery; the scanner
  still showed its empty state.

## Reproducing

The audit runs in the page. `audit.js` takes every visible text and icon,
composites the backgrounds of the element and its ancestors (background colors,
both ends of each gradient, parent `opacity`) over a white and a black
backdrop, and keeps the worst ratio. The backdrop stands for the globe canvas,
which is not an ancestor of the panes. A `brightness()` in a pane's computed
`backdrop-filter` scales the backdrop before the pane's background covers it;
the runs before the glass filter had none, so it does not change them.
`audit-plans.cjs` writes the plans that walk the app's panes and run the audit
in each state.

```
node docs/measurements/dark-contrast/audit-plans.cjs <out-dir>
node scripts/firefox-bidi/drive.mjs <out-dir>/app.json > <out-dir>/app.txt
node scripts/firefox-bidi/drive.mjs <out-dir>/inspector.json > <out-dir>/inspector.txt
node docs/measurements/dark-contrast/audit-report.cjs <out-dir>/app.txt fail
```

`app.json` walks the start screen, each navigation dialog, the four selection
modals with cells selected, an info popover, the layer list, the scanner menu
with rows selected, the scanner windows, the layers catalog, and the search
with results. `inspector.json` draws a point and opens its Inspector.

The results before the change need the app at commit `4dd51167`. The
`-adjusted` plans load `overrides.css` first, which targets that commit only.

The opacity tables are computed without the app. Each script takes an
optional backdrop brightness (default 1, no filter); `modal-min.mjs` and
`tinted-states.mjs` also take the opacities to report.

```
node docs/measurements/dark-contrast/min-opacity.mjs
node docs/measurements/dark-contrast/modal-min.mjs
node docs/measurements/dark-contrast/tinted-states.mjs
node docs/measurements/dark-contrast/min-opacity.mjs 0.5
node docs/measurements/dark-contrast/modal-min.mjs 0.5 0.65
node docs/measurements/dark-contrast/tinted-states.mjs 0.5 0.76 0.67
```

## Lowest glass per text color, computed 2026-10-06

`min-opacity.mjs`. A surface over white at both ends of its gradient. Each cell
gives the lowest opacity at which text passes, with the icon threshold (3:1) in
parentheses.

| text color | gradient `#232935` to `#2b353e` (bars, windows, menus) | flat `#232935` (popovers, search, viewer buttons) | flat `#191d25` (modals) |
|---|---|---|---|
| `#85a2af` | 1.00 (0.87) | 0.94 (0.82) | 0.89 (0.78) |
| `#97a5ab` | 0.98 (0.85) | 0.93 (0.80) | 0.88 (0.76) |
| `#aab6bb` | 0.91 (0.78) | 0.87 (0.74) | 0.82 (0.70) |
| `#b6bbc1` | 0.89 (0.76) | 0.84 (0.72) | 0.80 (0.68) |
| `#e0e0e0` | 0.77 (0.63) | 0.73 (0.60) | 0.69 (0.57) |
| `#ffffff` | 0.68 (0.53) | 0.64 (0.50) | 0.61 (0.47) |

At the opacities of commit `4dd51167`: top bar labels (`#97a5ab`, glass 0.75)
2.25, info popover titles (0.70) 2.17, viewer button icons (0.55) 1.38,
search placeholder (`#97a5ab` at 60%, glass 0.55) 1.22, which no opacity
brings to 4.5.

## App audit, commit 4dd51167, 2026-10-05

`app.json` and `inspector.json`. 89 groups of failures (same component, color
and requirement). By cause:

- Glass too thin for its text: bars, navigation dialogs, popovers, viewer
  buttons, search, modals. Cards inside a modal are lighter than the modal and
  fail first: periodic table names 3.49, mineral names 3.49, compound formulas
  3.39.
- Blue-gray text on glass: top bar labels 2.25, the Scanner label 2.05,
  section titles 2.25, the Layers dock label 3.63 (on an opaque surface,
  lightened by its tint).
- Category-colored text: catalog chips and tags 1.31 to 2.74, element badges
  2.22 (calcium) and 2.63 (FeO), the Inspector's chemical heading 1.81.
- Scanner windows on the light glass: white title 1.85, white text 1.61, the
  close button invisible.
- Text faded with `opacity`: Chemistry descriptions 2.33, derived index labels
  2.45.
- Visibility icons at 50%: green 2.57, red 1.88.

## App audit, commit 4dd51167 with overrides.css, 2026-10-06

`app-adjusted.json` and `inspector-adjusted.json`. No failure apart from the
exempt items, in every state of both plans.

`overrides.css` sets `.modal-overlay-container__modal` to its own 0.82 glass,
inside the overlay's 0.75. The two layers measure as one of about 0.955, so this
run did not test the modals at 0.82.

## App audit, implementation with modal glass 0.83, 2026-10-11

`app.json` and `inspector.json`, no overrides, one modal layer at 0.83. 9
groups:

| element | color | ratio | needs |
|---|---|---|---|
| catalog cell, hovered row | `#aab6bb` | 4.40 | 4.5 |
| catalog STAC link, hovered row | `#aab6bb` | 4.40 | 4.5 |
| selected mineral card: name, formula, grouping | `#b6bbc1` | 4.43 | 4.5 |
| catalog chip Compound, selected | `#f7e19c` | 4.44 | 4.5 |
| catalog chip Geographical, selected | `#a7e8bf` | 4.45 | 4.5 |
| catalog unavailable icon | `#e05353` | 2.60 | 3 |
| coordinate separator (exempt) | white at 40% | 3.00 | 4.5 |

The catalog rows are hovered because the pointer rests there after the plan's
clicks on the globe.

## Modal tinted states, computed 2026-10-11

`modal-min.mjs`. The modal over white and black, then the state's tint. A
selected or highlighted state replaces the card's resting fill.

| state | text | lowest modal glass | at 0.83 | at 0.86 |
|---|---|---|---|---|
| mineral or compound card, resting | `#b6bbc1` | 0.76 | 5.43 | 5.84 |
| mineral or compound card, selected | `#b6bbc1` | 0.84 | 4.43 | 4.85 |
| mineral or rock card, highlighted | `#b6bbc1` | 0.90 | 3.76 | 4.09 |
| mineral or rock card, highlighted | `#e0e0e0` | 0.76 | 5.50 | 5.99 |
| mineral or rock card, selected and highlighted | `#b6bbc1` | 0.82 | 4.74 | 5.16 |
| derived index card, active | `#aab6bb` | 0.85 | 4.33 | 4.76 |
| catalog cell, hovered row | `#aab6bb` | 0.84 | 4.40 | 4.85 |
| catalog unavailable icon, hovered row | `#e05353` | 0.90 | 2.41 | 2.65 |
| catalog unavailable icon, hovered row | `#ff5449` | 0.85 | 2.88 | 3.17 |
| catalog chips, selected, 40% category color | mixed | 0.82 to 0.85 | 4.36 to 4.63 | 4.68 to 4.98 |
| catalog chips, selected, 50% category color | mixed | 0.87 to 0.90 | 3.89 to 4.15 | 4.18 to 4.46 |
| catalog tags, hovered row, 40% category color | mixed | 0.76 to 0.82 | 4.66 to 5.46 | 5.06 to 5.93 |

The 0.83 column matches the audit where both cover a state (selected mineral
card 4.43, hovered catalog cell 4.40, Compound chip 4.44).

## App audit, implementation with modal glass 0.86, 2026-10-11

`app.json` and `inspector.json`, no overrides. Modal glass 0.86, `#e0e0e0` on
the orange highlight of mineral and rock cards, the catalog's unavailable icon
in `#ff5449`, the scanner menu's row icons at 40% category color, 60% white.
`app.json` finds the coordinate separator only; `inspector.json` finds the
coordinate separator and the feature point label. Both are exempt.

## App audit, implementation with scanner menu icons in category color, 2026-10-11

`app.json`, no overrides. As above, with the scanner menu's row icons in their
category color, at 70% opacity until the row is selected. The icons fail 3:1,
in the menu at rest and with rows selected; the compound icon passes.

| icon | color | ratio | needs |
|---|---|---|---|
| Chemical Elements | `#9333ea` | 1.44 | 3 |
| Mineral | `#3b82f6` | 1.99 | 3 |
| Derived Index | `#f97316` | 2.39 | 3 |

The icons are exempt: each sits beside its label and carries no information of
its own. Apart from them, the coordinate separator only.

## Tinted states, computed 2026-10-11

`tinted-states.mjs`, no filter, glass 0.92 as in the implementation before the
glass filter. Hover and selection tints that no plan reaches.

| state | text | ratio at 0.92 | lowest glass |
|---|---|---|---|
| scanner menu row, hovered (chemical, derived index, mineral, compound) | `#aab6bb` | 4.56, 4.22, 4.27, 3.95 | 0.92 to 0.97 |
| scanner menu row, hovered | `#e0e0e0` | 6.21 to 7.17 | 0.76 to 0.81 |
| Inspector pill or chart tab, hovered | `#b6bbc1` | 3.91 | 0.98 |
| Inspector pill or chart tab, selected | `#b6bbc1` | 3.31 | none |
| Inspector pill or chart tab, selected | `#e0e0e0` | 4.85 | 0.89 |
| Inspector menu item, focused | `#b6bbc1` | 4.32 | 0.94 |
| Inspector menu item, focused | `#e0e0e0` | 6.33 | 0.80 |
| Inspector dataset line, hovered (on its card) | `#aab6bb` | 5.04 | 0.87 |

## Lowest glass per text color at backdrop brightness 0.5, computed 2026-10-11

`min-opacity.mjs 0.5`. The same surfaces as the 2026-10-06 table, with the
white backdrop at half brightness.

| text color | gradient `#232935` to `#2b353e` | flat `#232935` | flat `#191d25` |
|---|---|---|---|
| `#85a2af` | 0.98 (0.63) | 0.86 (0.55) | 0.75 (0.49) |
| `#97a5ab` | 0.92 (0.58) | 0.81 (0.51) | 0.71 (0.45) |
| `#aab6bb` | 0.75 (0.41) | 0.66 (0.36) | 0.58 (0.32) |
| `#b6bbc1` | 0.69 (0.35) | 0.61 (0.31) | 0.53 (0.27) |
| `#e0e0e0` | 0.37 (0.00) | 0.32 (0.00) | 0.29 (0.00) |
| `#ffffff` | 0.12 (0.00) | 0.11 (0.00) | 0.09 (0.00) |

## Glass filter at brightness 0.5, computed 2026-10-11

Lowest glass per surface for everything it carries, with text on tints in
`#e0e0e0`, and the opacity set (one step of margin):

| surface | lowest | set | set by |
|---|---|---|---|
| bars, windows | 0.75 | 0.76 | `#aab6bb` labels |
| menus | 0.75 | 0.76 | `#aab6bb` row labels; tinted rows need 0.64 at most |
| popovers | 0.66 | 0.67 | `#aab6bb` titles |
| viewer buttons | 0.36 | 0.37 | `#aab6bb` icons at 3:1 |
| modals | 0.64 | 0.65 | the unavailable icon (3.04 at 0.65), the selected rock chip, the active derived index card |

`modal-min.mjs 0.5 0.65` and `tinted-states.mjs 0.5 0.76 0.67`: every state
passes at its surface's opacity; the selected Inspector tab in `#e0e0e0` reads
4.75 at 0.76.

## App audit, glass filter at brightness 0.5, 2026-10-11

`app.json` and `inspector.json`, with `--glass-filter` at `blur(8px)
brightness(0.5)` and the opacities above. The scanner menu's row icons in
category color (1.41, 1.94, 2.34), the coordinate separator (2.96) and the
feature point label: all exempt. The worst background seen behind the top bar
is `#3f474e`, the bar at 0.76 over white at half brightness.

The look, with the blur, was judged by eye in a desktop browser over the bright
limb.

## Findings

1. **The opacity of a glass surface is set by the darkest text it carries.**
   Over white, `#97a5ab` needs 0.98 on the gradient surfaces, so the blue-gray
   labels of commit `4dd51167` could not pass at any usable glass. `#aab6bb`,
   one step lighter in the same hue, brings the surfaces to about 0.9; lighter
   still is near white and loses the text hierarchy.
2. **Inside a modal, tints set the minimum.** A selection, hover or highlight
   tint lightens the glass under its text. The modal's minimum is 0.85, from
   the active derived index card, the rock chip and the unavailable icon,
   against 0.82 for text on the bare modal.
3. **Text on a strong tint takes the lightest text color.** The orange
   highlight would need 0.90 for `#b6bbc1`; `#e0e0e0` passes at 0.76.
4. **Category colors as text need 40% color, 60% white.** At 50% every selected
   catalog chip fails at 0.86; at 40% the hardest needs 0.85.
5. **Text faded with `opacity` fails where its color passes.** Opacity darkens
   text toward its background.
6. **White text on the light scanner glass fails at any opacity.** The scanner
   windows take the dark glass of the other windows.
7. **An override stylesheet can add layers the implementation lacks.** The
   2026-10-06 run passed the modals because `overrides.css` stacked a second
   glass; the implementation needed its own run.
8. **Darkening the backdrop lowers every minimum and keeps the blur.** At half
   brightness the bars and windows need 0.75 against 0.91, popovers 0.66
   against 0.87, viewer buttons 0.36 against 0.74, modals 0.64 against 0.85.
9. **Hover and selection tints need the lightest text.** A tinted row or tab
   with blue-gray text fails at the opacities that pass its resting state, and
   a selected Inspector tab in `#b6bbc1` fails at any opacity. In `#e0e0e0`
   every tinted state passes. The audit plans do not reach these states.

## Harness limitations

- Headless Firefox does not draw `backdrop-filter`. The audit reads the
  brightness from the computed style and models it; the blur averages the
  backdrop and does not change the white and black extremes. The look of both
  is judged in a normal browser window.
- The backdrop is white or black, not the globe's pixels. White is the worst
  case for light text and bounds every real backdrop.
- Hover states are measured only where the pointer happens to rest. The plans
  do not hover each element; `tinted-states.mjs` and `modal-min.mjs` compute
  the tinted states instead.
- States outside the plans are not measured: the scanner bars with live data,
  tooltips, the stat popover, the comparison view, dropdowns (layer gradient,
  variant selector), the measurement tool's labels. `modal-min.mjs` computes
  the highlighted and combined mineral card states, which no plan reaches.
- The audit skips disabled elements and emoji, reports text over a background
  image as unmeasured, and does not read text shadows, so the feature point
  label (white with a dark halo) counts as a failure and is judged by eye.
- The plans find elements by CSS module class names and visible text; a
  renamed class or label breaks a step, which the driver reports.
