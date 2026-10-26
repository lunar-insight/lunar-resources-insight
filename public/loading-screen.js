(function () {
  // ── Material Symbols font preload ──────────────────────────────────────
  if ('FontFace' in window) {
    var msf = new FontFace(
      'Material Symbols Outlined',
      "url('/symbols/MaterialSymbolsOutlined-Regular.ttf')",
      { style: 'normal', weight: '400', display: 'block' }
    );
    document.fonts.add(msf);
    msf.load();
  }

  // ── Phase 1: progress bar animation while React + Cesium load ───────────
  var bar = document.getElementById('progress-bar');
  var pctEl = document.getElementById('loading-pct');
  if (bar) {
    var start = performance.now(), raf;
    // Burst (fast initial rise) + linear (constant 2 %/s thereafter).
    // Rate never drops below 2 %/s so the bar always visibly moves regardless
    // of how long Cesium takes to start firing tile events.
    var BURST_CEIL = 20, BURST_TAU = 1500, LINEAR = 0.002, CAP = 85;
    function tick(now) {
      var e = now - start;
      var p = Math.min(CAP, BURST_CEIL * (1 - Math.exp(-e / BURST_TAU)) + e * LINEAR);
      bar.style.width = p.toFixed(2) + '%';
      if (pctEl) pctEl.textContent = Math.round(p) + '%';
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    window.__loadingPhase1Stop = function () {
      cancelAnimationFrame(raf);
      return parseFloat(bar.style.width) || 0;
    };
  }

  // ── Globe and canvas animation ─────
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var cx = 1320, cy = 400, Rg = 520;
  var lat0 = 20 * Math.PI / 180, d = Math.PI / 180;
  function proj(la, lo) {
    var lat = la * d, lon = lo * d, cosLat = Math.cos(lat);
    var z = Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * cosLat * Math.cos(lon);
    return {
      x: cx + Rg * cosLat * Math.sin(lon),
      y: cy - Rg * (Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * cosLat * Math.cos(lon)),
      z: z,
    };
  }

  function buildMoon(svg) {
    var defs = document.createElementNS(SVG_NS, 'defs');
    var grad = document.createElementNS(SVG_NS, 'radialGradient');
    grad.id = 'gmoon';
    grad.setAttribute('cx', '34%'); grad.setAttribute('cy', '30%'); grad.setAttribute('r', '85%');
    [['0%', '#171b26'], ['55%', '#0b0e16'], ['100%', '#05070d']].forEach(function(s) {
      var stop = document.createElementNS(SVG_NS, 'stop');
      stop.setAttribute('offset', s[0]); stop.setAttribute('stop-color', s[1]);
      grad.appendChild(stop);
    });
    defs.appendChild(grad);
    svg.appendChild(defs);

    var disc = document.createElementNS(SVG_NS, 'circle');
    disc.setAttribute('cx', cx); disc.setAttribute('cy', cy); disc.setAttribute('r', Rg);
    disc.setAttribute('fill', 'url(#gmoon)');
    svg.appendChild(disc);

    function addLine(pts) {
      if (pts.length < 2) return;
      var poly = document.createElementNS(SVG_NS, 'polyline');
      poly.setAttribute('points', pts.map(function(p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' '));
      poly.setAttribute('stroke', 'rgba(125,155,205,.16)');
      poly.setAttribute('stroke-width', '1');
      poly.setAttribute('fill', 'none');
      svg.appendChild(poly);
    }

    var lo, la, seg, p;
    for (lo = -160; lo <= 160; lo += 20) {
      seg = [];
      for (la = -90; la <= 90; la += 4) {
        p = proj(la, lo); if (p.z >= 0) seg.push(p); else { addLine(seg); seg = []; }
      }
      addLine(seg);
    }
    for (la = -60; la <= 60; la += 20) {
      seg = [];
      for (lo = -180; lo <= 180; lo += 4) {
        p = proj(la, lo); if (p.z >= 0) seg.push(p); else { addLine(seg); seg = []; }
      }
      addLine(seg);
    }

    var limb = document.createElementNS(SVG_NS, 'circle');
    limb.setAttribute('cx', cx); limb.setAttribute('cy', cy); limb.setAttribute('r', Rg);
    limb.setAttribute('fill', 'none');
    limb.setAttribute('stroke', 'rgba(61,169,252,.30)');
    limb.setAttribute('stroke-width', '1.5');
    svg.appendChild(limb);
  }

  var canvasEl = document.getElementById('loading-canvas');
  var svgEl    = document.getElementById('loading-globe');

  try { if (svgEl) buildMoon(svgEl); } catch (e) {}

  // ── Canvas worker ──────────────────────────────────────────────────────
  var worker = null;
  if (canvasEl && typeof OffscreenCanvas !== 'undefined' && canvasEl.transferControlToOffscreen) {
    try {
      var w   = canvasEl.clientWidth;
      var h   = canvasEl.clientHeight;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var offscreen = canvasEl.transferControlToOffscreen();
      worker = new Worker('/loading-canvas-worker.js');
      worker.postMessage({ type: 'init', canvas: offscreen, w: w, h: h, dpr: dpr }, [offscreen]);
      window.addEventListener('resize', function() {
        if (worker) worker.postMessage({
          type: 'resize',
          w:   canvasEl.clientWidth,
          h:   canvasEl.clientHeight,
          dpr: Math.min(2, window.devicePixelRatio || 1),
        });
      });
    } catch (e) {
      worker = null;
    }
  }

  window.__loadingGlobeBuilt    = true;
  window.__loadingSetFloodStart = function() {
    if (worker) worker.postMessage({ type: 'flood' });
  };
  window.__loadingCancelCanvas  = function() {
    if (worker) { worker.postMessage({ type: 'cancel' }); worker = null; }
  };
})();
