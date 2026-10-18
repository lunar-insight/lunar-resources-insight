# Colors and contrast

## Scope

How the interface's colors are defined and chosen: the palette, the semantic
tokens that components read, the glass surfaces and how their opacity is set,
and the rules for text, state and category colors. Covers the stylesheets and
the places where TypeScript sets a color. Excludes the colormaps that render
map layers, and the colors Cesium draws on the globe (feature shapes, labels).

## Structure

```
 palette                    --slate-100 (lightest) ... --slate-950 (darkest), --steel-400
   raw values                 read only by the semantic tokens
        |
        v
 semantic tokens            --text-*  --surface-*  --border-*  --control-*
   src/global.css :root     --status-*  --selection-*  --category-*  --badge-*
        |                   --glass-*  ->  --surface-bar / window / menu / popover /
        |                                  viewer-button / modal
        v
 component stylesheets      var(--token)
   and TypeScript           translucent step:  color-mix(in srgb, var(--token) N%, transparent)
                            category text:     color-mix(in srgb, <color> var(--tinted-text), white)
```

## Design rationale

Dark is the only theme. Most panes are glass: a translucent background over a
blurred and darkened view of the globe, which ranges from black space to the
bright limb of the Moon. Over the limb the backdrop shows through and lightens
the pane, so light text loses contrast exactly where the Moon is brightest.

Every text and icon meets WCAG AA in the worst case: 4.5:1 for text, 3:1 for
large text, icons and state indicators. A pane is checked composited over a
white backdrop (the worst case for light text) and a black one, through every
nested background and parent opacity, at both ends of its gradient. Blur
averages the backdrop and does not change these extremes; the darkening scales
the white down before the glass covers it.

The evidence is in `docs/measurements/dark-contrast/`. Three consequences
shape the token set. First, the opacity of each glass surface is a contrast
decision, not a style choice: it is the lowest opacity at which the darkest
text drawn on that surface still passes over the darkened white, plus one step
of margin against rounding in the browser's compositing. Second, the backdrop
is darkened so that this opacity stays low: the globe stays visible through
the panes, dimmed, and the blur is kept. Third, the text hierarchy stays within
light blue-grays: a darker gray would force a nearly opaque glass, and pure
white for everything would lose the hierarchy.

## Components

### Palette

One kebab-case scale of slate grays, numbered from lightest (100) to darkest
(950), and one accent hue, steel. Palette tokens name a value, not a use.
Components never read them; semantic tokens do. A new palette value is added
only when a semantic token needs it.

### Text

| token | use |
|---|---|
| `--text-primary` | values, emphasis, and any text on a tint (a selected row, a selected cell, a highlighted card) |
| `--text-body` | body text and values in panels |
| `--text-secondary` | labels, section titles, meta lines, placeholders, icons on glass |
| `--text-accent` | titles on opaque title bars, the navigation and the sidebars |
| `--text-on-light` | text on a light fill: tooltips, the accent button |

Rules:

- On glass, no text is darker than `--text-secondary`. `--text-accent` is
  darker and is used on opaque surfaces only.
- Text on a tint takes `--text-primary`. A tint lightens the glass behind the
  text, which is why a selected or highlighted state needs lighter text than
  its resting state.
- Text is never faded with `opacity`. Opacity darkens text below its color; a
  lighter token gives the intended hierarchy instead. Disabled elements are the
  exception, since they need no ratio.

### Surfaces and glass

Opaque surfaces: `--surface-app` (title bars, opaque popovers and lists),
`--surface-raised` (the far end of the navigation and sidebar gradients),
`--surface-logo`, `--surface-tooltip`.

Every glass surface applies `--glass-filter` as its `backdrop-filter`: a blur
and `brightness(var(--glass-brightness))`, which darkens what lies behind the
pane. Each surface then takes one opacity token, so a value lives in one place.
The opacities hold for the brightness in `--glass-brightness`; changing it
means recomputing them. A browser without `backdrop-filter` shows the globe at
full brightness, so an `@supports` rule in `global.css` raises every opacity
to the value it needs without the filter.

| surface | opacity token | used by | opacity set by |
|---|---|---|---|
| `--surface-bar` | `--glass-bar` | `TopBar`, `BottomBar` | `--text-secondary` labels |
| `--surface-window` | `--glass-window` | navigation dialogs (`DraggableContentContainer`), floating windows (`DraggableBoxContentContainer`: the Inspector, the scanners) | `--text-secondary` labels |
| `--surface-menu` | `--glass-menu` | the scanner menu, the globe menu, the color picker | `--text-secondary` labels |
| `--surface-popover` | `--glass-popover` | info and stat popovers, Inspector menus, the search field and result callout, a saved point's box, the toast | `--text-secondary` on a flat background |
| `--surface-viewer-button` | `--glass-viewer-button` | viewer buttons, the compass, the search close button | icons only, at 3:1 |
| `--surface-modal` | `--glass-modal` | `ModalOverlayContainer`: periodic table, compounds, derived indices, minerals, layers catalog | text on tints inside the modal |

The modal's opacity is set by its content, not by its own color: hovered
catalog rows, selected cards and selected category chips sit on tints that
lighten the glass, and their text needs more opacity than text on the bare
modal.

