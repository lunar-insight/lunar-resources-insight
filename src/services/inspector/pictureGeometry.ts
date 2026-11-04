import { MOON_RADIUS_M, type LonLat } from './featureGeometry';

/** The picture's box in CSS pixels. Requests ask for `scale` times as many. */
export const FRAME = { width: 211, height: 150, scale: 2 };

/** Size of a picture request, 2× the frame. */
export const PICTURE_WIDTH = FRAME.width * FRAME.scale;
export const PICTURE_HEIGHT = FRAME.height * FRAME.scale;

/** A point's box holds this many file pixels across, up to the cap. */
export const POINT_PIXELS = 64;
export const POINT_CAP_M = 1_000_000;
/** A shape's box holds at least this many file pixels across. */
export const SHAPE_MIN_PIXELS = 16;
/** Margin around a shape, as a share of its longer side. */
export const SHAPE_MARGIN = 0.1;
/** The parts of a box across 180° stop this far from the meridian. A box touching it makes the tiler read the file's whole width. */
const MERIDIAN_GAP_M = 5;
/** Perimeter samples per side when looking for the 180° meridian. */
const PERIMETER_SAMPLES = 32;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** One request of a view, in meters of the view's projection. */
export interface ViewPart {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Pixels asked for. */
  width: number;
  height: number;
}

/** The ground a picture shows, in meters of a Lambert azimuthal equal-area projection on `center`. */
export interface View {
  center: LonLat;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  parts: ViewPart[];
}

type Box = Omit<View, 'parts'>;

export function localCrs(center: LonLat): string {
  return `+proj=laea +lat_0=${center.lat} +lon_0=${center.lon} +R=${MOON_RADIUS_M} +units=m +no_defs +type=crs`;
}

export function project(p: LonLat, center: LonLat): { x: number; y: number } {
  const phi = toRadians(p.lat);
  const phi0 = toRadians(center.lat);
  const delta = toRadians(p.lon - center.lon);
  const k = Math.sqrt(2 / (1 + Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(delta)));
  return {
    x: MOON_RADIUS_M * k * Math.cos(phi) * Math.sin(delta),
    y: MOON_RADIUS_M * k * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(delta)),
  };
}

export function unproject({ x, y }: { x: number; y: number }, center: LonLat): LonLat {
  const rho = Math.hypot(x, y);
  if (rho === 0) return { lon: center.lon, lat: center.lat };

  const c = 2 * Math.asin(rho / (2 * MOON_RADIUS_M));
  const phi0 = toRadians(center.lat);
  const lat = Math.asin(Math.cos(c) * Math.sin(phi0) + (y * Math.sin(c) * Math.cos(phi0)) / rho);
  const delta = Math.atan2(x * Math.sin(c), rho * Math.cos(phi0) * Math.cos(c) - y * Math.sin(phi0) * Math.sin(c));
  const lon = center.lon + toDegrees(delta);
  return { lon: lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon, lat: toDegrees(lat) };
}

/** A box crossing every meridian. Never split: files reaching a pole answer quickly. */
export function holdsPole(view: Box): boolean {
  return [90, -90].some(lat => {
    const { x, y } = project({ lon: 0, lat }, view.center);
    return x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1;
  });
}

/** Whether the 180° meridian runs through a box. Found on its perimeter, which the meridian must cross to leave. */
export function crossesMeridian(view: Box): boolean {
  if (holdsPole(view)) return false;

  const { x0, y0, x1, y1 } = view;
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  let previous: number | null = null;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < PERIMETER_SAMPLES; i++) {
      const share = i / PERIMETER_SAMPLES;
      const { lon } = unproject({
        x: corners[side][0] + (corners[side + 1][0] - corners[side][0]) * share,
        y: corners[side][1] + (corners[side + 1][1] - corners[side][1]) * share,
      }, view.center);
      if (previous !== null && Math.abs(lon - previous) > 180) return true;
      previous = lon;
    }
  }
  return false;
}

/**
 * The requests of a view: one, or two stopping short of a meridian at x = 0
 * with their widths in proportion. On a split, the view's projection is on 180°.
 */
export function viewParts(view: Box): ViewPart[] {
  const { x0, y0, x1, y1 } = view;
  const whole = { x0, y0, x1, y1, width: PICTURE_WIDTH, height: PICTURE_HEIGHT };
  if (!crossesMeridian(view)) return [whole];

  const spans = [[x0, -MERIDIAN_GAP_M], [MERIDIAN_GAP_M, x1]].filter(([from, to]) => from < to);
  const total = spans.reduce((sum, [from, to]) => sum + to - from, 0);
  let used = 0;
  return spans.map(([from, to], index) => {
    const width = index === spans.length - 1
      ? PICTURE_WIDTH - used
      : Math.min(PICTURE_WIDTH - 1, Math.max(1, Math.round((PICTURE_WIDTH * (to - from)) / total)));
    used += width;
    return { x0: from, y0, x1: to, y1, width, height: PICTURE_HEIGHT };
  });
}

