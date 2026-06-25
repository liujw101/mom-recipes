import { createWorker } from "tesseract.js";

export async function recognizeTextFromImage(
  imageSource: string | HTMLImageElement | File,
  onProgress?: (message: string) => void
): Promise<string> {
  onProgress?.("Loading OCR engine…");
  const worker = await createWorker(["chi_sim", "eng"], 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onProgress?.(`Reading text… ${Math.round((m.progress ?? 0) * 100)}%`);
      }
    },
  });

  try {
    onProgress?.("Scanning recipe…");
    const { data } = await worker.recognize(imageSource);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File, maxWidth = 1200): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
