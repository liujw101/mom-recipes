import { useRef, useState } from "react";
import { parseRecipeText } from "../services/recipeParser";
import { compressImage, recognizeTextFromImage } from "../services/ocrService";
import type { ParsedRecipe } from "../types/recipe";
import { styles } from "../styles";

interface Props {
  onCancel: () => void;
  onComplete: (parsed: ParsedRecipe, photoDataUrl: string) => void;
}

export function ScanRecipeView({ onCancel, onComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const photoDataUrl = await compressImage(file);
      const text = await recognizeTextFromImage(file, setProgress);
      if (!text) {
        setError("No text found. Try better lighting or enter the recipe manually.");
        return;
      }
      const parsed = parseRecipeText(text);
      onComplete(parsed, photoDataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed. Try again.");
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
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "3.5rem" }}>📄</div>
          <h2 style={{ margin: "12px 0 8px" }}>Scan a Recipe</h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.5 }}>
            Use good lighting and hold the phone steady. You'll review the text before saving.
          </p>
        </div>

        {busy && (
          <p style={{ textAlign: "center", color: "var(--accent)", fontWeight: 600 }}>
            {progress || "Processing…"}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />

        <button
          type="button"
          style={styles.btnPrimary}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          📷 Take Photo or Choose Image
        </button>

        {error && (
          <p style={{ color: "#c0392b", textAlign: "center", marginTop: 12 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