const boxAround = (center: LonLat, cx: number, cy: number, width: number): Box => {
  const height = (width * FRAME.height) / FRAME.width;
  return { center, x0: cx - width / 2, y0: cy - height / 2, x1: cx + width / 2, y1: cy + height / 2 };
};

/** On a box across 180°, the projection moves to that longitude, which makes the meridian the line x = 0. */
function fitted(center: LonLat, fit: (center: LonLat) => Box): View {
  const box = fit(center);
  const final = crossesMeridian(box) ? fit({ lon: 180, lat: center.lat }) : box;
  return { ...final, parts: viewParts(final) };
}

/** The frame around a shape: the whole shape with a margin, the rest of the frame showing more of the ground. */
export function shapeView(ring: LonLat[], center: LonLat, filePixelKm: number): View {
  return fitted(center, c => {
    const points = ring.map(p => project(p, c));
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const west = Math.min(...xs), east = Math.max(...xs);
    const south = Math.min(...ys), north = Math.max(...ys);
    const margin = SHAPE_MARGIN * Math.max(east - west, north - south);
    const width = Math.max(
      east - west + 2 * margin,
      ((north - south + 2 * margin) * FRAME.width) / FRAME.height,
      SHAPE_MIN_PIXELS * filePixelKm * 1000,
    );
    return boxAround(c, (west + east) / 2, (south + north) / 2, width);
  });
}

/** The frame around a point: a fixed number of file pixels across, up to the cap. */
export function pointView(point: LonLat, filePixelKm: number): View {
  const width = Math.min(POINT_PIXELS * filePixelKm * 1000, POINT_CAP_M);
  return fitted(point, c => {
    const { x, y } = project(point, c);
    return boxAround(c, x, y, width);
  });
}

/** Frame position, in CSS pixels, of a place in the view's projection. */
export function toFrame(x: number, y: number, view: Box): { px: number; py: number } {
  return {
    px: ((x - view.x0) / (view.x1 - view.x0)) * FRAME.width,
    py: ((view.y1 - y) / (view.y1 - view.y0)) * FRAME.height,
  };
}

export function fromFrame(px: number, py: number, view: Box): { x: number; y: number } {
  return {
    x: view.x0 + (px / FRAME.width) * (view.x1 - view.x0),
    y: view.y1 - (py / FRAME.height) * (view.y1 - view.y0),
  };
}

const SCALE_STEPS_KM = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
const SCALE_MIN_PX = 18;

/** The shortest round length at least 18 px long. */
export function scaleBar(view: Box): { label: string; widthPx: number } {
  const kmPerPx = (view.x1 - view.x0) / FRAME.width / 1000;
  const km = SCALE_STEPS_KM.find(step => step / kmPerPx >= SCALE_MIN_PX) ?? SCALE_STEPS_KM[SCALE_STEPS_KM.length - 1];
  return { label: km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`, widthPx: km / kmPerPx };
}

/** Size of the ground shown, such as "3.8 × 2.7 km". */
export function viewSizeText(view: Box): string {
  const km = (meters: number) => {
    const value = meters / 1000;
    return value < 100 ? value.toFixed(1) : String(Math.round(value));
  };
  return `${km(view.x1 - view.x0)} × ${km(view.y1 - view.y0)} km`;
}

/** 1 for each picture pixel whose center lies inside the ring, row by row from the top. */
export function insideMask(ring: LonLat[], view: Box, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const points = ring.map(p => {
    const { x, y } = project(p, view.center);
    const { px, py } = toFrame(x, y, view);
    return { px: (px / FRAME.width) * width, py: (py / FRAME.height) * height };
  });

  for (let row = 0; row < height; row++) {
    const y = row + 0.5;
    const crossings: number[] = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      if ((a.py > y) !== (b.py > y)) crossings.push(a.px + ((y - a.py) / (b.py - a.py)) * (b.px - a.px));
    });
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(0, Math.ceil(crossings[i] - 0.5));
      const to = Math.min(width - 1, Math.ceil(crossings[i + 1] - 0.5) - 1);
      for (let column = from; column <= to; column++) mask[row * width + column] = 1;
    }
  }
  return mask;
}
