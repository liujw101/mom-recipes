import { hasGeminiOcr, recognizeRecipeWithGemini } from "./geminiOcrService";
import { recognizeTextFromImage, type ChineseScript } from "./ocrService";
import { parseRecipeText } from "./recipeParser";
import type { ParsedRecipe } from "../types/recipe";

export type ScanMethod = "gemini" | "tesseract";

export interface ScanResult {
  parsed: ParsedRecipe;
  method: ScanMethod;
}

/** Scan a recipe photo — Gemini for handwriting (if configured), else Tesseract. */
export async function scanRecipeFromPhoto(
  file: File,
  script: ChineseScript,
  onProgress?: (message: string) => void
): Promise<ScanResult> {
  if (hasGeminiOcr()) {
    try {
      const parsed = await recognizeRecipeWithGemini(file, script, onProgress);
      return { parsed, method: "gemini" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Smart scan failed";
      onProgress?.(`${message} Trying basic scan…`);
    }
  } else {
    onProgress?.("Using basic scan (handwriting may need more editing)…");
  }

  const text = await recognizeTextFromImage(file, onProgress, script);
  if (!text) {
    throw new Error(
      "No text found. Use bright, even light, lay the paper flat, fill the frame, and try again."
    );
  }

  return { parsed: parseRecipeText(text), method: "tesseract" };
}

export { hasGeminiOcr };
