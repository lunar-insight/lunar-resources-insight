import { PICTURE_HEIGHT, PICTURE_WIDTH } from 'services/inspector/pictureGeometry';

function pictureSizedCanvas(): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PICTURE_WIDTH;
  canvas.height = PICTURE_HEIGHT;
  return { canvas, context: canvas.getContext('2d')! };
}

function put(context: CanvasRenderingContext2D, rgba: Uint8ClampedArray): void {
  const image = context.createImageData(PICTURE_WIDTH, PICTURE_HEIGHT);
  image.data.set(rgba);
  context.putImageData(image, 0, 0);
}

/** An offscreen canvas holding a picture's RGBA pixels. */
export function pixelsToCanvas(rgba: Uint8ClampedArray): HTMLCanvasElement {
  const { canvas, context } = pictureSizedCanvas();
  put(context, rgba);
  return canvas;
}

/** An offscreen canvas holding the color on the pixels set in the mask, at this opacity. */
export function maskToCanvas(mask: Uint8Array, color: string, opacity: number): HTMLCanvasElement {
  const { canvas, context } = pictureSizedCanvas();
  const rgba = new Uint8ClampedArray(mask.length * 4);
  const alpha = Math.round(opacity * 255);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) rgba[i * 4 + 3] = alpha;
  }
  put(context, rgba);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, PICTURE_WIDTH, PICTURE_HEIGHT);
  return canvas;
}

/** A color for the canvas: the value of a `var(--name)` on this element, or the color as given. */
export function resolveCssColor(element: Element, color: string): string {
  const name = /^var\((--[^)]+)\)$/.exec(color)?.[1];
  return name ? getComputedStyle(element).getPropertyValue(name).trim() : color;
}