Hover and pressed states of a glass surface keep its opacity
(`--surface-viewer-button-hover`, `-pressed`); a lower opacity on hover would
fail the text on hover.

Hover and selection tints inside a pane follow the text rule above: the
scanner menu's hovered rows, the globe menu's items, the Inspector's pills, chart tabs and menu items,
and the dataset picker's options draw their text in `--text-primary` while
tinted.

Changing a surface means re-checking it: lowering an opacity, drawing darker
text on a surface, or adding a stronger tint inside it can each break a ratio.

### Borders

`--border-subtle` for dividers and control frames, `--border-strong` for title
bar rules, selected frames and hover outlines, `--border-bright` for frames
drawn in the body text color (the gradient select, the dataset picker), `--border-pane` for the edge of glass panes,
`--border-glass` for the edge of popovers and viewer buttons, `--border-card`
for cards in the Inspector. Borders need no ratio where the filled control or
its icon already identifies the element.

### Controls

Buttons, checkboxes, inputs and toggles read `--control-*`: a background for
each state (`-bg`, `-bg-hover`, `-bg-pressed`, `-bg-selected`, and `-bg-active`
for the pressed state of the navigation and the image buttons), `--control-border`,
`--control-icon`, and for the selected state `--control-border-selected` and
`--control-icon-selected`. `--focus-ring` draws keyboard focus; the selection
modals and the layers catalog draw it in `--selection-active` instead.

### Status

`--status-success` and `--status-danger` are the state colors of the visibility
icons (visible, hidden) and of destructive actions, at full color, so the state
reads at 3:1. `--status-error` is a lighter red for the unavailable mark of the
layers catalog, which sits on the modal glass where `--status-danger` does not
reach 3:1.

### Category and element colors

`--category-*` holds one color per layer category. It colors tints, accent
stripes, borders and the scanner menu rows, in the layer list, the layers
catalog, the scanner menu and the Inspector. Element and compound accents come
from `colorUtils.ts`, one hue per element or compound.

A category or element color does not reach 4.5:1 as text on glass. Text and
icons drawn in one mix it with white: `color-mix(in srgb, <color>
var(--tinted-text), white)`, where `--tinted-text` is the color's share. This
covers the Inspector's group headings, the catalog's category tags and filter
chips, the layer list's element badges, and the scanner menu's checkmarks.
The scanner menu's row icons keep the category color itself: each sits beside
its label and carries no information of its own, and the color matches the
category on the map.

The Inspector reads category colors through `CATEGORY_COLOR`. Its chemical
entry is `--category-chemical-on-dark`, a lighter violet: the Inspector draws
bars and sparklines on dark wells, where the category violet is too dark.

### Selection modals

`--selection-neutral`, `--selection-active` and `--selection-unavailable` color
the resting, selected and unavailable states of the cards and cells in the
selection modals. The minerals modal adds a highlight (a mineral's rocks, or a
rock's minerals, on hover) and a combined selected and highlighted state; their
colors are local to `_colors.scss`.

### Colors set in code

- `ResourceBarsVisualizer.tsx` draws the scanner bars with D3; the axis and
  value text read `var(--text-primary)`.
- `CATEGORY_COLOR` (`lineView.ts`) and the scanner menu's `accentColor`
  (`ScannerButton.tsx`) pass `var(--category-*)` strings.
- `SERIES_COLORS` (`chartSelection.ts`) is the Inspector chart palette. Its
  order keeps neighboring slots apart for color blind readers, and each color
  clears 3:1 on the chart background (see `feature-inspector.md`).

Colors that belong to a single component's data stay literal in that component:
the scanner unit colors, the measurement cyan, the search marker orange, the
point drop's teal probe, flash and rings and its cyan flying dot, black and
white overlays and shadows.

### Checking contrast

A change to a color, an opacity or a tint is checked by the method in Design
rationale: composite over white and black, keep the worst ratio. The audit in
`docs/measurements/dark-contrast/` does this for every visible text and icon of
the running app, through `scripts/firefox-bidi/drive.mjs`; its README gives the
commands, and its scripts compute the lowest opacity for a surface, text color
and backdrop brightness without the app. The audit reads the brightness from
each pane's computed `backdrop-filter`, and runs only through the states its
plans reach: a new hover or selection state is checked with the scripts. Headless Firefox does not
draw `backdrop-filter`, so the blur itself is judged in a normal browser
window, over the bright limb.

Exempt from a ratio: disabled elements, the scanner menu's row icons (each
beside its label), the coordinate separator (punctuation between values), the feature point label on the globe (white with a text
shadow as its halo), and the scrambled characters of the info popover's
animation.

## Configuration reference

| concern | defined in |
|---|---|
| Palette, semantic tokens, glass opacities, category and status colors | `src/global.css` |
| Inspector category colors | `src/components/inspector/lineView.ts` |
| Inspector chart palette | `src/services/inspector/chartSelection.ts` |
| Element and compound accent colors | `src/utils/colorUtils.ts` |
| Minerals modal highlight colors | `src/components/navigation/MineralsSection/_colors.scss` |
| Scanner unit colors | `src/components/viewer/ResourceBarsVisualizer/ResourceBarsVisualizer.module.scss` |
| Scanner menu row accents | `src/components/layout/Button/ScannerButton/ScannerButton.tsx` |
