import { useMemo, useState } from "react";
import { useCluster } from "../state/clusterStore";
import { useApp } from "../state/store";

const REASON_COLOR: Record<string, string> = {
  Scheduled: "#10b981",
  Pulling: "#0ea5e9",
  Pulled: "#0ea5e9",
  Started: "#10b981",
  Killing: "#f59e0b",
  Killed: "#94a3b8",
  Created: "#0ea5e9",
  Deleted: "#94a3b8",
  Liveness: "#ef4444",
  BackOff: "#ef4444",
  FailedScheduling: "#ef4444",
  RollingUpdate: "#a78bfa",
  ScalingReplicaSet: "#a78bfa",
  RollbackTo: "#a78bfa",
  NodeNotReady: "#ef4444",
  Drained: "#f59e0b",
  Cordoned: "#f59e0b",
  Uncordoned: "#10b981",
  Applied: "#0ea5e9",
};

export function EventLog() {
  const events = useCluster((s) => s.events);
  const tick = useCluster((s) => s.tick);
  const setActiveEntity = useApp((s) => s.setActiveEntity);
  const setActiveFace = useApp((s) => s.setActiveFace);
  const [open, setOpen] = useState(true);

  const items = useMemo(() => events.slice(0, 40), [events]);

  if (!open) {
    return (
      <button className="event-log-toggle" onClick={() => setOpen(true)} title="Show event log">
        EVENTS ({events.length})
      </button>
    );
  }

  return (
    <aside className="event-log" aria-label="Cluster events">
      <header>
        <span>EVENTS</span>
        <button className="event-log-close" onClick={() => setOpen(false)} aria-label="Hide">×</button>
      </header>
      <div className="event-log-body">
        {items.length === 0 && <div className="event-log-empty">no events yet</div>}
        {items.map((e) => {
          const color = REASON_COLOR[e.reason] ?? (e.type === "Warning" ? "#ef4444" : "#94a3b8");
          const age = `${tick - e.at}t`;
          return (
            <button
              key={e.id}
              className="event-log-row"
              onClick={() => {
                if (e.involvedObject.kind === "Pod" || e.involvedObject.kind === "Node") {
                  setActiveEntity(e.involvedObject.id);
                  if (e.involvedObject.kind === "Node") setActiveFace("nodes");
                  else setActiveFace("pods");
                }
              }}
            >
              <span className="event-log-age">{age}</span>
              <span className="event-log-reason" style={{ color }}>{e.reason}</span>
              <span className="event-log-target">{e.involvedObject.kind}/{e.involvedObject.name}</span>
              <span className="event-log-msg">{e.message}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
