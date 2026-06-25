import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Recipe } from "../types/recipe";

interface RecipeDB extends DBSchema {
  recipes: {
    key: string;
    value: Recipe;
    indexes: { "by-updated": string };
  };
}

let dbPromise: Promise<IDBPDatabase<RecipeDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<RecipeDB>("mom-recipes", 1, {
      upgrade(db) {
        const store = db.createObjectStore("recipes", { keyPath: "id" });
        store.createIndex("by-updated", "updatedAt");
      },
    });
  }
  return dbPromise;
}

export async function getAllRecipes(): Promise<Recipe[]> {
  const db = await getDb();
  const recipes = await db.getAllFromIndex("recipes", "by-updated");
  return recipes.reverse();
}

export async function getRecipe(id: string): Promise<Recipe | undefined> {
  const db = await getDb();
  return db.get("recipes", id);
}

export async function saveRecipe(recipe: Recipe): Promise<Recipe> {
  const db = await getDb();
  const updated = { ...recipe, updatedAt: new Date().toISOString() };
  await db.put("recipes", updated);
  return updated;
}

export async function deleteRecipe(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("recipes", id);
}

export async function exportRecipesJson(): Promise<string> {
  const recipes = await getAllRecipes();
  return JSON.stringify(recipes, null, 2);
}

export async function importRecipesJson(json: string): Promise<number> {
  const parsed = JSON.parse(json) as Recipe[];
  if (!Array.isArray(parsed)) throw new Error("Invalid backup file");
  const db = await getDb();
  const tx = db.transaction("recipes", "readwrite");
  for (const recipe of parsed) {
    await tx.store.put(recipe);
  }
  await tx.done;
  return parsed.length;
}

export function matchesSearch(recipe: Recipe, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    recipe.title,
    recipe.titleTranslated,
    recipe.notes,
    recipe.tags.join(" "),
    recipe.ingredients.map((i) => i.text).join(" "),
    recipe.ingredients.map((i) => i.textTranslated).join(" "),
    recipe.steps.join(" "),
    (recipe.stepsTranslated ?? []).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}
