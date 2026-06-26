import type { ParsedIngredient, ParsedRecipe, RecipeLanguage } from "../types/recipe";

/** Split "2 cups flour" → { amount: "2 cups", text: "flour" } */
export function splitIngredientLine(line: string): ParsedIngredient {
  const trimmed = stripBullet(line.trim());
  if (!trimmed) return { text: "" };

  const amountPatterns = [
    /^([\d½¼¾⅓⅔]+\s*(?:\/\d+\s*)?(?:cups?|tbsp|tsp|oz|lb|lbs|g|kg|ml|l|cloves?|pieces?|slices?|pinch(?:es)?|dash(?:es)?|bunch(?:es)?|heads?|stalks?|can(?:s)?|package(?:s)?|pkg)\.?\s+)(.+)$/i,
    /^([\d½¼¾⅓⅔]+(?:\.\d+)?\s*(?:g|kg|ml|l|oz)\.?\s+)(.+)$/i,
    /^([\d½¼¾⅓⅔]+(?:\.\d+)?\s+)(.+)$/,
  ];

  for (const pattern of amountPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return { amount: match[1].trim(), text: match[2].trim() };
    }
  }

  return { text: trimmed };
}

function stripBullet(line: string): string {
  return line.replace(/^[-•*·]\s*/, "");
}

type RawJson = Record<string, unknown>;

function pickString(obj: RawJson, keys: string[]): string {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function normalizeIngredients(raw: unknown): ParsedIngredient[] {
  if (!raw) return [];

  if (typeof raw === "string") {
    return raw
      .split(/\r?\n/)
      .map((l) => splitIngredientLine(l))
      .filter((i) => i.text);
  }

  if (!Array.isArray(raw)) return [];

  const result: ParsedIngredient[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const parsed = splitIngredientLine(item);
      if (parsed.text) result.push(parsed);
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const text =
        typeof obj.text === "string"
          ? obj.text.trim()
          : typeof obj.name === "string"
            ? obj.name.trim()
            : typeof obj.ingredient === "string"
              ? obj.ingredient.trim()
              : "";
      const amount =
        typeof obj.amount === "string"
          ? obj.amount.trim()
          : typeof obj.quantity === "string"
            ? obj.quantity.trim()
            : undefined;
      if (text) result.push({ text, amount: amount || undefined });
    }
  }
  return result;
}

function normalizeSteps(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

export function normalizeRecipeJson(
  data: RawJson,
  defaultLanguage: RecipeLanguage = "en"
): ParsedRecipe {
  const title = pickString(data, ["title", "recipe_name", "name", "dish", "recipeTitle"]);
  const ingredients = normalizeIngredients(data.ingredients ?? data.ingredient_list);
  const steps = normalizeSteps(
    data.steps ?? data.instructions ?? data.directions ?? data.method ?? data.preparation
  );
  const notes = pickString(data, ["notes", "note", "comments", "remarks"]);

  const blob = [title, ...ingredients.map((i) => i.text), ...steps, notes].join("\n");

  return {
    title,
    ingredients,
    steps: steps.length ? steps : [],
    notes,
    detectedLanguage: detectLanguage(blob) || defaultLanguage,
  };
}

function detectLanguage(text: string): RecipeLanguage {
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  if (hasChinese && hasEnglish) return "mixed";
  if (hasChinese) return "zh-Hans";
  if (hasEnglish) return "en";
  return "mixed";
}

export function parsedRecipeHasContent(parsed: ParsedRecipe): boolean {
  if (parsed.title.trim()) return true;
  if (parsed.ingredients.some((i) => i.text.trim())) return true;
  if (parsed.steps.some((s) => s.trim())) return true;
  if (parsed.notes.trim()) return true;
  return false;
}
