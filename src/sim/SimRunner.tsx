import { useEffect, useRef } from "react";
import { useCluster, type ClusterSnapshot } from "../state/clusterStore";
import { step, type EngineState } from "./engine";

function snapshotFromStore(): EngineState {
  const cur = useCluster.getState();
  return {
    tick: cur.tick,
    nodes: cur.nodes,
    namespaces: cur.namespaces,
    deployments: cur.deployments,
    replicaSets: cur.replicaSets,
    daemonSets: cur.daemonSets,
    jobs: cur.jobs,
    cronJobs: cur.cronJobs,
    hpas: cur.hpas,
    pods: cur.pods,
    services: cur.services,
    ingresses: cur.ingresses,
    egressTargets: cur.egressTargets,
    pvs: cur.pvs,
    pvcs: cur.pvcs,
    configMaps: cur.configMaps,
    secrets: cur.secrets,
    events: cur.events,
    pendingActions: cur.pendingActions,
  };
}

function writeSnapshot(next: EngineState) {
  const patch: Partial<ClusterSnapshot> & { tick: number; pendingActions: EngineState["pendingActions"] } = {
    tick: next.tick,
    nodes: next.nodes,
    namespaces: next.namespaces,
    deployments: next.deployments,
    replicaSets: next.replicaSets,
    daemonSets: next.daemonSets,
    jobs: next.jobs,
    cronJobs: next.cronJobs,
    hpas: next.hpas,
    pods: next.pods,
    services: next.services,
    ingresses: next.ingresses,
    egressTargets: next.egressTargets,
    pvs: next.pvs,
    pvcs: next.pvcs,
    configMaps: next.configMaps,
    secrets: next.secrets,
    events: next.events,
    pendingActions: next.pendingActions,
  };
  useCluster.setState(patch);
}

/**
 * Drives the cluster simulation. Runs a fixed-cadence tick that calls the pure
 * `step` function and writes the resulting snapshot back to the zustand store.
 */
export function SimRunner() {
  const speed = useCluster((s) => s.speed);
  const paused = useCluster((s) => s.paused);
  const lastSnap = useRef<number>(0);

  useEffect(() => {
    if (paused) return;
    const intervalMs = Math.max(50, 1000 / Math.max(0.1, speed));
    const id = window.setInterval(() => {
      const now = performance.now();
      if (now - lastSnap.current < intervalMs - 5) return;
      lastSnap.current = now;
      writeSnapshot(step(snapshotFromStore()));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [speed, paused]);

  return null;
}

/** Run a single tick (used by step button). */
export function stepOnce() {
  writeSnapshot(step(snapshotFromStore()));
}
