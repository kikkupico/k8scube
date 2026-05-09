import { useMemo } from "react";
import { useCluster } from "../state/clusterStore";
import { stepOnce } from "../sim/SimRunner";

const SPEEDS = [0.25, 0.5, 1, 2, 4];

export function TimeControls() {
  const paused = useCluster((s) => s.paused);
  const speed = useCluster((s) => s.speed);
  const tick = useCluster((s) => s.tick);
  const setPaused = useCluster((s) => s.setPaused);
  const setSpeed = useCluster((s) => s.setSpeed);
  const reset = useCluster((s) => s.resetCluster);
  const enqueue = useCluster((s) => s.enqueue);
  const nodes = useCluster((s) => s.nodes);
  const workers = useMemo(() => nodes.filter((n) => n.role === "worker"), [nodes]);

  return (
    <div className="time-controls">
      <button onClick={() => setPaused(!paused)} title={paused ? "Play" : "Pause"} aria-pressed={paused}>
        {paused ? "▶" : "⏸"}
      </button>
      <button onClick={() => stepOnce()} title="Step one tick">⏭</button>
      <span className="time-tick">tick {tick}</span>
      <div className="time-speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            data-active={Math.abs(speed - s) < 0.01}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
      <div className="time-nodes">
        <span className="time-nodes-label">NODES {workers.length}</span>
        <button onClick={() => enqueue({ type: "CreateNode" })} title="Add a worker node">+</button>
        <button
          onClick={() => {
            const last = workers[workers.length - 1];
            if (last) enqueue({ type: "DeleteNode", name: last.name });
          }}
          disabled={workers.length <= 1}
          title="Remove the last worker (evicts its pods)"
        >−</button>
      </div>
      <button className="time-reset" onClick={() => reset()} title="Reset cluster">RESET</button>
    </div>
  );
}
