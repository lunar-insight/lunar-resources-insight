// Page helpers for drive.mjs plans on the app: reach its React state, point the
// camera, add features at exact coordinates and read Inspector results. They read
// React's internal fibers, so a React upgrade can break them. A check tool, not part
// of the app. add-helpers.py puts this file first in each page of a plan.
(() => {
  const MOON_RADIUS_M = 1737400;
  const rad = degrees => (degrees * Math.PI) / 180;
  const deg = radians => (radians * 180) / Math.PI;
  const surface = (lon, lat, heightM = 0) => {
    const r = MOON_RADIUS_M + heightM;
    return { x: r * Math.cos(rad(lat)) * Math.cos(rad(lon)), y: r * Math.cos(rad(lat)) * Math.sin(rad(lon)), z: r * Math.sin(rad(lat)) };
  };
  const cartographic = ([lon, lat]) => ({ longitude: rad(lon), latitude: rad(lat), height: 0 });

  window.sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  /** The first truthy value of `test`, checked every 200 ms, or null after `timeoutMs`. */
  window.until = async (test, timeoutMs = 90000) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      const value = test();
      if (value) return value;
      await sleep(200);
    }
    return null;
  };

  /** The first React context value, or other `value` prop, that passes `test`. */
  window.contextValue = test => {
    const root = document.getElementById('app');
    const key = Object.keys(root).find(k => k.startsWith('__reactContainer'));
    const stack = [root[key]];
    while (stack.length) {
      const fiber = stack.pop();
      if (!fiber) continue;
      const value = fiber.memoizedProps?.value;
      if (value && typeof value === 'object' && test(value)) return value;
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child) stack.push(fiber.child);
    }
    return null;
  };

  window.viewer = () => contextValue(v => v.viewer?.camera)?.viewer;
  const featuresContext = () => contextValue(v => Array.isArray(v.features) && v.addFeature);
  window.features = () => featuresContext()?.features ?? [];
  window.inspectorStore = () => contextValue(v => typeof v.store?.get === 'function' && typeof v.store?.sync === 'function')?.store;
  window.results = id => inspectorStore()?.get(id);
  /** Waits until a feature's Inspector results are ready; returns their status. */
  window.waitReady = async (id, timeoutMs = 120000) => {
    await until(() => results(id)?.status === 'ready', timeoutMs);
    return results(id)?.status;
  };

  /** Camera `heightM` above a point, looking straight down, north up. */
  window.lookAt = async (lon, lat, heightM = 900000) => {
    viewer().camera.setView({ destination: surface(lon, lat, heightM), orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 } });
    await sleep(1500);
    return JSON.stringify(groundAt(innerWidth / 2, innerHeight / 2));
  };

  /** Moves the camera sideways until the point at `lon`, `lat` shows at page pixel `x`, `y`. */
  window.placeAt = async (lon, lat, x, y) => {
    const v = viewer();
    const target = surface(lon, lat);
    const metersPerPixel = v.camera.positionCartographic.height * 0.000889;
    for (let i = 0; i < 8; i++) {
      const p = v.scene.cartesianToCanvasCoordinates(target);
      if (!p) return 'off screen';
      const rect = v.canvas.getBoundingClientRect();
      v.camera.moveRight((p.x + rect.left - x) * metersPerPixel);
      v.camera.moveDown((p.y + rect.top - y) * metersPerPixel);
      v.scene.requestRender();
      await sleep(250);
    }
    await sleep(2500);
    return JSON.stringify(groundAt(x, y));
  };

  /** Longitude and latitude on the globe under page pixel `x`, `y`, or null off the globe. */
  window.groundAt = (x, y) => {
    const v = viewer();
    const rect = v.canvas.getBoundingClientRect();
    const p = v.camera.pickEllipsoid({ x: x - rect.left, y: y - rect.top }, v.scene.globe.ellipsoid);
    if (!p) return null;
    const c = v.scene.globe.ellipsoid.cartesianToCartographic(p);
    return { lon: deg(c.longitude), lat: deg(c.latitude) };
  };

  // Features added here have no entity, so the globe does not draw them; the
  // Inspector reads them as it reads drawn ones.
  const add = (id, type, metadata, inspectorOpen) => {
    featuresContext().addFeature({
      id, type, name: id, entity: {}, color: '#4cc9f0', inspectorOpen, visible: true,
      metadata: { createdAt: new Date(), ...metadata },
    });
    return id;
  };
  /** Adds a point at `[lon, lat]` in degrees, its Inspector open unless `inspect` is false. */
  window.addPoint = (id, point, inspect = true) => add(id, 'point', { position: cartographic(point) }, inspect);
  /** Adds a polygon from `[lon, lat]` vertices in degrees. */
  window.addPolygon = (id, points, inspect = true) => add(id, 'polygon', { positions: points.map(cartographic) }, inspect);
  /** Adds a circle around `[lon, lat]` in degrees, of `radiusM` meters. */
  window.addCircle = (id, center, radiusM, inspect = true) => add(id, 'circle', { center: cartographic(center), radius: radiusM }, inspect);

  /** Count, statuses and slowest time of the requests whose path starts with `prefix`, such as `/cog/statistics`. */
  window.requests = prefix => {
    const list = performance.getEntriesByType('resource').filter(e => new URL(e.name).pathname.startsWith(prefix));
    return JSON.stringify({
      count: list.length,
      statuses: [...new Set(list.map(e => e.responseStatus))],
      slowestS: +(Math.max(0, ...list.map(e => e.duration)) / 1000).toFixed(2),
    });
  };
  performance.setResourceTimingBufferSize(20000);
})();
'app helpers';
