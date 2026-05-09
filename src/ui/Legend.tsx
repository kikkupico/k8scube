import { FACES } from "../content/concepts";
import { useApp } from "../state/store";

export function Legend() {
  const setActiveFace = useApp((s) => s.setActiveFace);
  return (
    <aside className="legend" aria-label="Cube faces">
      {FACES.map((f) => (
        <button
          key={f.id}
          className="legend-row"
          onClick={() => setActiveFace(f.id)}
          style={{
            appearance: "none",
            border: 0,
            background: "transparent",
            font: "inherit",
            color: "inherit",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span className="legend-swatch" style={{ background: f.color }} />
          <span>{f.title}</span>
          <span style={{ color: "var(--muted)", marginLeft: 4 }}>· {f.subtitle}</span>
        </button>
      ))}
    </aside>
  );
}
