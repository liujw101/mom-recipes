/** Prepare recipe photos for Chinese OCR — upscale, contrast, binarize. */

const TARGET_MIN_WIDTH = 2600;
const MAX_DIMENSION = 4096;

export type PreprocessVariant = "enhanced" | "binary" | "sharp";

export interface PreparedImage {
  canvas: HTMLCanvasElement;
  variant: PreprocessVariant;
}

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return loadImage(dataUrl);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function prepareImagesForChineseOCR(img: HTMLImageElement): PreparedImage[] {
  const scaled = scaleCanvas(img);
  return [
    { canvas: enhanceContrast(scaled), variant: "enhanced" },
    { canvas: binarize(scaled), variant: "binary" },
    { canvas: sharpen(enhanceContrast(scaled)), variant: "sharp" },
  ];
}

function scaleCanvas(img: HTMLImageElement): HTMLCanvasElement {
  let w = img.width;
  let h = img.height;

  if (w < TARGET_MIN_WIDTH) {
    const factor = TARGET_MIN_WIDTH / w;
    w = Math.round(w * factor);
    h = Math.round(h * factor);
  }

  const maxSide = Math.max(w, h);
  if (maxSide > MAX_DIMENSION) {
    const factor = MAX_DIMENSION / maxSide;
    w = Math.round(w * factor);
    h = Math.round(h * factor);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

function enhanceContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = cloneCanvas(canvas);
  const ctx = out.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imageData;

  let min = 255;
  let max = 0;
  const gray = new Float32Array(data.length / 4);

  for (let i = 0, g = 0; i < data.length; i += 4, g++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[g] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = Math.max(max - min, 1);
  const factor = 1.35;

  for (let i = 0, g = 0; i < data.length; i += 4, g++) {
    let v = ((gray[g] - min) / range) * 255;
    v = (v - 128) * factor + 128;
    v = Math.max(0, Math.min(255, v));
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

function binarize(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = cloneCanvas(canvas);
  const ctx = out.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const { data, width, height } = imageData;

  const gray = new Uint8Array(width * height);
  for (let i = 0, g = 0; i < data.length; i += 4, g++) {
    gray[g] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  const threshold = otsuThreshold(gray);
  for (let i = 0, g = 0; i < data.length; i += 4, g++) {
    const v = gray[g] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

function sharpen(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = cloneCanvas(canvas);
  const ctx = out.getContext("2d")!;
  const src = ctx.getImageData(0, 0, out.width, out.height);
  const dst = ctx.createImageData(out.width, out.height);
  const w = out.width;
  const h = out.height;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4 + c;
            sum += src.data[idx] * kernel[ki++];
          }
        }
        const di = (y * w + x) * 4 + c;
        dst.data[di] = Math.max(0, Math.min(255, sum));
      }
      dst.data[(y * w + x) * 4 + 3] = 255;
    }
  }

  ctx.putImageData(dst, 0, 0);
  return out;
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;

  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) ** 2;
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }

  return threshold;
}

function cloneCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d")!.drawImage(canvas, 0, 0);
  return copy;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.88);
}
