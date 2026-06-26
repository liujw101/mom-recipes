import { styles } from "../styles";

interface Props {
  onComplete: () => void;
}

const PAGES = [
  {
    title: "Translate in NoteGPT",
    subtitle:
      "Photograph the handwritten recipe in NoteGPT (Chinese → English) and save the PNG to Photos.",
    icon: "🌐",
  },
  {
    title: "Import the PNG",
    subtitle:
      "Open Mom Recipes, tap +, choose Import from NoteGPT, and select that PNG file.",
    icon: "📥",
  },
  {
    title: "Search & Chinese Toggle",
    subtitle:
      "Find recipes anytime. Tap Chinese to see a Chinese version, or edit anything before saving.",
    icon: "🔍",
  },
];

export function OnboardingView({ onComplete }: Props) {
  return (
    <div style={{ ...styles.app, padding: 24, display: "flex", flexDirection: "column" }}>
      {PAGES.map((page) => (
        <div key={page.title} style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "4rem", marginBottom: 16 }}>{page.icon}</div>
          <h2 style={{ fontSize: "1.5rem", margin: "0 0 12px" }}>{page.title}</h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>{page.subtitle}</p>
        </div>
      ))}
      <div style={{ marginTop: "auto" }}>
        <button type="button" style={styles.btnPrimary} onClick={onComplete}>
          Get Started
        </button>
      </div>
    </div>
  );
}
