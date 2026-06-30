'use strict';

var cx = 1320, cy = 400, Rg = 520;
var lat0 = 20 * Math.PI / 180, d = Math.PI / 180;
var orbits = [
  { a: 600, S: 0.52, R: -12, period: 16, phase: 0 },
  { a: 735, S: 0.50, R:  76, period: 23, phase: 120 },
];

function proj(la, lo) {
  var lat = la * d, lon = lo * d, cosLat = Math.cos(lat);
  var z = Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * cosLat * Math.cos(lon);
  return {
    x: cx + Rg * cosLat * Math.sin(lon),
    y: cy - Rg * (Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * cosLat * Math.cos(lon)),
    z: z,
  };
}

function buildTiles() {
  var sz = 4, gap = 0.84;
  var deep = [40, 108, 214], light = [128, 198, 255];
  function lerp(a, b, t) { return a + (b - a) * t; }
  var tiles = [], la, lo, c, raw, mx, my, r;
  for (la = -84; la < 84; la += sz) {
    for (lo = -180; lo < 180; lo += sz) {
      c = proj(la + sz / 2, lo + sz / 2);
      if (c.z < 0.06) continue;
      raw = [proj(la, lo), proj(la + sz, lo), proj(la + sz, lo + sz), proj(la, lo + sz)];
      if (raw[0].z < 0 || raw[1].z < 0 || raw[2].z < 0 || raw[3].z < 0) continue;
      mx = (raw[0].x + raw[1].x + raw[2].x + raw[3].x) / 4;
      my = (raw[0].y + raw[1].y + raw[2].y + raw[3].y) / 4;
      r = ((Math.sin(la * 12.9898 + lo * 78.233) * 43758.5453) % 1 + 1) % 1;
      tiles.push({
        corners: raw.map(function(p) { return { x: mx + (p.x - mx) * gap, y: my + (p.y - my) * gap }; }),
        ang: Math.acos(Math.min(1, c.z)),
        baseOp: 0.16 + r * 0.30,
        col: [lerp(deep[0], light[0], r) | 0, lerp(deep[1], light[1], r) | 0, lerp(deep[2], light[2], r) | 0],
      });
    }
  }
  return tiles;
}

function orbitPoint(o, uDeg) {
  var u = uDeg * d, Rr = o.R * d, sinI = Math.sqrt(1 - o.S * o.S);
  var x1 = o.a * Math.cos(u), y1 = o.a * Math.sin(u) * o.S, z1 = o.a * Math.sin(u) * sinI;
  return { x: cx + x1 * Math.cos(Rr) - y1 * Math.sin(Rr), y: cy + x1 * Math.sin(Rr) + y1 * Math.cos(Rr), z: z1 };
}

