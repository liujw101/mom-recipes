import { useRef, useState } from "react";
import { parseRecipeText } from "../services/recipeParser";
import {
  compressImage,
  recognizeTextFromImage,
  type ChineseScript,
} from "../services/ocrService";
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
  const [script, setScript] = useState<ChineseScript>("simplified");

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const photoDataUrl = await compressImage(file);
      const text = await recognizeTextFromImage(file, setProgress, script);
      if (!text) {
        setError(
          "No text found. Use bright, even light, hold the phone directly above the paper, and try again."
        );
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
            Lay the paper flat in bright light. Fill the frame with the recipe. You'll review
            the text before saving.
          </p>
        </div>

        <div style={styles.label}>Recipe language</div>
        <select
          style={{ ...styles.input, marginBottom: 16 }}
          value={script}
          disabled={busy}
          onChange={(e) => setScript(e.target.value as ChineseScript)}
        >
          <option value="simplified">Chinese (Simplified) — 简体中文</option>
          <option value="traditional">Chinese (Traditional) — 繁體中文</option>
          <option value="both">Both Simplified & Traditional</option>
        </select>

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

        <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: 16, lineHeight: 1.5 }}>
          Tips for Chinese handwriting: avoid shadows, use the rear camera, and hold steady for
          2 seconds. First scan downloads the Chinese OCR engine (~15 MB).
        </p>

        {error && (
          <p style={{ color: "#c0392b", textAlign: "center", marginTop: 12 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
