// Run in the app page, with ITEM replaced by a globe menu item's label, while
// the globe menu is open. Chooses the item, then records for 2.5 s the time of
// every animation frame and every Cesium render longer than 30 ms, both from
// the choice. report.js summarizes them.
(() => {
  const container = document.querySelector('.cesium-viewer').parentElement;
  const fiberKey = Object.keys(container).find(key => key.startsWith('__reactFiber$'));
  let fiber = container[fiberKey];
  let viewer = null;
  while (fiber && !viewer) {
    for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {
      const value = hook.memoizedState;
      if (value && value.scene && value.camera) { viewer = value; break; }
    }
    fiber = fiber.return;
  }

  const start = performance.now();
  window.__frames = [];
  window.__slowRenders = [];
  if (!viewer.__timed) {
    const render = viewer.scene.render.bind(viewer.scene);
    viewer.scene.render = (...args) => {
      const before = performance.now();
      const result = render(...args);
      const duration = performance.now() - before;
      if (duration > 30) window.__slowRenders.push([Math.round(before - window.__start), Math.round(duration)]);
      return result;
    };
    viewer.__timed = true;
  }
  window.__start = start;

  const tick = time => {
    window.__frames.push(Math.round(time - start));
    if (time - start < 2500) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  [...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent.includes('ITEM')).click();
  return 'recording';
})()
