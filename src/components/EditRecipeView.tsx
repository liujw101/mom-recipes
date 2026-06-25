import { useState } from "react";
import {
  createEmptyRecipe,
  SUGGESTED_TAGS,
  type ParsedRecipe,
  type Recipe,
  type RecipeLanguage,
} from "../types/recipe";
import { styles } from "../styles";

interface Props {
  initial?: Partial<Recipe>;
  photoDataUrl?: string;
  isNew?: boolean;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function parsedToRecipe(parsed: ParsedRecipe, photoDataUrl?: string): Recipe {
  const recipe = createEmptyRecipe();
  recipe.title = parsed.title;
  recipe.ingredients = parsed.ingredients.length
    ? parsed.ingredients.map((text) => ({ text }))
    : [{ text: "" }];
  recipe.steps = parsed.steps.length ? parsed.steps : [""];
  recipe.notes = parsed.notes;
  recipe.sourceLanguage = parsed.detectedLanguage;
  if (photoDataUrl) recipe.photoDataUrls = [photoDataUrl];
  return recipe;
}

export function EditRecipeView({ initial, photoDataUrl, isNew, onSave, onCancel }: Props) {
  const [recipe, setRecipe] = useState<Recipe>(() => ({
    ...createEmptyRecipe(),
    ...initial,
    photoDataUrls: photoDataUrl
      ? [photoDataUrl, ...(initial?.photoDataUrls ?? [])]
      : (initial?.photoDataUrls ?? []),
  }));
  const [newTag, setNewTag] = useState("");

  function update(patch: Partial<Recipe>) {
    setRecipe((r) => ({ ...r, ...patch }));
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t) return;
    if (!recipe.tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      update({ tags: [...recipe.tags, t] });
    }
    setNewTag("");
  }

  function handleSave() {
    const cleaned: Recipe = {
      ...recipe,
      title: recipe.title.trim(),
      steps: recipe.steps.map((s) => s.trim()).filter(Boolean),
      ingredients: recipe.ingredients.filter((i) => i.text.trim()),
      updatedAt: new Date().toISOString(),
    };
    if (cleaned.steps.length === 0) cleaned.steps = [""];
    if (cleaned.ingredients.length === 0) cleaned.ingredients = [{ text: "" }];
    onSave(cleaned);
  }

  return (
    <div style={styles.app}>
      <div style={styles.toolbar}>
        <button type="button" style={styles.backBtn} onClick={onCancel}>
          Cancel
        </button>
        <span style={{ flex: 1, fontWeight: 700 }}>
          {isNew ? "Review Recipe" : "Edit Recipe"}
        </span>
        <button type="button" style={{ ...styles.backBtn, fontWeight: 700 }} onClick={handleSave}>
          Save
        </button>
      </div>

      <div style={styles.section}>
        {recipe.photoDataUrls[0] && (
          <>
            <div style={styles.label}>Scanned Photo</div>
            <img
              src={recipe.photoDataUrls[0]}
              alt="Scanned recipe"
              style={{ width: "100%", borderRadius: 12, marginBottom: 16 }}
            />
          </>
        )}

        <div style={styles.label}>Title</div>
        <input
          style={styles.input}
          value={recipe.title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Recipe name"
        />

        <div style={styles.label}>Ingredients</div>
        {recipe.ingredients.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              style={{ ...styles.input, width: 72, marginBottom: 0, flexShrink: 0 }}
              value={item.amount ?? ""}
              placeholder="Amt"
              onChange={(e) => {
                const ingredients = [...recipe.ingredients];
                ingredients[i] = { ...item, amount: e.target.value || undefined };
                update({ ingredients });
              }}
            />
            <input
              style={{ ...styles.input, flex: 1, marginBottom: 0 }}
              value={item.text}
              placeholder="Ingredient"
              onChange={(e) => {
                const ingredients = [...recipe.ingredients];
                ingredients[i] = { ...item, text: e.target.value };
                update({ ingredients });
              }}
            />
          </div>
        ))}
        <button
          type="button"
          style={{ ...styles.backBtn, marginBottom: 16 }}
          onClick={() => update({ ingredients: [...recipe.ingredients, { text: "" }] })}
        >
          + Add Ingredient
        </button>

        <div style={styles.label}>Steps</div>
        {recipe.steps.map((step, i) => (
          <textarea
            key={i}
            style={styles.input}
            value={step}
            placeholder={`Step ${i + 1}`}
            onChange={(e) => {
              const steps = [...recipe.steps];
              steps[i] = e.target.value;
              update({ steps });
            }}
          />
        ))}
        <button
          type="button"
          style={{ ...styles.backBtn, marginBottom: 16 }}
          onClick={() => update({ steps: [...recipe.steps, ""] })}
        >
          + Add Step
        </button>

        <div style={styles.label}>Notes</div>
        <textarea
          style={styles.input}
          value={recipe.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Extra notes"
        />

        <div style={styles.label}>Tags</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              style={{
                ...styles.chip,
                background: "var(--border)",
                color: "var(--text)",
              }}
            >
              {tag}{" "}
              <button
                type="button"
                style={{ border: "none", background: "none", cursor: "pointer" }}
                onClick={() => update({ tags: recipe.tags.filter((t) => t !== tag) })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            style={{ ...styles.input, flex: 1, marginBottom: 0 }}
            value={newTag}
            placeholder="Add tag"
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag(newTag)}
          />
          <button type="button" style={styles.btnSecondary} onClick={() => addTag(newTag)}>
            Add
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {SUGGESTED_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              style={{ ...styles.chip, background: "var(--card)", border: "1px solid var(--border)" }}
              onClick={() => addTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        <div style={styles.label}>Original Language</div>
        <select
          style={styles.input}
          value={recipe.sourceLanguage}
          onChange={(e) => update({ sourceLanguage: e.target.value as RecipeLanguage })}
        >
          <option value="mixed">Mixed</option>
          <option value="zh-Hans">Chinese</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  );
}
