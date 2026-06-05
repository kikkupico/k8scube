import { useCluster } from "../state/clusterStore";
import { injectNodeFailure, injectPodFailure, type EngineState } from "./engine";

export interface Scenario {
  name: string;
  title: string;
  description: string;
  /** runs side-effects against the store (sequential, with delays in ticks). */
  run: () => void;
}

/** Run a function against engine-shaped snapshot and write back. */
function patchStore(fn: (s: EngineState) => EngineState) {
  const cur = useCluster.getState();
  const snap: EngineState = {
    tick: cur.tick,
    nodes: cur.nodes.map((n) => ({ ...n })),
    namespaces: cur.namespaces.map((n) => ({ ...n })),
    deployments: cur.deployments.map((d) => ({ ...d })),
    replicaSets: cur.replicaSets.map((r) => ({ ...r })),
    daemonSets: cur.daemonSets.map((d) => ({ ...d })),
    jobs: cur.jobs.map((j) => ({ ...j })),
    cronJobs: cur.cronJobs.map((c) => ({ ...c })),
    hpas: cur.hpas.map((h) => ({ ...h })),
    pods: cur.pods.map((p) => ({ ...p, volumes: [...p.volumes] })),
    services: cur.services.map((s) => ({ ...s, endpoints: [...s.endpoints] })),
    ingresses: cur.ingresses.map((i) => ({ ...i })),
    egressTargets: cur.egressTargets.map((e) => ({ ...e, usedBy: [...e.usedBy] })),
    pvs: cur.pvs.map((v) => ({ ...v })),
    pvcs: cur.pvcs.map((c) => ({ ...c })),
    configMaps: cur.configMaps.map((c) => ({ ...c })),
    secrets: cur.secrets.map((c) => ({ ...c })),
    events: [...cur.events],
    pendingActions: cur.pendingActions,
  };
  const next = fn(snap);
  useCluster.setState({
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
  });
}

