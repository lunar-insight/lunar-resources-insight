# Firefox BiDi driver

Controls a headless Firefox from a JSON plan: open a page, wait until it is
ready, run JavaScript, click and take screenshots. It uses WebDriver BiDi, a
protocol built into Firefox, so it needs nothing beyond Firefox and Node 22 or
later. Adding the app helpers to a plan takes Python 3.

`firefox --screenshot` takes one picture as soon as the page loads and cannot
click. Use this driver when a page loads data or draws after loading, or when a
check needs clicks, as the app does.

## Running

```
node scripts/firefox-bidi/drive.mjs <plan.json>
```

The script starts Firefox from `FIREFOX_PATH` when it is set, otherwise from
`C:/Program Files/Mozilla Firefox/firefox.exe` on Windows and `firefox` on other
systems. Each run uses a new temporary profile and deletes it at the end, so an
open Firefox is not affected. The profile gets the prefs in `locked.user.js`:
pages cannot reach any address other than localhost, and navigating elsewhere
fails. Errors the page logs or throws, including CSP violations, are printed as
`page error:` lines. The script exits with code 1 when a step fails or a wait
times out.

## Plan

```json
{
  "pages": [
    {
      "url": "http://localhost:5173/",
      "width": 1400,
      "height": 900,
      "waitFor": "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'shapesFeatures')",
      "waitForTimeout": 60000,
      "delay": 6000,
      "steps": [
        { "js": "[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'shapesFeatures').click()", "wait": 1200 },
        { "js": "document.querySelector('[aria-label=\"Draw points\"]').click()", "wait": 600 },
        { "click": [600, 330], "wait": 1500, "shot": "out/point.png" },
        { "js": "document.querySelector('[aria-label=\"Inspect\"]').click()", "wait": 5000 }
      ],
      "shot": "out/inspector.png"
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `url` | Page to open. |
| `width`, `height` | Page size in pixels, 1400 × 900 by default. |
| `waitFor` | JavaScript expression, checked every 200 ms until it is true. The run fails if it is still false after `waitForTimeout` milliseconds (60000 by default). |
| `delay` | Milliseconds to wait after `waitFor`. In the app the buttons appear before the globe has loaded, so a click on the globe needs a delay. |
| `steps` | Run one after another. A step can hold any of `click`, `rightClick`, `move`, `js`, `wait` and `shot`, done in that order. |
| `click` | A mouse click at `[x, y]`, in pixels from the top left of the page. It works on canvases such as the Cesium globe, which ignore `element.click()`. |
| `rightClick` | The same with the right button, which opens the globe menu. |
| `move` | Moves the mouse to `[x, y]` without a click, in a straight line over an optional third value in milliseconds. The step waits for the move to end. |
| `js` | JavaScript run in the page. The script waits for a returned promise and prints the result. |
| `wait` | Milliseconds to wait after the step's click and JavaScript, 700 by default. |
| `shot` | Path of a screenshot, relative to the folder the script runs from. A `shot` on the page itself is taken after all its steps. |

Before the steps, the script waits for the page's fonts to load, since text
stays invisible until then.

## Finding buttons

React Aria buttons accept `element.click()`. Find a button by its `aria-label`,
for example `[aria-label="Inspect"]`, or by its text when it has no label. An
icon adds its name to the button's text: the Features button reads
`shapesFeatures`, the icon `shapes` followed by the label.

## Helpers for the app

`app-helpers.js` defines page functions for checks on the app. `add-helpers.py`
writes a copy of a plan whose pages run it as their first step:

```
python -I scripts/firefox-bidi/add-helpers.py <plan.json> <out.json>
node scripts/firefox-bidi/drive.mjs <out.json>
```

| Function | Does |
|---|---|
| `sleep(ms)`, `until(test, timeoutMs)` | Waits a time, or until `test()` returns a truthy value (null after the timeout). |
| `contextValue(test)` | The first React context value that passes `test`. |
| `viewer()`, `features()`, `inspectorStore()` | The Cesium viewer, the features list and the Inspector store. |
| `lookAt(lon, lat, heightM)` | Camera above a point, looking straight down. |
| `placeAt(lon, lat, x, y)` | Moves the camera until that point shows at page pixel `x`, `y`, for example to draw around a pole with `click` steps. |
| `groundAt(x, y)` | Longitude and latitude under a page pixel. |
| `addPoint(id, [lon, lat])`, `addPolygon(id, vertices)`, `addCircle(id, center, radiusM)` | Adds a feature at exact coordinates in degrees, with its Inspector open. The globe does not draw it. |
| `results(id)`, `waitReady(id)` | A feature's Inspector results, and a wait until they are ready. |
| `requests(prefix)` | Count, statuses and slowest time of the requests whose path starts with `prefix`, such as `/cog/statistics`. |

A step's `const` stays declared for the steps after it, so wrap a step's code in
a function when it declares names. The helpers find the app's state through
React's internal fibers: a React upgrade can break them, and nothing in the app
depends on them. They run on the production build too.

## Checking a component with fixed data

Add a temporary `.html` page and `.tsx` module in `src/scratch/`, which git
ignores. The development server serves `src`, so the page opens at
`http://localhost:5173/src/scratch/<name>.html`. Have the page set a global flag
once it has rendered, such as `window.ready = true`, and use it as `waitFor`.
Delete both files after the check.
