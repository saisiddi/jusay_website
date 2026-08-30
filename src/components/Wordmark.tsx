/**
 * Canonical Jusay wordmark: "ju" in Inter 800 upright, "say." in Times New Roman
 * 700 italic. Kept in one place so every auth/account page renders it identically.
 */
const Wordmark = ({ size = 20, color = "#2e2d2d" }: { size?: number; color?: string }) => (
  <span style={{ lineHeight: 1, fontSize: size, userSelect: "none" }}>
    <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontStyle: "normal", color }}>
      ju
    </span>
    <span
      style={{
        fontFamily: "'Times New Roman', Times, Georgia, serif",
        fontStyle: "italic",
        fontWeight: 700,
        color,
      }}
    >
      say.
    </span>
  </span>
);

export default Wordmark;
