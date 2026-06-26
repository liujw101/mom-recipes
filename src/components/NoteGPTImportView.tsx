import { useRef, useState } from "react";
import {
  canImportNoteGPT,
  extractRecipeFromNoteGPTPng,
  fileToDataUrl,
} from "../services/notegptImportService";
import { parsedToRecipe } from "./EditRecipeView";
import type { ParsedRecipe, Recipe } from "../types/recipe";
import { styles } from "../styles";

const NOTEGPT_URL = "https://notegpt.io/ai-image-translator";

interface Props {
  onCancel: () => void;
  onComplete: (recipe: Recipe) => void;
}

export function NoteGPTImportView({ onCancel, onComplete }: Props) {
  const pngInputRef = useRef<HTMLInputElement>(null);
  const originalInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingOriginal, setPendingOriginal] = useState<string | undefined>();

  async function handleNoteGptPng(file: File) {
    setBusy(true);
    setError("");
    let parsed: ParsedRecipe | null = null;

    try {
      const pngDataUrl = await fileToDataUrl(file);

      if (canImportNoteGPT()) {
        try {
          parsed = await extractRecipeFromNoteGPTPng(file, setProgress);
        } catch (e) {
          const message = e instanceof Error ? e.message : "Import failed";
          setError(`${message} The PNG is attached — please type or fix the text below.`);
          parsed = emptyEnglishParsed();
        }
      } else {
        setError("Auto-read unavailable. The PNG is attached — please enter the recipe text manually.");
        parsed = emptyEnglishParsed();
      }

      const recipe = buildRecipe(parsed, pngDataUrl, pendingOriginal);
      onComplete(recipe);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed. Try again.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div style={styles.app}>
      <div style={styles.toolbar}>
        <button type="button" style={styles.backBtn} onClick={onCancel}>
          ← Cancel
        </button>
      </div>

      <div style={styles.section}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: "3rem" }}>📝</div>
          <h2 style={{ margin: "8px 0" }}>Import from NoteGPT</h2>
        </div>

        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            fontSize: "0.95rem",
            lineHeight: 1.6,
          }}
        >
          <strong>Step 1 — In Safari, open NoteGPT</strong>
          <ol style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            <li>
              <a href={NOTEGPT_URL} target="_blank" rel="noopener noreferrer">
                notegpt.io/ai-image-translator
              </a>
            </li>
            <li>Upload photo of handwritten recipe</li>
            <li>Chinese → English, then save the PNG to Photos</li>
          </ol>
          <strong style={{ display: "block", marginTop: 12 }}>Step 2 — Import PNG here</strong>
        </div>

        {busy && (
          <p style={{ textAlign: "center", color: "var(--accent)", fontWeight: 600 }}>
            {progress || "Processing…"}
          </p>
        )}

        <input
          ref={pngInputRef}
          type="file"
          accept="image/png,image/jpeg,image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleNoteGptPng(file);
          }}
        />

        <input
          ref={originalInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              void fileToDataUrl(file).then(setPendingOriginal);
            }
          }}
        />

        <button
          type="button"
          style={styles.btnPrimary}
          disabled={busy}
          onClick={() => pngInputRef.current?.click()}
        >
          📥 Choose NoteGPT PNG
        </button>

        <button
          type="button"
          style={{ ...styles.btnSecondary, marginTop: 12 }}
          disabled={busy}
          onClick={() => originalInputRef.current?.click()}
        >
          📷 Attach original Chinese photo (optional)
        </button>

        {pendingOriginal && (
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 8 }}>
            Original photo attached — will save with the recipe.
          </p>
        )}

        {error && (
          <p style={{ color: "#c0392b", textAlign: "center", marginTop: 12 }}>{error}</p>
        )}
      </div>
    </div>
  );
}

function emptyEnglishParsed(): ParsedRecipe {
  return {
    title: "",
    ingredients: [],
    steps: [""],
    notes: "",
    detectedLanguage: "en",
  };
}

function buildRecipe(parsed: ParsedRecipe, notegptPng: string, originalPhoto?: string): Recipe {
  const recipe = parsedToRecipe(parsed, notegptPng);
  recipe.sourceLanguage = "en";
  if (originalPhoto) {
    recipe.photoDataUrls = [notegptPng, originalPhoto];
  }
  return recipe;
}
