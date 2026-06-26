import type { ParsedRecipe } from "../types/recipe";
import {
  loadImageFromFile,
  prepareImagesForChineseOCR,
} from "./imagePreprocess";
import {
  normalizeRecipeJson,
  parsedRecipeHasContent,
} from "./normalizeRecipeJson";
import { parseNoteGPTText } from "./parseNoteGPTProse";
import { recognizeEnglishTextFromImage } from "./ocrService";

const MODEL = "gemini-2.0-flash";

const STRUCTURED_PROMPT = `This image is from NoteGPT's AI Image Translator (a recipe photo with translated text).

The image may show:
- English translation only (rendered text on the image)
- Side-by-side Chinese and English (extract ENGLISH only)
- Text overlaid on a photo of handwritten recipe
- A single prose paragraph mixing title, ingredients, and instructions

Extract the ENGLISH recipe into JSON with this exact structure:
{
  "title": "dish name",
  "ingredients": [{"amount": "2 cups", "text": "flour"}, {"amount": "", "text": "salt"}],
  "steps": ["step 1", "step 2"],
  "notes": "optional notes or empty string"
}

Rules:
- Copy English text exactly as shown — do not re-translate
- Text may be one paragraph — still split into title, ingredient list with amounts, and ordered steps
- Extract inline quantities like "450g pork belly", "1/2 cup rice", "1 tsp Sichuan peppercorns" as separate ingredients
- Every ingredient needs "text"; put measurements in "amount" when visible
- Number steps in cooking order
- If no section is visible, use empty string or empty array`;

const RECIPE_JSON_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          amount: { type: "STRING" },
          text: { type: "STRING" },
        },
        required: ["text"],
      },
    },
    steps: { type: "ARRAY", items: { type: "STRING" } },
    notes: { type: "STRING" },
  },
  required: ["title", "ingredients", "steps"],
};

export type NoteGPTImportMethod = "gemini" | "ocr";

export interface NoteGPTExtractResult {
  parsed: ParsedRecipe;
  importMethod: NoteGPTImportMethod;
}

function geminiApiKey(): string | undefined {
  return import.meta.env.VITE_GEMINI_API_KEY?.trim() || undefined;
}

export function canImportNoteGPT(): boolean {
  return true;
}

async function prepareImageForApi(file: File): Promise<{ base64: string; mimeType: string }> {
  const img = await loadImageFromFile(file);
  const prepared = prepareImagesForChineseOCR(img);
  const canvas = prepared[0]?.canvas ?? document.createElement("canvas");
  if (!prepared[0]) {
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
  }

  let quality = 0.92;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 4_000_000 && quality > 0.5) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  const comma = dataUrl.indexOf(",");
  return {
    base64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
    mimeType: "image/jpeg",
  };
}

async function callGemini(
  apiKey: string,
  base64: string,
  mimeType: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: STRUCTURED_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: RECIPE_JSON_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GEMINI_${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("GEMINI_EMPTY");
  }
  return text;
}

function parseJsonResponse(raw: string): ParsedRecipe {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const data = JSON.parse(jsonText) as Record<string, unknown>;
  return normalizeRecipeJson(data, "en");
}

async function tryGeminiExtract(
  file: File,
  onProgress?: (message: string) => void
): Promise<ParsedRecipe | null> {
  const apiKey = geminiApiKey();
  if (!apiKey) return null;

  onProgress?.("Smart read…");
  const { base64, mimeType } = await prepareImageForApi(file);

  try {
    const jsonText = await callGemini(apiKey, base64, mimeType);
    const parsed = parseJsonResponse(jsonText);
    return parsedRecipeHasContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function tryOcrExtract(
  file: File,
  onProgress?: (message: string) => void
): Promise<ParsedRecipe | null> {
  onProgress?.("Basic read on your device…");
  const plainText = await recognizeEnglishTextFromImage(file, onProgress);
  if (!plainText) return null;

  const parsed = parseNoteGPTText(plainText);
  parsed.detectedLanguage = "en";
  return parsedRecipeHasContent(parsed) ? parsed : null;
}

/** Extract English recipe from a NoteGPT PNG (Gemini first, OCR prose fallback). */
export async function extractRecipeFromNoteGPTPng(
  file: File,
  onProgress?: (message: string) => void
): Promise<NoteGPTExtractResult> {
  onProgress?.("Preparing image…");

  let parsed = await tryGeminiExtract(file, onProgress);
  if (parsed) {
    if (!parsed.steps.length) parsed.steps = [""];
    return { parsed, importMethod: "gemini" };
  }

  parsed = await tryOcrExtract(file, onProgress);
  if (parsed) {
    if (!parsed.steps.length) parsed.steps = [""];
    return { parsed, importMethod: "ocr" };
  }

  throw new Error(
    "Could not read the PNG automatically. Use Continue manually and type from the image."
  );
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
