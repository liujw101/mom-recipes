import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import {
  countCjkChars,
  looksLikeFailedChineseOcr,
  normalizeChineseOcrText,
} from "./chineseOcrPostprocess";
import { loadImageFromFile, prepareImagesForChineseOCR } from "./imagePreprocess";

export type ChineseScript = "simplified" | "traditional" | "both";

interface OcrAttempt {
  text: string;
  confidence: number;
  cjkCount: number;
  variant: string;
  psm: string;
}

const PSM_MODES: Array<{ mode: PSM; label: string }> = [
  { mode: PSM.AUTO, label: "auto" },
  { mode: PSM.SINGLE_BLOCK, label: "block" },
  { mode: PSM.SPARSE_TEXT, label: "sparse" },
];

function languagesForScript(script: ChineseScript): string[] {
  switch (script) {
    case "simplified":
      return ["chi_sim", "eng"];
    case "traditional":
      return ["chi_tra", "eng"];
    case "both":
      return ["chi_sim", "chi_tra", "eng"];
  }
}

function scoreAttempt(attempt: OcrAttempt): number {
  // Prefer more Chinese characters and higher confidence
  return attempt.cjkCount * 15 + attempt.confidence;
}

async function runRecognition(
  worker: Worker,
  source: HTMLCanvasElement,
  psm: PSM
): Promise<{ text: string; confidence: number }> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: "1",
  });

  const { data } = await worker.recognize(source);
  const text = normalizeChineseOcrText(data.text);
  return { text, confidence: data.confidence };
}

export async function recognizeTextFromImage(
  file: File,
  onProgress?: (message: string) => void,
  script: ChineseScript = "simplified"
): Promise<string> {
  onProgress?.("Preparing image for Chinese OCR…");
  const img = await loadImageFromFile(file);
  const prepared = prepareImagesForChineseOCR(img);
  const languages = languagesForScript(script);

  onProgress?.("Loading Chinese OCR engine (first scan may take a minute)…");
  const worker = await createWorker(languages, OEM.LSTM_ONLY, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        onProgress?.(`Reading Chinese text… ${Math.round((m.progress ?? 0) * 100)}%`);
      }
    },
  });

  try {
    const attempts: OcrAttempt[] = [];

    for (const image of prepared) {
      for (const { mode, label } of PSM_MODES) {
        onProgress?.(`Scanning (${image.variant}, ${label})…`);
        const { text, confidence } = await runRecognition(worker, image.canvas, mode);
        if (!text) continue;

        attempts.push({
          text,
          confidence,
          cjkCount: countCjkChars(text),
          variant: image.variant,
          psm: label,
        });

        // Good enough — stop early if we got solid Chinese text
        if (countCjkChars(text) >= 8 && confidence >= 55) break;
      }

      const bestSoFar = attempts.reduce<OcrAttempt | null>(
        (best, a) => (!best || scoreAttempt(a) > scoreAttempt(best) ? a : best),
        null
      );
      if (bestSoFar && bestSoFar.cjkCount >= 12 && bestSoFar.confidence >= 50) break;
    }

    if (attempts.length === 0) return "";

    const best = attempts.reduce((a, b) => (scoreAttempt(a) >= scoreAttempt(b) ? a : b));

    if (looksLikeFailedChineseOcr(best.text)) {
      throw new Error(
        "Could not read Chinese clearly. Try brighter light, lay the paper flat, fill the frame, then scan again."
      );
    }

    return best.text;
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
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
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
