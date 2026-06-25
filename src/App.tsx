import { useCallback, useEffect, useState } from "react";
import { getRecipe, saveRecipe } from "./db/recipeStore";
import { EditRecipeView, parsedToRecipe } from "./components/EditRecipeView";
import { LibraryView } from "./components/LibraryView";
import { OnboardingView } from "./components/OnboardingView";
import { RecipeDetailView } from "./components/RecipeDetailView";
import { ScanRecipeView } from "./components/ScanRecipeView";
import { createEmptyRecipe, type Recipe, type Screen } from "./types/recipe";

const ONBOARDING_KEY = "mom-recipes-onboarding-done";

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "library" });
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY)
  );
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);

  const loadRecipe = useCallback(async (id: string) => {
    const recipe = await getRecipe(id);
    setActiveRecipe(recipe ?? null);
  }, []);

  useEffect(() => {
    if (screen.name === "detail") {
      void loadRecipe(screen.recipeId);
    }
  }, [screen, loadRecipe]);

  function completeOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  }

  async function handleSave(recipe: Recipe) {
    await saveRecipe(recipe);
    setScreen({ name: "detail", recipeId: recipe.id });
    setActiveRecipe(recipe);
  }

  if (showOnboarding) {
    return <OnboardingView onComplete={completeOnboarding} />;
  }

  if (screen.name === "scan") {
    return (
      <ScanRecipeView
        onCancel={() => setScreen({ name: "library" })}
        onComplete={(parsed, photoDataUrl) => {
          const recipe = parsedToRecipe(parsed, photoDataUrl);
          setScreen({ name: "edit", recipeId: recipe.id, draft: recipe, photoDataUrl });
        }}
      />
    );
  }

  if (screen.name === "edit") {
    const initial = screen.draft ?? (screen.recipeId ? activeRecipe ?? undefined : createEmptyRecipe());
    return (
      <EditRecipeView
        initial={initial}
        photoDataUrl={screen.photoDataUrl}
        isNew={!screen.recipeId || !!screen.draft}
        onSave={handleSave}
        onCancel={() =>
          setScreen(
            screen.recipeId && activeRecipe
              ? { name: "detail", recipeId: screen.recipeId }
              : { name: "library" }
          )
        }
      />
    );
  }

  if (screen.name === "detail") {
    if (!activeRecipe) {
      return (
        <div style={{ padding: 24, textAlign: "center" }}>
          Loading…
          <button type="button" onClick={() => setScreen({ name: "library" })}>
            Back
          </button>
        </div>
      );
    }
    return (
      <RecipeDetailView
        recipe={activeRecipe}
        onBack={() => setScreen({ name: "library" })}
        onEdit={() => setScreen({ name: "edit", recipeId: activeRecipe.id })}
        onDeleted={() => {
          setActiveRecipe(null);
          setScreen({ name: "library" });
        }}
        onUpdated={setActiveRecipe}
      />
    );
  }

  return <LibraryView onNavigate={setScreen} />;
}
