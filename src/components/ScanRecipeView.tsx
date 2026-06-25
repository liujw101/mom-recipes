import { useRef, useState } from "react";
import { compressImage } from "../services/ocrService";
import { hasGeminiOcr, scanRecipeFromPhoto } from "../services/scanRecipe";
import type { ChineseScript } from "../services/ocrService";
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
  const smartScan = hasGeminiOcr();

  async function handleFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const photoDataUrl = await compressImage(file);
      const { parsed } = await scanRecipeFromPhoto(file, script, setProgress);
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
            Handwritten Chinese recipes work best in bright, even light. You'll always review
            before saving.
          </p>
        </div>

        {smartScan ? (
          <p
            style={{
              background: "#e8f5e9",
              color: "#2e7d32",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: "0.9rem",
              marginBottom: 16,
            }}
          >
            Smart scan on — optimized for handwritten Chinese with English mixed in.
          </p>
        ) : (
          <p
            style={{
              background: "#fff3e0",
              color: "#e65100",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: "0.9rem",
              marginBottom: 16,
            }}
          >
            Basic scan only — handwritten Chinese may need heavy editing. Ask the developer to
            enable smart scan.
          </p>
        )}

        <div style={styles.label}>Recipe language</div>
        <select
          style={{ ...styles.input, marginBottom: 16 }}
          value={script}
          disabled={busy}
          onChange={(e) => setScript(e.target.value as ChineseScript)}
        >
          <option value="simplified">Chinese (Simplified) — 简体中文</option>
          <option value="traditional">Chinese (Traditional) — 繁體中文</option>
          <option value="both">Mixed / either script</option>
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
          Tips: lay paper flat, avoid shadows, fill the frame, hold steady 2 seconds. English
          words (cup, g, oz) beside Chinese text are kept as-is.
        </p>

        {error && (
          <p style={{ color: "#c0392b", textAlign: "center", marginTop: 12 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
