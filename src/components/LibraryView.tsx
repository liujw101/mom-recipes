import { useCallback, useEffect, useMemo, useState } from "react";
import { exportRecipesJson, getAllRecipes, importRecipesJson, matchesSearch } from "../db/recipeStore";
import type { LibraryFilter, Recipe, Screen } from "../types/recipe";
import { styles } from "../styles";

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function LibraryView({ onNavigate }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>({ type: "all" });
  const [showAddMenu, setShowAddMenu] = useState(false);

  const load = useCallback(async () => {
    setRecipes(await getAllRecipes());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allTags = useMemo(
    () => Array.from(new Set(recipes.flatMap((r) => r.tags))).sort(),
    [recipes]
  );

  const filtered = recipes.filter((recipe) => {
    if (!matchesSearch(recipe, search)) return false;
    if (filter.type === "favorites") return recipe.isFavorite;
    if (filter.type === "tag") {
      return recipe.tags.some((t) => t.toLowerCase() === filter.tag.toLowerCase());
    }
    return true;
  });

  async function handleExport() {
    const json = await exportRecipesJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mom-recipes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const count = await importRecipesJson(text);
        alert(`Imported ${count} recipes.`);
        void load();
      } catch {
        alert("Invalid backup file.");
      }
    };
    input.click();
  }

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <h1 style={styles.title}>Mom Recipes</h1>
        <input
          style={styles.search}
          placeholder="Search recipes or ingredients"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={styles.chipRow}>
        <FilterChip label="All" active={filter.type === "all"} onClick={() => setFilter({ type: "all" })} />
        <FilterChip
          label="Favorites"
          active={filter.type === "favorites"}
          onClick={() => setFilter({ type: "favorites" })}
        />
        {allTags.map((tag) => (
          <FilterChip
            key={tag}
            label={tag}
            active={filter.type === "tag" && filter.tag === tag}
            onClick={() => setFilter({ type: "tag", tag })}
          />
        ))}
      </div>

      <div style={styles.list}>
        {filtered.length === 0 ? (
          <div style={styles.empty}>
            <p>No recipes yet.</p>
            <p>Tap + to scan or add a recipe.</p>
          </div>
        ) : (
          filtered.map((recipe) => (
            <button
              key={recipe.id}
              type="button"
              style={styles.card}
              onClick={() => onNavigate({ name: "detail", recipeId: recipe.id })}
            >
              <p style={styles.cardTitle}>
                {recipe.isFavorite && "❤️ "}
                {recipe.title || "Untitled Recipe"}
              </p>
              {recipe.tags.length > 0 && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                  {recipe.tags.join(" · ")}
                </p>
              )}
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "0.8rem" }}>
                {new Date(recipe.updatedAt).toLocaleDateString()}
              </p>
            </button>
          ))
        )}

        <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
          <button type="button" style={{ ...styles.btnSecondary, flex: 1 }} onClick={handleExport}>
            Backup
          </button>
          <button type="button" style={{ ...styles.btnSecondary, flex: 1 }} onClick={handleImport}>
            Restore
          </button>
        </div>
      </div>

      <button type="button" style={styles.fab} onClick={() => setShowAddMenu(true)} aria-label="Add recipe">
        +
      </button>

      {showAddMenu && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 30,
            display: "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setShowAddMenu(false)}
        >
          <div
            style={{
              background: "var(--card)",
              width: "100%",
              maxWidth: 480,
              margin: "0 auto",
              borderRadius: "20px 20px 0 0",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>New Recipe</h3>
            <button
              type="button"
              style={styles.btnPrimary}
              onClick={() => {
                setShowAddMenu(false);
                onNavigate({ name: "scan" });
              }}
            >
              📷 Scan Recipe
            </button>
            <button
              type="button"
              style={styles.btnSecondary}
              onClick={() => {
                setShowAddMenu(false);
                onNavigate({ name: "edit", draft: {} });
              }}
            >
              ✏️ Add Manually
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={{
        ...styles.chip,
        background: active ? "var(--accent)" : "var(--card)",
        color: active ? "#fff" : "var(--text)",
        border: active ? "none" : "1px solid var(--border)",
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