function drawOrbits(ctx, sc, offX, offY, now, W, H) {
  var span = 104, N = 40, oi, i, j;
  for (oi = 0; oi < orbits.length; oi++) {
    var o = orbits[oi];
    var uh = (now / 1000 / o.period) * 360 + o.phase;
    var pts = [];
    for (i = 0; i <= N; i++) pts.push(orbitPoint(o, uh - span * i / N));
    var head = pts[0];

    var segs = [], segStart = 0, inBack = head.z < 0;
    for (i = 1; i <= N; i++) {
      var back = pts[i].z < 0;
      if (back !== inBack) { segs.push({ start: segStart, end: i, isBack: inBack }); segStart = i; inBack = back; }
    }
    segs.push({ start: segStart, end: N, isBack: inBack });

    var drawSegsFor = function(drawBack) {
      for (var si = 0; si < segs.length; si++) {
        if (segs[si].isBack !== drawBack) continue;
        for (j = segs[si].start; j < segs[si].end; j++) {
          ctx.beginPath();
          ctx.moveTo(offX + pts[j].x * sc, offY + pts[j].y * sc);
          ctx.lineTo(offX + pts[j + 1].x * sc, offY + pts[j + 1].y * sc);
          ctx.strokeStyle = 'rgba(61,169,252,' + ((1 - j / N) * 0.7).toFixed(3) + ')';
          ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
    };

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    ctx.arc(offX + cx * sc, offY + cy * sc, Rg * sc, 0, Math.PI * 2);
    ctx.clip('evenodd');
    drawSegsFor(true);
    ctx.restore();
    drawSegsFor(false);

    var dotX = offX + head.x * sc, dotY = offY + head.y * sc;
    if (head.z < 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H);
      ctx.arc(offX + cx * sc, offY + cy * sc, Rg * sc, 0, Math.PI * 2);
      ctx.clip('evenodd');
    }
    ctx.beginPath(); ctx.arc(dotX, dotY, 10 * sc, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(61,169,252,0.16)'; ctx.fill();
    ctx.beginPath(); ctx.arc(dotX, dotY, 3.2 * sc, 0, Math.PI * 2);
    ctx.fillStyle = '#eaf4ff'; ctx.fill();
    if (head.z < 0) ctx.restore();
  }
}

function drawFrame(now) {
  if (!ctx || !W || !H) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  var sc = Math.max(W / 1280, H / 800), offX = W - 1280 * sc, offY = (H - 800 * sc) / 2;

  var interval = 9, waveDur = 2.75, feather = 0.16, flashW = 0.13, tail = 2.30;
  var maxAng = Math.PI / 2, speed = (maxAng + feather) / waveDur;
  var lifetime = (maxAng + feather + tail) / speed;
  var tt = (now - canvasStart) / 1000, base = Math.floor(tt / interval) * interval;
  var K = Math.ceil(lifetime / interval) + 1, fronts = [], k, age;
  for (k = 0; k <= K; k++) {
    age = tt - (base - k * interval);
    if (age >= 0 && age <= lifetime) fronts.push(age * speed);
  }

  var floodFront = -1;
  if (floodStart > 0) {
    var fAge = (now - floodStart) / 1000;
    if (fAge >= 0 && fAge < 2.6) floodFront = Math.min(fAge / 0.55, 1.25) * (maxAng + feather + 0.2);
  }

  if (fronts.length || floodFront >= 0) {
    ctx.save();
    ctx.beginPath(); ctx.arc(offX + cx * sc, offY + cy * sc, Rg * sc, 0, Math.PI * 2); ctx.clip();
    for (var ti = 0; ti < tiles.length; ti++) {
      var tl = tiles[ti], env = 0, fl = 0, fi, dist, e;
      for (fi = 0; fi < fronts.length; fi++) {
        dist = fronts[fi] - tl.ang;
        if (dist <= 0 || dist >= feather + tail) continue;
        e = dist < feather ? dist / feather : 1 - (dist - feather) / tail;
        if (e > env) { env = e; fl = Math.max(0, 1 - dist / flashW); }
      }
      var op = env * tl.baseOp + fl * 0.34;
      if (floodFront >= 0) {
        var fd = floodFront - tl.ang;
        if (fd > 0) {
          var fenv = Math.min(fd / feather, 1), ffl = Math.max(0, 1 - fd / (flashW * 1.4));
          var fop = fenv * (tl.baseOp * 1.9 + 0.12) + ffl * 0.5;
          if (fop > op) { op = fop; fl = Math.max(fl, ffl); }
        }
      }
      if (op > 0.9) op = 0.9;
      if (op < 0.012) continue;
      var col = tl.col;
      var R = (col[0] + (210 - col[0]) * fl) | 0, G = (col[1] + (236 - col[1]) * fl) | 0, B = (col[2] + (255 - col[2]) * fl) | 0;
      ctx.fillStyle = 'rgba(' + R + ',' + G + ',' + B + ',' + op.toFixed(3) + ')';
      var cr = tl.corners;
      ctx.beginPath();
      ctx.moveTo(offX + cr[0].x * sc, offY + cr[0].y * sc);
      ctx.lineTo(offX + cr[1].x * sc, offY + cr[1].y * sc);
      ctx.lineTo(offX + cr[2].x * sc, offY + cr[2].y * sc);
      ctx.lineTo(offX + cr[3].x * sc, offY + cr[3].y * sc);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  drawOrbits(ctx, sc, offX, offY, now, W, H);
}

// ── Module state ──────────────────────────────────────────────────────────────
var canvas, ctx;
var tiles      = [];
var canvasStart = 0, floodStart = 0;
var W = 0, H = 0, dpr = 1;
var timerId    = 0;

function loop() {
  drawFrame(performance.now());
  timerId = setTimeout(loop, tiles.length ? 33 : 50);
}

self.onmessage = function(e) {
  var msg = e.data;
  switch (msg.type) {
    case 'init':
      canvas      = msg.canvas;
      W = msg.w; H = msg.h; dpr = msg.dpr;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx         = canvas.getContext('2d');
      canvasStart = performance.now();
      if ('requestIdleCallback' in self) {
        requestIdleCallback(function() { tiles = buildTiles(); }, { timeout: 2000 });
      } else {
        setTimeout(function() { tiles = buildTiles(); }, 0);
      }
      loop();
      break;
    case 'resize':
      W = msg.w; H = msg.h; dpr = msg.dpr;
      if (canvas) {
        canvas.width  = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      break;
    case 'flood':
      floodStart = performance.now();
      break;
    case 'cancel':
      clearTimeout(timerId);
      self.close();
      break;
  }
};
