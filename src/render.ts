// ============================================================
// 布面渲染辅助:色板索引 → 画布
// ============================================================
import { LoomSpec, paletteU32 } from './weave.js';

export interface FaceCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: ImageData;
  u32: Uint32Array;
  pal: Uint32Array;
}

/** 建一块 W×P 的离屏布面画布(1 像素 = 1 交织点) */
export function makeFaceCanvas(spec: LoomSpec): FaceCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = spec.warps;
  canvas.height = spec.picks;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(spec.warps, spec.picks);
  const u32 = new Uint32Array(img.data.buffer);
  return { canvas, ctx, img, u32, pal: paletteU32(spec.palette) };
}

/** 把 face 的第 p 纬写入 ImageData(不上屏) */
export function writePickPixels(fc: FaceCanvas, face: Uint8Array, W: number, p: number): void {
  const off = p * W;
  const { u32, pal } = fc;
  for (let w = 0; w < W; w++) u32[off + w] = pal[face[off + w]];
}

/** 把一段纬上屏(dirty rect),供逐纬织造动画用 */
export function flushPicks(fc: FaceCanvas, p0: number, count: number): void {
  fc.ctx.putImageData(fc.img, 0, 0, 0, p0, fc.canvas.width, count);
}

export function flushAll(fc: FaceCanvas): void {
  fc.ctx.putImageData(fc.img, 0, 0);
}

/** 由色板索引数组一次性铺满 */
export function fillFace(fc: FaceCanvas, face: Uint8Array): void {
  const { u32, pal } = fc;
  for (let i = 0; i < face.length; i++) u32[i] = pal[face[i]];
}

/** 把离屏布面画到显示画布(像素风放大) */
export function drawFaceScaled(
  fc: FaceCanvas, disp: CanvasRenderingContext2D,
  dx: number, dy: number, dw: number, dh: number,
): void {
  disp.imageSmoothingEnabled = false;
  disp.drawImage(fc.canvas, dx, dy, dw, dh);
}
