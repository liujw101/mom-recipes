import type { ParsedRecipe } from "../types/recipe";
import { recognizeEnglishTextFromImage } from "./ocrService";
import { parsedRecipeHasContent } from "./normalizeRecipeJson";
import { parseRecipeText } from "./recipeParser";

export function canImportNoteGPT(): boolean {
  return true;
}

/** Extract English recipe from a NoteGPT output PNG using on-device OCR (no API quota). */
export async function extractRecipeFromNoteGPTPng(
  file: File,
  onProgress?: (message: string) => void
): Promise<ParsedRecipe> {
  onProgress?.("Preparing image…");

  onProgress?.("Reading text on your device (first import may take a minute)…");
  const plainText = await recognizeEnglishTextFromImage(file, onProgress);
  if (!plainText) {
    throw new Error(
      "Could not read the PNG. Use Continue manually and type from the image."
    );
  }

  const parsed = parseRecipeText(plainText);
  parsed.detectedLanguage = "en";

  if (!parsedRecipeHasContent(parsed)) {
    throw new Error(
      "Could not find recipe sections in the PNG. Use Continue manually and type from the image."
    );
  }

  if (!parsed.steps.length) {
    parsed.steps = [""];
  }

  return parsed;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export { parsedRecipeHasContent };
