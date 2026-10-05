# Firefox BiDi driver

Controls a headless Firefox from a JSON plan: open a page, wait until it is
ready, run JavaScript, click and take screenshots. It uses WebDriver BiDi, a
protocol built into Firefox, so it needs nothing beyond Firefox and Node 22 or
later.

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
open Firefox is not affected. The script exits with code 1 when a step fails or
a wait times out.

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
| `steps` | Run one after another. A step can hold any of `click`, `js`, `wait` and `shot`, done in that order. |
| `click` | A mouse click at `[x, y]`, in pixels from the top left of the page. It works on canvases such as the Cesium globe, which ignore `element.click()`. |
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

## Checking a component with fixed data

Add a temporary `.html` page and `.tsx` module at the repository root. The
development server serves the repository, so the page opens at
`http://localhost:5173/<name>.html`. Have the page set a global flag once it has
rendered, such as `window.ready = true`, and use it as `waitFor`. Delete both
files after the check.
