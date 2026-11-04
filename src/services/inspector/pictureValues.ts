import { FRAME, PICTURE_WIDTH, fromFrame, unproject, type View } from './pictureGeometry';

/** A value range [low, high]. */
export type ValueRange = [number, number];

/** What the map draws for a layer, applied to a picture. */
export interface PictureDisplay {
  rescale: ValueRange;
  /** Values outside it are transparent, as on the map. */
  filter: ValueRange | null;
}

const LEVELS = 255;
/** A shape's bin narrower than this many gray levels cannot be separated from its neighbors. */
const MIN_BIN_LEVELS = 2;

/** 256 RGBA entries, from black to white. */
export const GRAY_TABLE: Uint8Array = (() => {
  const table = new Uint8Array(256 * 4);
  for (let level = 0; level < 256; level++) table.set([level, level, level, 255], level * 4);
  return table;
})();

/** Gray and alpha of a gray PNG's pixels, read from RGBA. */
export function decodeRgba(rgba: Uint8ClampedArray, width: number, height: number): { gray: Uint8Array; alpha: Uint8Array } {
  const count = width * height;
  const gray = new Uint8Array(count);
  const alpha = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    gray[i] = rgba[i * 4];
    alpha[i] = rgba[i * 4 + 3];
  }
  return { gray, alpha };
}

/**
 * The tiler truncates, `gray = floor((v - lo) / (hi - lo) * 255)`, so only `hi` gives
 * 255. Other levels read as their middle, with an error of half a level at most.
 */
export function valueOf(gray: number, [lo, hi]: ValueRange): number {
  return gray === LEVELS ? hi : lo + ((gray + 0.5) / LEVELS) * (hi - lo);
}

/** The line's decimals, or fewer when one gray level is coarser than them. */
export function readoutDecimals([lo, hi]: ValueRange, lineDecimals: number): number {
  const level = (hi - lo) / LEVELS;
  return Math.min(lineDecimals, Math.max(0, Math.floor(-Math.log10(level))));
}

/** RGBA of a picture, through a 256-entry table. No display colors the whole picture range. */
export function colorize(
  gray: Uint8Array,
  alpha: Uint8Array,
  pictureRange: ValueRange,
  table: Uint8Array,
  display?: PictureDisplay,
): Uint8ClampedArray {
  const [a, b] = display?.rescale ?? pictureRange;
  const filter = display?.filter;
  const span = b - a;

  // One color per gray level, so the pixels below are lookups
  const colors = new Uint8Array(256 * 4);
  for (let level = 0; level < 256; level++) {
    const value = valueOf(level, pictureRange);
    const index = span > 0 ? Math.min(LEVELS, Math.max(0, Math.floor(((value - a) / span) * LEVELS))) : 0;
    const kept = !filter || (value >= filter[0] && value <= filter[1]);
    colors[level * 4] = table[index * 4];
    colors[level * 4 + 1] = table[index * 4 + 1];
    colors[level * 4 + 2] = table[index * 4 + 2];
    colors[level * 4 + 3] = kept ? table[index * 4 + 3] : 0;
  }

  const rgba = new Uint8ClampedArray(gray.length * 4);
  for (let i = 0; i < gray.length; i++) {
    if (alpha[i] === 0) continue;
    const at = gray[i] * 4;
    rgba[i * 4] = colors[at];
    rgba[i * 4 + 1] = colors[at + 1];
    rgba[i * 4 + 2] = colors[at + 2];
    rgba[i * 4 + 3] = colors[at + 3];
  }
  return rgba;
}

/** 1 for the opaque pixels inside the shape with a value in [a, b]. */
export function binMask(
  gray: Uint8Array,
  alpha: Uint8Array,
  inside: Uint8Array,
  range: ValueRange,
  [a, b]: ValueRange,
): Uint8Array {
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    if (alpha[i] === 0 || inside[i] === 0) continue;
    const value = valueOf(gray[i], range);
    if (value >= a && value <= b) mask[i] = 1;
  }
  return mask;
}

/**
 * 1 for the opaque pixels at a clipped limit, inside the clip's longitudes when
 * it has them. The level holding the limit also holds values within one level
 * of it, except for `hi`, which has 255 to itself.
 */
export function limitMask(
  gray: Uint8Array,
  alpha: Uint8Array,
  [lo, hi]: ValueRange,
  limit: number,
  lonLimits: ValueRange | undefined,
  view: View,
): Uint8Array {
  const span = hi - lo;
  const level = span > 0 ? Math.min(LEVELS, Math.max(0, Math.floor(((limit - lo) / span) * LEVELS))) : 0;
  const mask = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    if (alpha[i] === 0 || gray[i] !== level) continue;
    if (lonLimits) {
      const px = ((i % PICTURE_WIDTH) + 0.5) / FRAME.scale;
      const py = (Math.floor(i / PICTURE_WIDTH) + 0.5) / FRAME.scale;
      const { lon } = unproject(fromFrame(px, py, view), view.center);
      if (lon < lonLimits[0] || lon > lonLimits[1]) continue;
    }
    mask[i] = 1;
  }
  return mask;
}

/** A bin needs 2 gray levels to be told apart from its neighbors. */
export function canHighlight([lo, hi]: ValueRange, binWidth: number): boolean {
  return binWidth >= (MIN_BIN_LEVELS * (hi - lo)) / LEVELS;
}

/** Share of the opaque pixels set in the mask, from 0 to 1. */
export function limitShare(mask: Uint8Array, alpha: Uint8Array): number {
  let set = 0;
  let opaque = 0;
  for (let i = 0; i < mask.length; i++) {
    if (alpha[i] === 0) continue;
    opaque++;
    set += mask[i];
  }
  return opaque > 0 ? set / opaque : 0;
}
