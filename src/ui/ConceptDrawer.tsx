import { useApp } from "../state/store";
import { conceptsByFace, faceMeta } from "../content/concepts";

export function ConceptDrawer() {
  const activeFace = useApp((s) => s.activeFace);
  const activeConcept = useApp((s) => s.activeConcept);
  const setActiveConcept = useApp((s) => s.setActiveConcept);
  const closeDrawer = useApp((s) => s.closeDrawer);

  const meta = activeFace ? faceMeta(activeFace) : null;
  const concepts = activeFace ? conceptsByFace(activeFace) : [];
  const selected = concepts.find((c) => c.id === activeConcept) ?? null;

  return (
    <aside
      className="drawer"
      data-open={!!activeFace}
      aria-hidden={!activeFace}
    >
      {meta && (
        <>
          <header>
            <div>
              <div className="face-tag" style={{ color: meta.color }}>{meta.subtitle}</div>
              <h2>{meta.title}</h2>
            </div>
            <button className="close" onClick={closeDrawer} aria-label="Close">×</button>
          </header>

          <div className="body">
            {selected ? (
              <>
                <button
                  onClick={() => setActiveConcept(null)}
                  style={{
                    appearance: "none", border: 0, background: "transparent",
                    color: "var(--muted)", font: "inherit", padding: 0, cursor: "pointer",
                    marginBottom: 12,
                  }}
                >
                  ← all on this face
                </button>
                <h3 style={{ margin: 0, fontSize: 18 }}>{selected.title}</h3>
                <p style={{ color: "var(--muted)", margin: "4px 0 12px" }}>{selected.short}</p>
                <p style={{ lineHeight: 1.55 }}>{selected.long}</p>
              </>
            ) : (
              <ul className="concept-list">
                {concepts.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setActiveConcept(c.id)}
                      style={{
                        appearance: "none", border: 0, background: "transparent",
                        font: "inherit", color: "inherit", padding: 0, cursor: "pointer",
                        textAlign: "left", width: "100%",
                      }}
                    >
                      <h3>{c.title}</h3>
                      <p>{c.short}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
