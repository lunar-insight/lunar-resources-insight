// Run in the app page before the plan moves the pointer. Records for 2.5 s,
// as record.js does, the time of every animation frame and every Cesium render
// longer than 30 ms. report.js summarizes them.
(() => {
  const container = document.querySelector('.cesium-viewer').parentElement;
  let fiber = container[Object.keys(container).find(key => key.startsWith('__reactFiber$'))];
  let viewer = null;
  while (fiber && !viewer) {
    for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {
      if (hook.memoizedState && hook.memoizedState.scene) { viewer = hook.memoizedState; break; }
    }
    fiber = fiber.return;
  }

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

  const start = performance.now();
  window.__start = start;
  const tick = time => {
    window.__frames.push(Math.round(time - start));
    if (time - start < 2500) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return 'recording';
})()
