import type { ParsedRecipe, RecipeLanguage } from "../types/recipe";
import type { ChineseScript } from "./ocrService";

const MODEL = "gemini-2.0-flash";

function geminiApiKey(): string | undefined {
  const key = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  return key || undefined;
}

export function hasGeminiOcr(): boolean {
  return Boolean(geminiApiKey());
}

function scriptHint(script: ChineseScript): string {
  switch (script) {
    case "simplified":
      return "The handwriting is mostly Simplified Chinese (简体中文) with occasional English words.";
    case "traditional":
      return "The handwriting is mostly Traditional Chinese (繁體中文) with occasional English words.";
    case "both":
      return "The handwriting may use Simplified or Traditional Chinese with occasional English words.";
  }
}

function buildPrompt(script: ChineseScript): string {
  return `You are transcribing a HANDWRITTEN recipe from a photo.

${scriptHint(script)}

Typical pattern: Chinese ingredient names and steps, with small English fragments (e.g. "g", "ml", "cup", brand names).

Return ONLY valid JSON (no markdown fences):
{
  "title": "dish name as written",
  "ingredients": ["one line per ingredient, keep Chinese+English mix exactly"],
  "steps": ["step 1", "step 2"],
  "notes": "extra notes or empty string"
}

Rules:
- TRANSCRIBE only — do NOT translate between languages
- Keep the original mix of Chinese and English on each line
- Best guess for unclear handwriting; append [?] if very uncertain
- Empty string / empty arrays if a section is not visible
- Split ingredients and steps even when headings are missing on the paper`;
}

function detectLanguage(text: string): RecipeLanguage {
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  if (hasChinese && hasEnglish) return "mixed";
  if (hasChinese) return "zh-Hans";
  if (hasEnglish) return "en";
  return "mixed";
}

interface GeminiRecipeJson {
  title?: string;
  ingredients?: string[];
  steps?: string[];
  notes?: string;
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
  const blob = [title, ...ingredients, ...steps, notes].join("\n");

  return {
    title,
    ingredients,
    steps: steps.length ? steps : [""],
    notes,
    detectedLanguage: detectLanguage(blob),
  };
}

export async function recognizeRecipeWithGemini(
  file: File,
  script: ChineseScript,
  onProgress?: (message: string) => void
): Promise<ParsedRecipe> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  onProgress?.("Reading handwriting with smart scan…");

  const base64 = await fileToBase64(file);
  const mimeType = file.type || "image/jpeg";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: buildPrompt(script) },
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
      throw new Error("Smart scan rate limit reached. Wait a minute and try again.");
    }
    throw new Error(`Smart scan failed (${response.status}): ${detail.slice(0, 120)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Smart scan returned no text. Try again with better lighting.");
  }

  try {
    const parsed = toParsedRecipe(parseGeminiJson(text));
    if (!parsed.title && parsed.ingredients.length === 0 && parsed.steps.every((s) => !s.trim())) {
      throw new Error("Could not read any recipe text from the photo.");
    }
    return parsed;
  } catch {
    throw new Error("Smart scan could not parse the recipe. Try again or edit manually.");
  }
}

function fileToBase64(file: File): Promise<string> {
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