export const SCENARIOS: Scenario[] = [
  {
    name: "self-healing",
    title: "Self-healing",
    description: "kill a pod and watch the ReplicaSet bring it back",
    run: () => {
      const fePods = useCluster.getState().pods.filter((p) => p.deploymentId === "deploy-fe" && p.phase === "Running");
      const victim = fePods[0];
      if (victim) useCluster.getState().enqueue({ type: "DeletePod", name: victim.name });
    },
  },
  {
    name: "rolling-update",
    title: "Rolling update",
    description: "set image on frontend; watch surge/maxUnavailable",
    run: () => {
      const enq = useCluster.getState().enqueue;
      enq({ type: "ScaleDeployment", name: "frontend", replicas: 4 });
      enq({ type: "SetImage", deployment: "frontend", image: "nginx:1.27" });
    },
  },
  {
    name: "node-failure",
    title: "Node failure",
    description: "mark a worker NotReady; pods reschedule",
    run: () => {
      patchStore((s) => injectNodeFailure(s, "node-1"));
    },
  },
  {
    name: "service-discovery",
    title: "Service discovery",
    description: "scale frontend up; service endpoints follow",
    run: () => {
      useCluster.getState().enqueue({ type: "ScaleDeployment", name: "frontend", replicas: 5 });
    },
  },
  {
    name: "crash-loop",
    title: "Crash loop back-off",
    description: "kill the same pod repeatedly; watch backoff kick in",
    run: () => {
      const p = useCluster.getState().pods.find((x) => x.deploymentId === "deploy-be" && x.phase === "Running");
      if (!p) return;
      const id = p.id;
      patchStore((s) => injectPodFailure(s, id));
      setTimeout(() => patchStore((s) => injectPodFailure(s, id)), 1500);
      setTimeout(() => patchStore((s) => injectPodFailure(s, id)), 3000);
    },
  },
  {
    name: "pvc-binding",
    title: "PVC binding (storage)",
    description: "create a new PVC; binder finds a matching PV",
    run: () => {
      useCluster.getState().enqueue({ type: "ApplyPVC", spec: { name: "scratch", namespace: "default", capacityGi: 20, storageClass: "fast" } });
    },
  },
  {
    name: "pvc-pending",
    title: "PVC stuck Pending",
    description: "request a class that doesn't exist; pod stays Pending",
    run: () => {
      const enq = useCluster.getState().enqueue;
      enq({ type: "ApplyPVC", spec: { name: "needs-ssd", namespace: "default", capacityGi: 100, storageClass: "ssd-extreme" } });
      enq({ type: "ApplyDeployment", spec: { name: "data-app", replicas: 1, image: "data:1.0", color: "#f59e0b", volumeClaims: ["needs-ssd"] } });
    },
  },
  {
    name: "ingress-route",
    title: "Ingress + service",
    description: "expose frontend via service + ingress; flows light up",
    run: () => {
      const enq = useCluster.getState().enqueue;
      enq({ type: "ApplyService", spec: { name: "frontend-svc", deploymentName: "frontend", type: "LoadBalancer" } });
      enq({ type: "ApplyIngress", spec: { name: "web", host: "k8scube.local", serviceName: "frontend-svc" } });
    },
  },
  {
    name: "unschedulable",
    title: "Unschedulable pod",
    description: "request more CPU than any node has free; pod sticks Pending",
    run: () => {
      const enq = useCluster.getState().enqueue;
      // each replica asks for 3 cores; with 4-core nodes only one fits per node,
      // so 5 replicas can't all be placed -> FailedScheduling (Insufficient cpu).
      enq({ type: "ApplyDeployment", spec: { name: "hungry", replicas: 5, image: "stress:1.0", color: "#ef4444", requests: { cpu: 3000, mem: 1024 } } });
    },
  },
  {
    name: "daemonset",
    title: "DaemonSet on every node",
    description: "deploy a node agent; one pod lands on each worker, follows node add/remove",
    run: () => {
      useCluster.getState().enqueue({ type: "ApplyDaemonSet", spec: { name: "node-exporter", image: "node-exporter:1.7", color: "#22d3ee", requests: { cpu: 100, mem: 128 } } });
    },
  },
  {
    name: "batch-job",
    title: "Batch Job to completion",
    description: "run a Job with 3 completions; pods reach Succeeded and stay (not restarted)",
    run: () => {
      useCluster.getState().enqueue({ type: "ApplyJob", spec: { name: "db-backup", namespace: "apps", image: "backup:1.0", color: "#a855f7", completions: 3 } });
    },
  },
  {
    name: "cronjob",
    title: "CronJob schedule",
    description: "register a CronJob; it spawns a fresh Job every 20 ticks",
    run: () => {
      useCluster.getState().enqueue({ type: "ApplyCronJob", spec: { name: "nightly-report", image: "report:1.0", color: "#a855f7", schedule: 20, completions: 1 } });
    },
  },
  {
    name: "readiness-gate",
    title: "Readiness gate",
    description: "fail a pod's readiness probe; it leaves the Service endpoints but keeps Running, then returns",
    run: () => {
      const st = useCluster.getState();
      const p = st.pods.find((x) => x.deploymentId === "deploy-fe" && x.phase === "Running");
      if (!p) return;
      st.enqueue({ type: "SetReadiness", name: p.name, namespace: p.namespace, ready: false });
      setTimeout(() => useCluster.getState().enqueue({ type: "SetReadiness", name: p.name, namespace: p.namespace, ready: true }), 4000);
    },
  },
  {
    name: "liveness-restart",
    title: "Liveness restart",
    description: "fail a pod's liveness probe; the kubelet restarts the container in place (restart count +1)",
    run: () => {
      const st = useCluster.getState();
      const p = st.pods.find((x) => x.deploymentId === "deploy-be" && x.phase === "Running");
      if (p) st.enqueue({ type: "FailLiveness", name: p.name, namespace: p.namespace });
    },
  },
  {
    name: "autoscale",
    title: "Autoscale under load",
    description: "attach an HPA to frontend, then drive CPU load up; replicas climb, then settle when load drops",
    run: () => {
      const enq = useCluster.getState().enqueue;
      enq({ type: "ApplyHPA", spec: { deploymentName: "frontend", minReplicas: 2, maxReplicas: 6, targetCpuPercent: 50 } });
      enq({ type: "SetLoad", deployment: "frontend", load: 160 });
      setTimeout(() => useCluster.getState().enqueue({ type: "SetLoad", deployment: "frontend", load: 10 }), 6000);
    },
  },
  {
    name: "namespace-isolation",
    title: "Namespace isolation",
    description: "create a 'team-a' namespace and deploy into it",
    run: () => {
      const enq = useCluster.getState().enqueue;
      enq({ type: "CreateNamespace", name: "team-a" });
      enq({ type: "ApplyDeployment", spec: { name: "worker", namespace: "team-a", replicas: 2, image: "worker:1.0", color: "#ec4899" } });
    },
  },
];

export function runScenario(s: Scenario) {
  s.run();
}
