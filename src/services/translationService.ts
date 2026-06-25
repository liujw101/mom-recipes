import type { Recipe, RecipeLanguage } from "../types/recipe";

/** Free translation via MyMemory API (rate-limited; fine for personal use). */
async function translateText(text: string, langPair: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${langPair}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Translation service unavailable");

  const data = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };

  if (data.responseStatus && data.responseStatus !== 200) {
    throw new Error("Daily translation limit reached. Try again tomorrow.");
  }

  return data.responseData?.translatedText ?? trimmed;
}

function langPairFor(sourceLanguage: RecipeLanguage): string {
  return sourceLanguage === "en" ? "en|zh-CN" : "zh-CN|en";
}

export async function translateRecipe(recipe: Recipe): Promise<Recipe> {
  const langPair = langPairFor(recipe.sourceLanguage);

  const titleTranslated = recipe.title
    ? await translateText(recipe.title, langPair)
    : undefined;

  const ingredients = [];
  for (const item of recipe.ingredients) {
    ingredients.push({
      ...item,
      textTranslated: item.text
        ? await translateText(item.text, langPair)
        : item.textTranslated,
    });
  }

  const stepsTranslated = [];
  for (const step of recipe.steps) {
    if (step.trim()) {
      stepsTranslated.push(await translateText(step, langPair));
    }
  }

  return {
    ...recipe,
    titleTranslated,
    ingredients,
    stepsTranslated,
    updatedAt: new Date().toISOString(),
  };
}
