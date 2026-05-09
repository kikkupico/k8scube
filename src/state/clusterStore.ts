import { create } from "zustand";

// ---------- Types ----------

export type PodPhase =
  | "Pending"
  | "ContainerCreating"
  | "Running"
  | "Succeeded"
  | "Failed"
  | "CrashLoopBackOff"
  | "Terminating";

export type NodeStatus = "Ready" | "NotReady" | "Cordoned";

export interface K8sNode {
  id: string;
  name: string;
  role: "control-plane" | "worker";
  status: NodeStatus;
}

export interface PodContainer {
  name: string;
  image: string;
  ready: boolean;
}

export interface PodVolumeRef {
  name: string;
  claimName: string;
}

export interface K8sPod {
  id: string;
  name: string;
  namespace: string;
  ownerRef: string | null;     // ReplicaSet id
  deploymentId: string | null; // null for naked pods (none currently)
  nodeId: string | null;
  phase: PodPhase;
  restartCount: number;
  containers: PodContainer[];
  volumes: PodVolumeRef[];
  templateHash: string;
  createdAt: number;
  /** internal: ticks remaining in current sub-state (e.g. pulling image) */
  phaseTicks: number;
  /** internal: when set, pod will be removed after this many additional ticks */
  terminationTicks: number;
  /** internal: rapid failures since last Running */
  failuresInARow: number;
  /** internal: backoff timer (ticks) before retry attempt */
  backoffTicks: number;
  /** for the visual flight from api-server to its node */
  flightProgress: number; // 0..1; when <1 the PodCapsule is hidden, the flight particle shows
  /** human-readable reason a Pending pod is stuck (e.g. "WaitingForPVC") */
  pendingReason?: string;
}

export interface DeploymentStrategy {
  type: "RollingUpdate" | "Recreate";
  maxSurge: number;
  maxUnavailable: number;
}

export interface RolloutHistoryEntry {
  revision: number;
  templateHash: string;
  image: string;
  at: number;
}

export interface K8sDeployment {
  id: string;
  name: string;
  namespace: string;
  desiredReplicas: number;
  color: string;
  image: string;
  strategy: DeploymentStrategy;
  templateHash: string;
  rollouts: RolloutHistoryEntry[];
  /** PVC names mounted by every pod of this deployment */
  volumeClaims: string[];
}

export interface K8sReplicaSet {
  id: string;
  deploymentId: string;
  templateHash: string;
  desiredReplicas: number;
  /** sortable revision number for ordering rollouts */
  revision: number;
}

export interface K8sService {
  id: string;
  name: string;
  namespace: string;
  type: "ClusterIP" | "LoadBalancer" | "NodePort";
  selector: { deploymentId: string };
  endpoints: string[]; // pod ids
}

export interface K8sIngress {
  id: string;
  name: string;
  namespace: string;
  host: string;
  serviceName: string;
}

export type PVCStatus = "Pending" | "Bound" | "Lost";
export type PVStatus = "Available" | "Bound" | "Released";

export interface K8sPV {
  id: string;
  name: string;
  capacityGi: number;
  storageClass: string;
  status: PVStatus;
  boundClaim: string | null; // PVC id
}

export interface K8sPVC {
  id: string;
  name: string;
  namespace: string;
  capacityGi: number;
  storageClass: string;
  status: PVCStatus;
  boundVolume: string | null; // PV id
}

export interface K8sConfigMap {
  id: string;
  name: string;
  namespace: string;
  data: Record<string, string>;
}

export interface K8sSecret {
  id: string;
  name: string;
  namespace: string;
  data: Record<string, string>;
}

export interface K8sNamespace {
  id: string;
  name: string;
  color: string;
}

export interface ClusterEvent {
  id: string;
  at: number;
  type: "Normal" | "Warning";
  reason: string;
  involvedObject: { kind: string; name: string; id: string };
  message: string;
}

export type Action =
  | { type: "ScaleDeployment"; name: string; namespace?: string; replicas: number }
  | { type: "DeletePod"; name: string; namespace?: string }
  | { type: "DeleteDeployment"; name: string; namespace?: string }
  | { type: "SetImage"; deployment: string; namespace?: string; image: string }
  | { type: "RolloutUndo"; deployment: string; namespace?: string }
  | { type: "ApplyDeployment"; spec: DeploymentSpec }
  | { type: "DrainNode"; node: string }
  | { type: "Cordon"; node: string }
  | { type: "Uncordon"; node: string }
  // storage
  | { type: "ApplyPV"; spec: PVSpec }
  | { type: "ApplyPVC"; spec: PVCSpec }
  | { type: "DeletePVC"; name: string; namespace?: string }
  | { type: "ApplyConfigMap"; spec: ConfigSpec }
  | { type: "ApplySecret"; spec: ConfigSpec }
  // networking
  | { type: "ApplyService"; spec: ServiceSpec }
  | { type: "DeleteService"; name: string; namespace?: string }
  | { type: "ApplyIngress"; spec: IngressSpec }
  | { type: "DeleteIngress"; name: string; namespace?: string }
  // foundations
  | { type: "CreateNamespace"; name: string; color?: string }
  | { type: "DeleteNamespace"; name: string };

