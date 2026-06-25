export type RecipeLanguage = "zh-Hans" | "en" | "mixed";
export type DisplayLanguage = "original" | "english" | "both";

export interface IngredientLine {
  text: string;
  textTranslated?: string;
  amount?: string;
}

export interface Recipe {
  id: string;
  title: string;
  titleTranslated?: string;
  ingredients: IngredientLine[];
  steps: string[];
  stepsTranslated?: string[];
  notes: string;
  tags: string[];
  isFavorite: boolean;
  sourceLanguage: RecipeLanguage;
  photoDataUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ParsedRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  detectedLanguage: RecipeLanguage;
}

export type LibraryFilter =
  | { type: "all" }
  | { type: "favorites" }
  | { type: "tag"; tag: string };

export type Screen =
  | { name: "library" }
  | { name: "detail"; recipeId: string }
  | { name: "edit"; recipeId?: string; draft?: Partial<Recipe>; photoDataUrl?: string }
  | { name: "scan" };

export const SUGGESTED_TAGS = [
  "Soup",
  "Quick",
  "Holiday",
  "Chicken",
  "Pork",
  "Vegetarian",
  "Dessert",
  "Rice",
];

export function createEmptyRecipe(): Recipe {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "",
    ingredients: [{ text: "" }],
    steps: [""],
    notes: "",
    tags: [],
    isFavorite: false,
    sourceLanguage: "mixed",
    photoDataUrls: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function recipePlainText(
  recipe: Recipe,
  display: DisplayLanguage = "original"
): string {
  const lines: string[] = [];

  if (display === "original" || display === "both") {
    lines.push(recipe.title || "Untitled Recipe");
    if (display === "both" && recipe.titleTranslated) {
      lines.push(recipe.titleTranslated);
    }
    lines.push("", "Ingredients");
    for (const item of recipe.ingredients) {
      const prefix = item.amount ? `${item.amount} ` : "";
      lines.push(`- ${prefix}${item.text}`);
      if (display === "both" && item.textTranslated) {
        lines.push(`  (${item.textTranslated})`);
      }
    }
    lines.push("", "Steps");
    recipe.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
      if (display === "both" && recipe.stepsTranslated?.[i]) {
        lines.push(`   (${recipe.stepsTranslated[i]})`);
      }
    });
    if (recipe.notes) {
      lines.push("", "Notes", recipe.notes);
    }
  } else {
    lines.push(recipe.titleTranslated || recipe.title || "Untitled Recipe");
    lines.push("", "Ingredients");
    for (const item of recipe.ingredients) {
      const prefix = item.amount ? `${item.amount} ` : "";
      lines.push(`- ${prefix}${item.textTranslated || item.text}`);
    }
    lines.push("", "Steps");
    const steps = recipe.stepsTranslated?.length ? recipe.stepsTranslated : recipe.steps;
    steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }

  return lines.join("\n");
}
