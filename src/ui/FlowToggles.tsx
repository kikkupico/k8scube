import { FLOWS } from "../modes/flowDefs";
import { useApp } from "../state/store";

export function FlowToggles() {
  const enabled = useApp((s) => s.enabledFlows);
  const toggle = useApp((s) => s.toggleFlow);

  return (
    <aside className="flow-toggles" aria-label="Active flows">
      <div className="flow-toggles-title">Flows</div>
      {FLOWS.map((f) => {
        const on = enabled[f.id] !== false;
        return (
          <button
            key={f.id}
            className="flow-toggle"
            data-on={on}
            onClick={() => toggle(f.id)}
          >
            <span className="flow-swatch" style={{ background: on ? f.color : "transparent", borderColor: f.color }} />
            <span>
              <strong>{f.label}</strong>
              <span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>
                {f.description}
              </span>
            </span>
          </button>
        );
      })}
    </aside>
  );
}
