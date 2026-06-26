import type { ParsedRecipe } from "../types/recipe";
import { hasGeminiOcr } from "./geminiOcrService";

const MODEL = "gemini-2.0-flash";

const NOTEGPT_PROMPT = `This image is an output PNG from NoteGPT's AI Image Translator.
It shows a recipe translated into English (clean printed/rendered text on the image, not handwriting).

Extract the recipe into JSON only (no markdown):
{
  "title": "dish name in English",
  "ingredients": ["one line per ingredient with amounts, e.g. 2 cups flour"],
  "steps": ["step 1 in order", "step 2"],
  "notes": "extra notes or empty string"
}

Rules:
- Transcribe the English text exactly as shown on the image
- Do NOT translate or rewrite — copy what you see
- Split into ingredients vs steps even if the layout is informal
- Keep measurement units (g, ml, cup, tsp) with ingredients
- Empty string / empty arrays if a section is missing`;

interface GeminiRecipeJson {
  title?: string;
  ingredients?: string[];
  steps?: string[];
  notes?: string;
}

function geminiApiKey(): string | undefined {
  return import.meta.env.VITE_GEMINI_API_KEY?.trim() || undefined;
}

function parseGeminiJson(raw: string): GeminiRecipeJson {
  const trimmed = raw.trim();
  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(jsonText) as GeminiRecipeJson;
}

function toParsedRecipe(data: GeminiRecipeJson): ParsedRecipe {
  const title = (data.title ?? "").trim();
  const ingredients = (data.ingredients ?? []).map((s) => s.trim()).filter(Boolean);
  const steps = (data.steps ?? []).map((s) => s.trim()).filter(Boolean);
  const notes = (data.notes ?? "").trim();

  return {
    title,
    ingredients,
    steps: steps.length ? steps : [""],
    notes,
    detectedLanguage: "en",
  };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function canImportNoteGPT(): boolean {
  return hasGeminiOcr();
}

/** Extract English recipe text from a NoteGPT output PNG. */
export async function extractRecipeFromNoteGPTPng(
  file: File,
  onProgress?: (message: string) => void
): Promise<ParsedRecipe> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error("Smart import is not configured. Use Add Manually instead.");
  }

  onProgress?.("Reading your NoteGPT image…");

  const base64 = await fileToBase64(file);
  const mimeType = file.type || "image/png";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: NOTEGPT_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429) {
      throw new Error("Rate limit reached. Wait a minute and try again.");
    }
    throw new Error(`Import failed (${response.status}). You can still edit manually.`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Could not read text from the PNG. Check the image and try again.");
  }

  try {
    const parsed = toParsedRecipe(parseGeminiJson(text));
    if (!parsed.title && parsed.ingredients.length === 0 && parsed.steps.every((s) => !s.trim())) {
      throw new Error("No recipe text found in the PNG.");
    }
    return parsed;
  } catch {
    throw new Error("Could not parse the recipe from the PNG. You can edit manually.");
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
