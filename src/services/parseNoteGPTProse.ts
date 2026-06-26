import type { ParsedIngredient, ParsedRecipe } from "../types/recipe";
import { splitIngredientLine } from "./normalizeRecipeJson";
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
    .replace(/\|/g, "l")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
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

function extractIngredients(text: string): ParsedIngredient[] {
  const ingredients: ParsedIngredient[] = [];
  const seen = new Set<string>();

  function add(amount: string | undefined, text: string) {
    const cleaned = text.replace(/\s+and\s*$/i, "").trim();
    if (!cleaned) return;
    const key = `${amount ?? ""}|${cleaned}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ingredients.push({ amount: amount?.trim() || undefined, text: cleaned });
  }

  const parenRe = /\((?:add\s+)?([^)]+)\)/gi;
  let parenMatch: RegExpExecArray | null;
  while ((parenMatch = parenRe.exec(text)) !== null) {
    const parts = parenMatch[1].split(/,\s*|\s+and\s+/i);
    for (const part of parts) {
      const spice = part.replace(/^a\s+small\s+piece\s+of\s+/i, "").trim();
      if (spice.length > 1) add(undefined, spice);
    }
  }

  const patterns: RegExp[] = [
    /(\d+(?:\.\d+)?\s*(?:g|kg|ml|l|oz))\s+of\s+([^,;.(]+)/gi,
    /(\d+\/\d+\s*cups?)\s+of\s+([^,;.(]+)/gi,
    /(\d+\s*tsp)\s+of\s+([^,;.(]+)/gi,
    /(\d+\s*ml)\s+(?:of\s+)?([^,;.(]+)/gi,
    /(a\s+pinch\s+of\s+[^,;.(]+)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      if (match.length >= 3) {
        add(match[1], match[2]);
      } else if (match[1]) {
        const parsed = splitIngredientLine(match[1]);
        add(parsed.amount, parsed.text);
      }
    }
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
