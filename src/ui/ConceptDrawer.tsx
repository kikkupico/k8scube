import { useMemo } from "react";
import { useApp } from "../state/store";
import { useCluster } from "../state/clusterStore";
import { faceMeta } from "../content/concepts";

export function ConceptDrawer() {
  const activeFace = useApp((s) => s.activeFace);
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);
  const closeDrawer = useApp((s) => s.closeDrawer);

  const nodes = useCluster((s) => s.nodes);
  const pods = useCluster((s) => s.pods);
  const services = useCluster((s) => s.services);
  const deployments = useCluster((s) => s.deployments);

  const allEntities = useMemo(() => [...nodes, ...pods, ...services], [nodes, pods, services]);
  const selected = useMemo(() => allEntities.find((e) => e.id === activeEntityId) ?? null, [allEntities, activeEntityId]);
  const meta = useMemo(() => activeFace ? faceMeta(activeFace) : null, [activeFace]);

  // Filter entities by face for the list
  const faceEntities = useMemo(() => allEntities.filter((e) => {
    if (activeFace === "nodes") return nodes.find(n => n.id === e.id && n.role === "worker");
    if (activeFace === "pods") return pods.find(p => p.id === e.id);
    if (activeFace === "networking") return services.find(s => s.id === e.id);
    if (activeFace === "control-plane") return nodes.find(n => n.id === e.id && n.role === "control-plane");
    return false;
  }), [allEntities, activeFace, nodes, pods, services]);

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
                  onClick={() => setActiveEntity(null)}
                  style={{
                    appearance: "none", border: 0, background: "transparent",
                    color: "var(--muted)", font: "inherit", padding: 0, cursor: "pointer",
                    marginBottom: 12, textTransform: "uppercase", fontSize: 10
                  }}
                >
                  ← all on this face
                </button>
                <h3 style={{ margin: 0, fontSize: 18, color: meta.color }}>{selected.name.toUpperCase()}</h3>
                <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 13, color: "var(--muted)" }}>
                  <p><strong>ID:</strong> {selected.id}</p>
                  {"status" in selected && <p><strong>Status:</strong> <span style={{ color: selected.status === "Ready" || selected.status === "Running" ? "#10b981" : "#ef4444" }}>{selected.status}</span></p>}
                  {"role" in selected && <p><strong>Role:</strong> {selected.role}</p>}
                  {"deploymentId" in selected && (
                    <p><strong>Deployment:</strong> {deployments.find(d => d.id === (selected as any).deploymentId)?.name}</p>
                  )}
                  {"type" in selected && <p><strong>Type:</strong> {(selected as any).type}</p>}
                </div>
              </>
            ) : (
              <ul className="concept-list">
                {faceEntities.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => setActiveEntity(e.id)}
                      style={{
                        appearance: "none", border: 0, background: "transparent",
                        font: "inherit", color: "inherit", padding: 0, cursor: "pointer",
                        textAlign: "left", width: "100%",
                      }}
                    >
                      <h3>{e.name}</h3>
                      {"status" in e && <p style={{ fontSize: 11, color: "var(--muted)" }}>Status: {e.status}</p>}
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
