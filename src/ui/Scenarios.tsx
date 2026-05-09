import { useState } from "react";
import { runScenario, SCENARIOS } from "../sim/scenarios";
import { useCluster } from "../state/clusterStore";

export function Scenarios() {
  const [open, setOpen] = useState(false);
  const reset = useCluster((s) => s.resetCluster);

  return (
    <aside className="scenarios" data-open={open}>
      <button className="scenarios-toggle" onClick={() => setOpen((o) => !o)}>
        SCENARIOS {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="scenarios-body">
          {SCENARIOS.map((s) => (
            <button
              key={s.name}
              className="scenarios-row"
              onClick={() => {
                reset();
                // small delay so the reset writes settle before the scenario fires actions
                setTimeout(() => runScenario(s), 60);
              }}
            >
              <strong>{s.title}</strong>
              <span>{s.description}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
