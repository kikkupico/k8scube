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
    pods: cur.pods.map((p) => ({ ...p, volumes: [...p.volumes] })),
    services: cur.services.map((s) => ({ ...s, endpoints: [...s.endpoints] })),
    ingresses: cur.ingresses.map((i) => ({ ...i })),
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
    pods: next.pods,
    services: next.services,
    ingresses: next.ingresses,
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
