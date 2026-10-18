// Timing helpers for animations computed per frame in JavaScript, matching
// their CSS equivalents.

/** A CSS `cubic-bezier()` timing function, mapping a time fraction in [0, 1] to a progress fraction. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const sample = (a1: number, a2: number, s: number) =>
    3 * a1 * s * (1 - s) ** 2 + 3 * a2 * s * s * (1 - s) + s ** 3;

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // x grows with s when x1 and x2 are in [0, 1], so bisection finds the s whose x is t.
    let low = 0;
    let high = 1;
    let s = t;
    for (let i = 0; i < 30; i++) {
      s = (low + high) / 2;
      if (sample(x1, x2, s) < t) low = s;
      else high = s;
    }
    return sample(y1, y2, s);
  };
}

export const easeOut = cubicBezier(0, 0, 0.58, 1);
export const easeInOut = cubicBezier(0.42, 0, 0.58, 1);

/** [offset, value] pairs, offsets in [0, 1] and increasing. */
export type Keyframes = readonly (readonly [number, number])[];

/** The value at a progress fraction, interpolated linearly between keyframes. */
export function keyframeValue(progress: number, keyframes: Keyframes): number {
  if (progress <= keyframes[0][0]) return keyframes[0][1];
  for (let i = 1; i < keyframes.length; i++) {
    const [offset, value] = keyframes[i];
    if (progress <= offset) {
      const [previousOffset, previousValue] = keyframes[i - 1];
      return previousValue + ((value - previousValue) * (progress - previousOffset)) / (offset - previousOffset);
    }
  }
  return keyframes[keyframes.length - 1][1];
}
