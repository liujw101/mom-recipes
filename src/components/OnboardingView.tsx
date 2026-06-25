import { styles } from "../styles";

interface Props {
  onComplete: () => void;
}

const PAGES = [
  {
    title: "Scan Paper Recipes",
    subtitle:
      "Take a photo of a handwritten recipe. The app reads the text so you can review and save it.",
    icon: "📷",
  },
  {
    title: "Review Before Saving",
    subtitle:
      "Always check the text — handwriting can be tricky. Fix anything before you save.",
    icon: "✏️",
  },
  {
    title: "Search and Translate",
    subtitle:
      "Find recipes by name or ingredient. Switch between Chinese and English anytime.",
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
