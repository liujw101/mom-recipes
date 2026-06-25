import { useState } from "react";
import { deleteRecipe, saveRecipe } from "../db/recipeStore";
import { translateRecipe } from "../services/translationService";
import {
  recipePlainText,
  type DisplayLanguage,
  type Recipe,
} from "../types/recipe";
import { styles } from "../styles";

interface Props {
  recipe: Recipe;
  onBack: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  onUpdated: (recipe: Recipe) => void;
}

export function RecipeDetailView({
  recipe,
  onBack,
  onEdit,
  onDeleted,
  onUpdated,
}: Props) {
  const [display, setDisplay] = useState<DisplayLanguage>("original");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggleFavorite() {
    const updated = await saveRecipe({ ...recipe, isFavorite: !recipe.isFavorite });
    onUpdated(updated);
  }

  async function handleTranslate() {
    setBusy(true);
    setError("");
    try {
      const translated = await translateRecipe(recipe);
      const saved = await saveRecipe(translated);
      onUpdated(saved);
      setDisplay("both");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this recipe?")) return;
    await deleteRecipe(recipe.id);
    onDeleted();
  }

  function handleShare() {
    const text = recipePlainText(recipe, display);
    if (navigator.share) {
      void navigator.share({ title: recipe.title, text });
    } else {
      void navigator.clipboard.writeText(text);
      alert("Recipe copied to clipboard!");
    }
  }

  function handlePrint() {
    const text = recipePlainText(recipe, display);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<pre style="font-family:sans-serif;padding:24px">${text.replace(/</g, "&lt;")}</pre>`);
    win.document.close();
    win.print();
  }

  const title =
    display === "english"
      ? recipe.titleTranslated || recipe.title
      : recipe.title || "Untitled Recipe";

  return (
    <div style={styles.app}>
      <div style={styles.toolbar}>
        <button type="button" style={styles.backBtn} onClick={onBack}>
          ← Recipes
        </button>
        <button type="button" style={{ ...styles.backBtn, fontSize: "1.4rem" }} onClick={toggleFavorite}>
          {recipe.isFavorite ? "❤️" : "🤍"}
        </button>
      </div>

      <div style={styles.section}>
        <div style={styles.segmented}>
          {(["original", "english", "both"] as DisplayLanguage[]).map((mode) => (
            <button
              key={mode}
              type="button"
              style={{
                ...styles.segment,
                ...(display === mode ? styles.segmentActive : {}),
              }}
              onClick={() => setDisplay(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <h1 style={{ fontSize: "1.75rem", margin: "0 0 8px" }}>{title}</h1>
        {display === "both" && recipe.titleTranslated && recipe.titleTranslated !== recipe.title && (
          <p style={{ color: "var(--muted)", marginTop: 0 }}>{recipe.titleTranslated}</p>
        )}
        {recipe.tags.length > 0 && (
          <p style={{ color: "var(--muted)" }}>{recipe.tags.join(" · ")}</p>
        )}

        <h2 style={{ fontSize: "1.25rem" }}>Ingredients</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          {recipe.ingredients.map((item, i) => (
            <li key={i}>
              {item.amount ? `${item.amount} ` : ""}
              {display === "english" ? item.textTranslated || item.text : item.text}
              {display === "both" && item.textTranslated && item.textTranslated !== item.text && (
                <span style={{ color: "var(--muted)" }}> ({item.textTranslated})</span>
              )}
            </li>
          ))}
        </ul>

        <h2 style={{ fontSize: "1.25rem" }}>Steps</h2>
        <ol style={{ paddingLeft: 20, lineHeight: 1.7 }}>
          {(display === "english" && recipe.stepsTranslated?.length
            ? recipe.stepsTranslated
            : recipe.steps
          ).map((step, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              {step}
              {display === "both" &&
                recipe.stepsTranslated?.[i] &&
                recipe.stepsTranslated[i] !== recipe.steps[i] && (
                  <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
                    ({recipe.stepsTranslated![i]})
                  </div>
                )}
            </li>
          ))}
        </ol>

        {recipe.notes && display !== "english" && (
          <>
            <h2 style={{ fontSize: "1.25rem" }}>Notes</h2>
            <p style={{ lineHeight: 1.6 }}>{recipe.notes}</p>
          </>
        )}

        {recipe.photoDataUrls.length > 0 && (
          <>
            <h2 style={{ fontSize: "1.25rem" }}>Original Photo</h2>
            <img
              src={recipe.photoDataUrls[0]}
              alt="Original recipe"
              style={{ width: "100%", borderRadius: 12 }}
            />
          </>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <button type="button" style={styles.btnPrimary} onClick={handleShare} disabled={busy}>
            Share Recipe
          </button>
          <button type="button" style={styles.btnSecondary} onClick={handlePrint}>
            Print / Save as PDF
          </button>
          <button type="button" style={styles.btnSecondary} onClick={handleTranslate} disabled={busy}>
            {busy ? "Translating…" : "Translate Recipe"}
          </button>
          <button type="button" style={styles.btnSecondary} onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            style={{ ...styles.btnSecondary, color: "#c0392b", borderColor: "#c0392b" }}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>

        {error && <p style={{ color: "#c0392b", marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}
