import type { ParsedRecipe, RecipeLanguage } from "../types/recipe";

const INGREDIENT_HEADERS = ["ingredients", "ingredient", "材料", "用料", "原料", "食材"];
const STEP_HEADERS = ["steps", "step", "directions", "method", "做法", "步骤", "作法", "制作"];
const TITLE_HEADERS = ["title", "recipe", "菜名", "名称"];

export function parseRecipeText(ocrText: string): ParsedRecipe {
  const lines = ocrText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      title: "",
      ingredients: [],
      steps: [],
      notes: "",
      detectedLanguage: "mixed",
    };
  }

  type Section = "unknown" | "title" | "ingredients" | "steps" | "notes";
  let section: Section = "unknown";
  let title = "";
  const ingredients: string[] = [];
  const steps: string[] = [];
  const notes: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (matchesHeader(lower, TITLE_HEADERS)) {
      section = "title";
      continue;
    }
    if (matchesHeader(lower, INGREDIENT_HEADERS)) {
      section = "ingredients";
      continue;
    }
    if (matchesHeader(lower, STEP_HEADERS)) {
      section = "steps";
      continue;
    }

    switch (section) {
      case "unknown":
        if (!title && !looksLikeStep(line)) title = line;
        else if (looksLikeStep(line)) {
          section = "steps";
          steps.push(stripStepPrefix(line));
        } else ingredients.push(stripBullet(line));
        break;
      case "title":
        if (!title) title = line;
        else {
          notes.push(line);
          section = "notes";
        }
        break;
      case "ingredients":
        if (looksLikeStep(line)) {
          section = "steps";
          steps.push(stripStepPrefix(line));
        } else ingredients.push(stripBullet(line));
        break;
      case "steps":
        steps.push(stripStepPrefix(line));
        break;
      case "notes":
        notes.push(line);
        break;
    }
  }

  if (!title && ingredients.length > 0) {
    title = ingredients.shift() ?? "";
  }

  return {
    title,
    ingredients,
    steps: steps.length ? steps : [""],
    notes: notes.join("\n"),
    detectedLanguage: detectLanguage(ocrText),
  };
}

function matchesHeader(line: string, headers: string[]): boolean {
  const lower = line.toLowerCase();
  return headers.some((h) => {
    if (/[\u4e00-\u9fff]/.test(h)) {
      return line === h || line.startsWith(`${h}：`) || line.startsWith(`${h}:`);
    }
    return lower === h || lower.startsWith(`${h}:`);
  });
}

function looksLikeStep(line: string): boolean {
  return /^(\d+[\.\)、]|step\s+\d+|第[一二三四五六七八九十\d]+)/i.test(line);
}

function stripStepPrefix(line: string): string {
  return line.replace(
    /^(\d+[\.\)、]\s*|step\s+\d+[\.\)]?\s*|第[一二三四五六七八九十\d]+[步\.、]\s*)/i,
    ""
  );
}

function stripBullet(line: string): string {
  return line.replace(/^[-•*·]\s*/, "");
}

function detectLanguage(text: string): RecipeLanguage {
  const hasChinese = /[\u4e00-\u9fff]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  if (hasChinese && hasEnglish) return "mixed";
  if (hasChinese) return "zh-Hans";
  if (hasEnglish) return "en";
  return "mixed";
}