export interface DeploymentSpec {
  name: string;
  namespace?: string;
  replicas: number;
  image: string;
  color?: string;
  strategy?: Partial<DeploymentStrategy>;
  volumeClaims?: string[];
}

export interface PVSpec { name: string; capacityGi: number; storageClass?: string }
export interface PVCSpec { name: string; namespace?: string; capacityGi: number; storageClass?: string }
export interface ConfigSpec { name: string; namespace?: string; data: Record<string, string> }
export interface ServiceSpec { name: string; namespace?: string; type?: K8sService["type"]; deploymentName: string }
export interface IngressSpec { name: string; namespace?: string; host: string; serviceName: string }

// ---------- Helpers ----------

let _idCounter = 1000;
export const nextId = (prefix: string) => `${prefix}-${(_idCounter++).toString(36)}`;

export function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
  return (h >>> 0).toString(36).slice(0, 5);
}

export function templateHashFor(image: string): string {
  return shortHash(image);
}

export function podNameFor(deploymentName: string, templateHash: string): string {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${deploymentName}-${templateHash}-${suffix}`;
}

export const DEPLOY_PALETTE = [
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

export const NS_PALETTE = [
  "#0ea5e9",
  "#a855f7",
  "#10b981",
  "#f97316",
  "#ec4899",
];

export const DEFAULT_NS = "default";

// ---------- Store ----------

interface ClusterState {
  // simulation clock
  tick: number;
  paused: boolean;
  speed: number; // ticks per real-second

  // entities
  nodes: K8sNode[];
  namespaces: K8sNamespace[];
  deployments: K8sDeployment[];
  replicaSets: K8sReplicaSet[];
  pods: K8sPod[];
  services: K8sService[];
  ingresses: K8sIngress[];
  pvs: K8sPV[];
  pvcs: K8sPVC[];
  configMaps: K8sConfigMap[];
  secrets: K8sSecret[];

  // event log & action queue
  events: ClusterEvent[];
  pendingActions: Action[];

  // -- mutators --
  enqueue: (a: Action) => void;
  setPaused: (p: boolean) => void;
  setSpeed: (s: number) => void;
  bumpTick: () => void;
  resetCluster: (snapshot?: Partial<ClusterSnapshot>) => void;
}

export interface ClusterSnapshot {
  nodes: K8sNode[];
  namespaces: K8sNamespace[];
  deployments: K8sDeployment[];
  replicaSets: K8sReplicaSet[];
  pods: K8sPod[];
  services: K8sService[];
  ingresses: K8sIngress[];
  pvs: K8sPV[];
  pvcs: K8sPVC[];
  configMaps: K8sConfigMap[];
  secrets: K8sSecret[];
  events: ClusterEvent[];
}

// ---------- Initial seed ----------

function seedCluster(): ClusterSnapshot {
  const nodes: K8sNode[] = [
    { id: "cp-1", name: "control-plane-1", role: "control-plane", status: "Ready" },
    { id: "node-1", name: "worker-node-1", role: "worker", status: "Ready" },
    { id: "node-2", name: "worker-node-2", role: "worker", status: "Ready" },
    { id: "node-3", name: "worker-node-3", role: "worker", status: "Ready" },
  ];

  const namespaces: K8sNamespace[] = [
    { id: "ns-default", name: "default", color: NS_PALETTE[0] },
    { id: "ns-kube-system", name: "kube-system", color: "#94a3b8" },
    { id: "ns-apps", name: "apps", color: NS_PALETTE[2] },
  ];

  const feHash = templateHashFor("nginx:1.25");
  const beHash = templateHashFor("api:2.1");

  const deployments: K8sDeployment[] = [
    {
      id: "deploy-fe",
      name: "frontend",
      namespace: "default",
      desiredReplicas: 2,
      color: "#0ea5e9",
      image: "nginx:1.25",
      strategy: { type: "RollingUpdate", maxSurge: 1, maxUnavailable: 0 },
      templateHash: feHash,
      rollouts: [{ revision: 1, templateHash: feHash, image: "nginx:1.25", at: 0 }],
      volumeClaims: [],
    },
    {
      id: "deploy-be",
      name: "backend",
      namespace: "apps",
      desiredReplicas: 2,
      color: "#8b5cf6",
      image: "api:2.1",
      strategy: { type: "RollingUpdate", maxSurge: 1, maxUnavailable: 0 },
      templateHash: beHash,
      rollouts: [{ revision: 1, templateHash: beHash, image: "api:2.1", at: 0 }],
      volumeClaims: ["data"],
    },
  ];

  const replicaSets: K8sReplicaSet[] = [
    { id: "rs-fe-1", deploymentId: "deploy-fe", templateHash: feHash, desiredReplicas: 2, revision: 1 },
    { id: "rs-be-1", deploymentId: "deploy-be", templateHash: beHash, desiredReplicas: 2, revision: 1 },
  ];

  const mkPod = (
    id: string,
    name: string,
    namespace: string,
    ownerRef: string,
    deploymentId: string,
    nodeId: string,
    image: string,
    templateHash: string,
    volumes: PodVolumeRef[] = [],
  ): K8sPod => ({
    id,
    name,
    namespace,
    ownerRef,
    deploymentId,
    nodeId,
    phase: "Running",
    restartCount: 0,
    containers: [{ name: deploymentId === "deploy-fe" ? "nginx" : "api", image, ready: true }],
    volumes,
    templateHash,
    createdAt: 0,
    phaseTicks: 0,
    terminationTicks: 0,
    failuresInARow: 0,
    backoffTicks: 0,
    flightProgress: 1,
  });

  const pods: K8sPod[] = [
    mkPod("pod-fe-1", `frontend-${feHash}-abc01`, "default", "rs-fe-1", "deploy-fe", "node-1", "nginx:1.25", feHash),
    mkPod("pod-fe-2", `frontend-${feHash}-abc02`, "default", "rs-fe-1", "deploy-fe", "node-2", "nginx:1.25", feHash),
    mkPod("pod-be-1", `backend-${beHash}-xyz01`, "apps", "rs-be-1", "deploy-be", "node-2", "api:2.1", beHash, [{ name: "data", claimName: "data" }]),
    mkPod("pod-be-2", `backend-${beHash}-xyz02`, "apps", "rs-be-1", "deploy-be", "node-3", "api:2.1", beHash, [{ name: "data", claimName: "data" }]),
  ];

  const services: K8sService[] = [
    {
      id: "svc-fe",
      name: "frontend-svc",
      namespace: "default",
      type: "LoadBalancer",
      selector: { deploymentId: "deploy-fe" },
      endpoints: ["pod-fe-1", "pod-fe-2"],
    },
    {
      id: "svc-be",
      name: "backend-svc",
      namespace: "apps",
      type: "ClusterIP",
      selector: { deploymentId: "deploy-be" },
      endpoints: ["pod-be-1", "pod-be-2"],
    },
  ];

  const ingresses: K8sIngress[] = [
    { id: "ing-web", name: "web", namespace: "default", host: "k8scube.local", serviceName: "frontend-svc" },
  ];

  const pvs: K8sPV[] = [
    { id: "pv-1", name: "pv-fast-10gi", capacityGi: 10, storageClass: "fast", status: "Bound", boundClaim: "pvc-data" },
    { id: "pv-2", name: "pv-bulk-50gi", capacityGi: 50, storageClass: "bulk", status: "Available", boundClaim: null },
    { id: "pv-3", name: "pv-fast-20gi", capacityGi: 20, storageClass: "fast", status: "Available", boundClaim: null },
  ];

  const pvcs: K8sPVC[] = [
    { id: "pvc-data", name: "data", namespace: "apps", capacityGi: 10, storageClass: "fast", status: "Bound", boundVolume: "pv-1" },
  ];

  const configMaps: K8sConfigMap[] = [
    { id: "cm-app", name: "app-config", namespace: "default", data: { LOG_LEVEL: "info", THEME: "tron" } },
    { id: "cm-feat", name: "feature-flags", namespace: "apps", data: { NEW_UI: "true" } },
  ];

  const secrets: K8sSecret[] = [
    { id: "sec-db", name: "db-creds", namespace: "apps", data: { user: "***", pass: "***" } },
  ];

  return { nodes, namespaces, deployments, replicaSets, pods, services, ingresses, pvs, pvcs, configMaps, secrets, events: [] };
}

const SEED = seedCluster();

export const useCluster = create<ClusterState>((set) => ({
  tick: 0,
  paused: false,
  speed: 2,

  nodes: SEED.nodes,
  namespaces: SEED.namespaces,
  deployments: SEED.deployments,
  replicaSets: SEED.replicaSets,
  pods: SEED.pods,
  services: SEED.services,
  ingresses: SEED.ingresses,
  pvs: SEED.pvs,
  pvcs: SEED.pvcs,
  configMaps: SEED.configMaps,
  secrets: SEED.secrets,

  events: [],
  pendingActions: [],

  enqueue: (a) => set((s) => ({ pendingActions: [...s.pendingActions, a] })),
  setPaused: (paused) => set({ paused }),
  setSpeed: (speed) => set({ speed: Math.max(0.25, Math.min(4, speed)) }),
  bumpTick: () => set((s) => ({ tick: s.tick + 1 })),
  resetCluster: (snapshot) => {
    const fresh = seedCluster();
    set({
      tick: 0,
      pendingActions: [],
      ...fresh,
      ...(snapshot ?? {}),
    });
  },
}));

// Convenience selectors used by components
export const selectPodsByDeployment = (deploymentId: string) => (s: ClusterState) =>
  s.pods.filter((p) => p.deploymentId === deploymentId);

export const selectPodsByNode = (nodeId: string) => (s: ClusterState) =>
  s.pods.filter((p) => p.nodeId === nodeId);
