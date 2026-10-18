// Writes the drive.mjs plans of the point drop frame measurement into a folder.
//
//   node docs/measurements/point-drop-frames/frame-plans.cjs <out-dir>
//
// globe.json: two copies, then three drops, on the whole globe.
// close-up.json: two drops in a close-up 9 km above the ground, tilted toward the horizon.
// scanner.json: with the Chemical Elements scanner open, three pointer sweeps
// on the whole globe, then three in the close-up.
const fs = require('node:fs');
const path = require('node:path');

const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: node frame-plans.cjs <out-dir>');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const record = item => read('record.js').replaceAll('ITEM', item);
const report = read('report.js');

// The app at its default camera, once its buttons and the globe have loaded.
const page = steps => ({
  url: 'http://localhost:5173/',
  width: 1400,
  height: 900,
  waitFor: "[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'shapesFeatures')",
  delay: 9000,
  steps,
});

// A right click on the globe, then the item, then the report.
const choose = (at, item) => [
  { rightClick: at, wait: 900 },
  { js: record(item), wait: 2700 },
  { js: report, wait: 100 },
];

const closeUp = `(() => {
  const container = document.querySelector('.cesium-viewer').parentElement;
  let fiber = container[Object.keys(container).find(key => key.startsWith('__reactFiber$'))];
  let viewer = null;
  while (fiber && !viewer) {
    for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {
      if (hook.memoizedState && hook.memoizedState.scene) { viewer = hook.memoizedState; break; }
    }
    fiber = fiber.return;
  }
  const toRadians = degrees => degrees * Math.PI / 180;
  viewer.camera.setView({
    destination: viewer.scene.globe.ellipsoid.cartographicToCartesian({ longitude: toRadians(-50.5), latitude: toRadians(22), height: 9000 }),
    orientation: { heading: 0, pitch: -0.42, roll: 0 },
  });
  return 'close-up';
})()`;

const openScanner = [
  { js: "document.querySelector('[aria-label=\"Scanner\"]').click(); 'menu'", wait: 600 },
  { js: "document.querySelector('[aria-label=\"Chemical Elements\"]').click(); 'scanner'", wait: 600 },
  // A click on the sky closes the scanner menu, whose underlay would cover the globe.
  { click: [150, 820], js: "document.querySelectorAll('[data-testid=underlay]').length", wait: 1500 },
];
// The pointer goes around a diamond of 120 px radius on the upper left of the
// globe, clear of the scanner window, 600 ms per side, while sweep.js records.
const sweep = [
  { move: [600, 210], wait: 300 },
  { js: read('sweep.js'), wait: 0 },
  { move: [720, 330, 600], wait: 0 },
  { move: [600, 450, 600], wait: 0 },
  { move: [480, 330, 600], wait: 0 },
  { move: [600, 210, 600], wait: 300 },
  { js: report, wait: 300 },
];

const plans = {
  'globe.json': { pages: [page([
    ...choose([700, 420], 'Copy coordinates'),
    ...choose([600, 500], 'Copy coordinates'),
    ...choose([700, 420], 'Create point'),
    ...choose([600, 500], 'Create point'),
    ...choose([800, 350], 'Create point'),
  ])] },
  'close-up.json': { pages: [page([
    { js: closeUp, wait: 8000 },
    ...choose([740, 560], 'Create point'),
    ...choose([600, 620], 'Create point'),
  ])] },
  'scanner.json': { pages: [page([
    ...openScanner,
    ...sweep, ...sweep, ...sweep,
    { js: closeUp, wait: 8000 },
    ...sweep, ...sweep, ...sweep,
  ])] },
};

for (const [name, plan] of Object.entries(plans)) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(plan, null, 1));
  console.log(path.join(outDir, name));
}
