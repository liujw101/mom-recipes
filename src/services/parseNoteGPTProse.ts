import type { ParsedIngredient, ParsedRecipe } from "../types/recipe";
import { parseRecipeText } from "./recipeParser";

const STRUCTURED_HEADER =
  /^\s*(ingredients|ingredient|steps|step|directions|method|title|recipe)\s*:?\s*$/im;

/** Join OCR line breaks into continuous prose and fix common misreads. */
export function reflowOcrLines(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  const merged: string[] = [];
  let current = lines[0];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/[.!?]["']?\s*$/.test(current)) {
      merged.push(current);
      current = line;
    } else {
      current = `${current} ${line}`.replace(/\s+/g, " ");
    }
  }
  merged.push(current);

  return fixOcrGlitch(merged.join(" "));
}

function fixOcrGlitch(text: string): string {
  return text
    .replace(/(\d+)9\b/g, "$1g")
    .replace(/\b(\d+\/\d+)\s+cu\b/gi, "$1 cup")
    .replace(/\b1\/2\s+cu\s+p\b/gi, "1/2 cup")
    .replace(/\b(\d+)\s+cu\s+p\b/gi, "$1 cup")
    .replace(/\bcu\s+p\b/gi, "cup")
    .replace(/\bcu\s+of\b/gi, "cup of")
    .replace(/[|\[\]]/g, " ")
    .replace(/\s+([,.;)])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function hasStructuredSections(text: string): boolean {
  return STRUCTURED_HEADER.test(text);
}

function extractTitle(reflowed: string): { title: string; body: string } {
  const dotIdx = reflowed.indexOf(".");
  if (dotIdx > 0 && dotIdx < 80) {
    const title = reflowed.slice(0, dotIdx).trim();
    const body = reflowed.slice(dotIdx + 1).trim();
    return { title, body };
  }

  const title = reflowed.split(/\.\s+/)[0]?.trim() ?? "";
  const body = reflowed.slice(title.length).replace(/^\.\s*/, "").trim();
  return { title, body };
}

interface Candidate {
  amount?: string;
  text: string;
  index: number;
}

const INGREDIENT_BOUNDARY = "(?=\\s+and\\b|[,;.()]|$)";

function extractIngredients(text: string): ParsedIngredient[] {
  const candidates: Candidate[] = [];

  function push(amount: string | undefined, raw: string, index: number) {
    const cleaned = raw.replace(/\s+and\s*$/i, "").trim();
    if (cleaned.length < 2) return;
    candidates.push({ amount: amount?.trim() || undefined, text: cleaned, index });
  }

  // Parenthetical spice lists, e.g. "(add star anise, a small piece of cinnamon, and bay leaf)"
  const parenRe = /\((?:add\s+)?([^)]+)\)/gi;
  let parenMatch: RegExpExecArray | null;
  while ((parenMatch = parenRe.exec(text)) !== null) {
    const inner = parenMatch[1];
    const parts = inner.split(/,\s*|\s+and\s+/i);
    let cursor = 0;
    for (const part of parts) {
      const partIndex = parenMatch.index + inner.indexOf(part, cursor);
      cursor = inner.indexOf(part, cursor) + part.length;
      const spice = part.replace(/^a\s+small\s+piece\s+of\s+/i, "").trim();
      if (spice.length > 1) push(undefined, spice, partIndex);
    }
  }

  const patterns: RegExp[] = [
    new RegExp(`(\\d+(?:\\.\\d+)?\\s*(?:g|kg|ml|oz))\\s+of\\s+(.+?)${INGREDIENT_BOUNDARY}`, "gi"),
    new RegExp(`(\\d+\\/\\d+\\s*cups?)\\s+of\\s+(.+?)${INGREDIENT_BOUNDARY}`, "gi"),
    new RegExp(`(\\d+\\s*tsp)\\s+of\\s+(.+?)${INGREDIENT_BOUNDARY}`, "gi"),
    new RegExp(`(a\\s+pinch\\s+of\\s+(.+?))${INGREDIENT_BOUNDARY}`, "gi"),
  ];

  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[0].toLowerCase().startsWith("a pinch")) {
        push("a pinch of", match[2], match.index);
      } else {
        push(match[1], match[2], match.index);
      }
    }
  }

  candidates.sort((a, b) => a.index - b.index);

  const seen = new Set<string>();
  const ingredients: ParsedIngredient[] = [];
  for (const c of candidates) {
    const key = c.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ingredients.push({ amount: c.amount, text: c.text });
  }
  return ingredients;
}

function extractSteps(body: string): string[] {
  if (!body.trim()) return [];

  const sentences = body
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .map((s) => (s.endsWith(".") ? s : `${s}.`));

  return sentences.length ? sentences : [body.endsWith(".") ? body : `${body}.`];
}

/** Parse continuous NoteGPT prose into title, ingredients, and steps. */
export function parseNoteGPTProse(ocrText: string): ParsedRecipe {
  const reflowed = reflowOcrLines(ocrText);
  if (!reflowed) {
    return {
      title: "",
      ingredients: [],
      steps: [],
      notes: "",
      detectedLanguage: "en",
    };
  }

  const { title, body } = extractTitle(reflowed);
  const ingredients = extractIngredients(reflowed);
  const steps = extractSteps(body);

  return {
    title,
    ingredients,
    steps,
    notes: "",
    detectedLanguage: "en",
  };
}

/** Route structured OCR text to recipeParser, prose to parseNoteGPTProse. */
export function parseNoteGPTText(ocrText: string): ParsedRecipe {
  if (hasStructuredSections(ocrText)) {
    const parsed = parseRecipeText(ocrText);
    if (parsed.detectedLanguage !== "en") {
      parsed.detectedLanguage = "en";
    }
    return parsed;
  }
  return parseNoteGPTProse(ocrText);
}
