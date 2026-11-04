import { FRAME } from 'services/inspector/pictureGeometry';

/** Outside a shape's outline. */
const DIM = 'rgba(0, 0, 0, 0.55)';
const HALO = 'rgba(0, 0, 0, 0.6)';
const OUTLINE_WIDTH = 1.25;
const MARK_WIDTH = 1.5;
const MARK_RADIUS = 7;
const ARM_FROM = 9;
const ARM_TO = 13;

export interface FramePoint {
  px: number;
  py: number;
}

export interface PictureOverlays {
  /** Drawn over the picture in order, each the picture's size. */
  tints?: CanvasImageSource[];
  /** A shape's vertices in frame positions: dims outside them and strokes them. */
  outline?: FramePoint[];
  /** A point's frame position. */
  mark?: FramePoint;
  /** The feature's color, for the outline and the mark. */
  color: string;
}

function traceMark(ctx: CanvasRenderingContext2D, { px, py }: FramePoint): void {
  ctx.beginPath();
  ctx.moveTo(px + MARK_RADIUS, py);
  ctx.arc(px, py, MARK_RADIUS, 0, 2 * Math.PI);
  [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
    ctx.moveTo(px + dx * ARM_FROM, py + dy * ARM_FROM);
    ctx.lineTo(px + dx * ARM_TO, py + dy * ARM_TO);
  });
}

/** Base, tints, dimming, then the outline or the point mark, in frame positions. */
export function drawPicture(ctx: CanvasRenderingContext2D, base: CanvasImageSource, overlays: PictureOverlays): void {
  const { width, height, scale } = FRAME;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);
  // Pixels stay real values
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, width, height);
  overlays.tints?.forEach(tint => ctx.drawImage(tint, 0, 0, width, height));

  if (overlays.outline) {
    const trace = () => {
      overlays.outline!.forEach(({ px, py }, i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
    };
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    trace();
    ctx.fillStyle = DIM;
    ctx.fill('evenodd');

    ctx.beginPath();
    trace();
    ctx.strokeStyle = overlays.color;
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.stroke();
  }

  if (overlays.mark) {
    traceMark(ctx, overlays.mark);
    ctx.strokeStyle = HALO;
    ctx.lineWidth = MARK_WIDTH * 2;
    ctx.stroke();
    ctx.strokeStyle = overlays.color;
    ctx.lineWidth = MARK_WIDTH;
    ctx.stroke();
  }
}
