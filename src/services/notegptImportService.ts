import type { ParsedRecipe } from "../types/recipe";
import { hasGeminiOcr } from "./geminiOcrService";
import {
  loadImageFromFile,
  prepareImagesForChineseOCR,
} from "./imagePreprocess";
import {
  normalizeRecipeJson,
  parsedRecipeHasContent,
} from "./normalizeRecipeJson";
import { parseRecipeText } from "./recipeParser";

const MODEL = "gemini-2.0-flash";

const STRUCTURED_PROMPT = `This image is from NoteGPT's AI Image Translator (a recipe photo with translated text).

The image may show:
- English translation only (rendered text on the image)
- Side-by-side Chinese and English (extract ENGLISH only)
- Text overlaid on a photo of handwritten recipe

Extract the ENGLISH recipe into JSON with this exact structure:
{
  "title": "dish name",
  "ingredients": [{"amount": "2 cups", "text": "flour"}, {"amount": "", "text": "salt"}],
  "steps": ["step 1", "step 2"],
  "notes": "optional notes or empty string"
}

Rules:
- Copy English text exactly as shown — do not re-translate
- Every ingredient needs "text"; put measurements in "amount" when visible
- Number steps in cooking order
- If no section is visible, use empty string or empty array`;

const RAW_TEXT_PROMPT = `This image is from NoteGPT's AI Image Translator showing a recipe.

Transcribe ALL English recipe text visible in the image, line by line, exactly as written.
Include title, ingredients (with amounts), and steps.
If both Chinese and English appear, transcribe ENGLISH only.
Do not add commentary — output plain text only.`;

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

function geminiApiKey(): string | undefined {
  return import.meta.env.VITE_GEMINI_API_KEY?.trim() || undefined;
}

export function canImportNoteGPT(): boolean {
  return hasGeminiOcr();
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
  mimeType: string,
  prompt: string,
  options?: { jsonSchema?: object }
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
  };

  if (options?.jsonSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = options.jsonSchema;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit reached. Wait a minute and try again.");
    }
    throw new Error(`Import failed (${response.status}). Try again or enter manually.`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Could not read text from the PNG.");
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

/** Extract English recipe from a NoteGPT output PNG (two-pass). */
export async function extractRecipeFromNoteGPTPng(
  file: File,
  onProgress?: (message: string) => void
): Promise<ParsedRecipe> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error("Smart import is not configured. Use Add Manually instead.");
  }

  onProgress?.("Preparing image…");
  const { base64, mimeType } = await prepareImageForApi(file);

  onProgress?.("Reading recipe from NoteGPT image…");
  let parsed: ParsedRecipe | null = null;

  try {
    const jsonText = await callGemini(apiKey, base64, mimeType, STRUCTURED_PROMPT, {
      jsonSchema: RECIPE_JSON_SCHEMA,
    });
    parsed = parseJsonResponse(jsonText);
  } catch {
    parsed = null;
  }

  if (!parsed || !parsedRecipeHasContent(parsed)) {
    onProgress?.("Trying alternate read…");
    const plainText = await callGemini(apiKey, base64, mimeType, RAW_TEXT_PROMPT);
    parsed = parseRecipeText(plainText);
    if (parsed.detectedLanguage !== "en") {
      parsed.detectedLanguage = "en";
    }
  }

  if (!parsedRecipeHasContent(parsed)) {
    throw new Error("No recipe text found in the PNG. Check the image or enter manually.");
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
