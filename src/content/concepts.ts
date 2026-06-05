import type { FaceId } from "../state/store";

export interface FaceMeta {
  id: FaceId;
  title: string;
  subtitle: string;
  color: string;
}

export const FACES: FaceMeta[] = [
  { id: "edge",          title: "Edge / External",   subtitle: "the cluster boundary (top)", color: "#22d3ee" },
  { id: "nodes",         title: "Nodes",             subtitle: "the workers (front)",        color: "#3b82f6" },
  { id: "pods",          title: "Pods & Workloads",  subtitle: "the things that run (right)", color: "#10b981" },
  { id: "networking",    title: "Networking",        subtitle: "how things talk inside (left)", color: "#8b5cf6" },
  { id: "storage",       title: "Storage & Config",  subtitle: "what persists (back)",       color: "#f43f5e" },
  { id: "control-plane", title: "Control Plane",     subtitle: "the brain (bottom)",         color: "#f59e0b" },
];

export const faceMeta = (face: FaceId): FaceMeta =>
  FACES.find((f) => f.id === face)!;

// ---------- Concept explainer layer ----------
// Plain-language teaching content keyed by entity *kind*. Surfaced in the
// ConceptDrawer above the raw fields so newcomers learn what an object is and
// why it exists, and so cryptic fields (templateHash, ownerRef) get decoded.
// Add a concept = add one entry here; no new UI required.

export interface ConceptInfo {
  /** matches the entity kind, e.g. "Pod", "ReplicaSet", "DaemonSet" */
  kind: string;
  title: string;
  /** one-line, newcomer-friendly analogy */
  oneLiner: string;
  /** why this object exists / what problem it solves */
  why: string;
  /** decode raw fields shown in the drawer into plain meaning */
  fields?: Record<string, string>;
  relatedFaces?: FaceId[];
}

export const CONCEPTS: Record<string, ConceptInfo> = {
  Pod: {
    kind: "Pod",
    title: "Pod",
    oneLiner: "The smallest deployable unit — one or more containers that share a network address and run together on a node.",
    why: "You almost never create pods directly. A controller (Deployment, DaemonSet, Job…) creates them for you and replaces them when they die. Pods are cattle, not pets: they have random names and can be deleted at any time.",
    fields: {
      "Owner RS": "the ReplicaSet (or other controller) responsible for keeping this pod alive",
      "Template hash": "a fingerprint of the pod spec (image + config); pods with different hashes belong to different rollout revisions",
      Phase: "Pending → ContainerCreating → Running is the happy path; Failed/CrashLoopBackOff mean the container keeps dying",
      "Restart count": "how many times the kubelet has restarted a crashed container in place",
    },
    relatedFaces: ["pods", "nodes"],
  },
  Node: {
    kind: "Node",
    title: "Node",
    oneLiner: "A worker machine (VM or physical) where pods actually run.",
    why: "The scheduler places pods onto nodes that have enough free CPU/memory. Cordoning or draining a node stops new pods landing and evicts existing ones so they reschedule elsewhere — that's how you do zero-downtime maintenance.",
    fields: {
      Role: "control-plane nodes run the cluster's brain; worker nodes run your workloads",
      Status: "Ready accepts pods; Cordoned refuses new pods; NotReady means the node stopped reporting and its pods get rescheduled",
      Capacity: "total CPU (millicores) and memory (Mi) the node can hand out to pod requests",
    },
    relatedFaces: ["nodes", "control-plane"],
  },
  ReplicaSet: {
    kind: "ReplicaSet",
    title: "ReplicaSet",
    oneLiner: "Keeps a fixed number of identical pods running.",
    why: "A Deployment manages ReplicaSets; each rollout revision gets its own ReplicaSet. During a rolling update the new RS scales up while the old RS scales down. If a pod dies, its RS notices the shortfall and makes a replacement — this is the self-healing loop.",
    relatedFaces: ["pods"],
  },
  Deployment: {
    kind: "Deployment",
    title: "Deployment",
    oneLiner: "Declarative manager for a stateless app — you say 'I want N copies of this image', it makes it true.",
    why: "Deployments add rollouts on top of ReplicaSets: change the image and it rolls pods over gradually (maxSurge/maxUnavailable bound how many extra/missing pods are allowed mid-rollout), and you can roll back to any previous revision.",
    relatedFaces: ["pods"],
  },
  Service: {
    kind: "Service",
    title: "Service",
    oneLiner: "A stable network name + virtual IP that load-balances across a changing set of pods.",
    why: "Pods come and go with random IPs, so you never talk to them directly. A Service selects pods by label and keeps a live endpoint list of the ones that are Ready — readiness probes decide who's in that list. ClusterIP is internal-only, NodePort/LoadBalancer expose it outside.",
    relatedFaces: ["networking"],
  },
  Ingress: {
    kind: "Ingress",
    title: "Ingress",
    oneLiner: "HTTP routing rules that map external hostnames/paths to internal Services.",
    why: "A LoadBalancer per service is expensive; an Ingress lets one entry point route many hostnames to many Services. It needs an ingress controller to actually serve traffic.",
    relatedFaces: ["edge", "networking"],
  },
  PersistentVolume: {
    kind: "PersistentVolume",
    title: "PersistentVolume (PV)",
    oneLiner: "A piece of real storage in the cluster, provisioned by an admin or dynamically.",
    why: "PVs decouple storage from pods. A pod's data survives the pod via a PV; the binding between a request (PVC) and a PV is what makes storage portable across pod restarts.",
    relatedFaces: ["storage"],
  },
  PVC: {
    kind: "PVC",
    title: "PersistentVolumeClaim (PVC)",
    oneLiner: "A pod's request for storage ('I need 10Gi of fast disk').",
    why: "Pods mount PVCs, not PVs directly. The binder matches a Pending PVC to an Available PV of the right class and size. No match → the PVC stays Pending and any pod waiting on it stays Pending too (a classic 'why won't my pod start?' cause).",
    relatedFaces: ["storage"],
  },
  ConfigMap: {
    kind: "ConfigMap",
    title: "ConfigMap",
    oneLiner: "Non-secret configuration (key/value) injected into pods as env vars or files.",
    why: "Keeps config out of the image so the same image runs in dev/staging/prod with different settings.",
    relatedFaces: ["storage"],
  },
  Secret: {
    kind: "Secret",
    title: "Secret",
    oneLiner: "Like a ConfigMap but for sensitive values (tokens, passwords).",
    why: "Stored base64-encoded and handled more carefully than ConfigMaps. Same injection mechanisms (env vars / mounted files).",
    relatedFaces: ["storage"],
  },
  Namespace: {
    kind: "Namespace",
    title: "Namespace",
    oneLiner: "A virtual cluster inside the cluster — a scope for names and a boundary for quotas/RBAC.",
    why: "Lets teams share one cluster without colliding: two teams can each have a 'frontend' deployment in different namespaces. default and kube-system always exist.",
    relatedFaces: ["control-plane"],
  },
  EgressTarget: {
    kind: "EgressTarget",
    title: "Egress target",
    oneLiner: "An external service your pods call out to (e.g. a payments API).",
    why: "Models the cluster's outbound dependencies — useful for reasoning about NetworkPolicy and what breaks if an external provider is down.",
    relatedFaces: ["edge", "networking"],
  },
  // ---- kinds added in later phases ----
  DaemonSet: {
    kind: "DaemonSet",
    title: "DaemonSet",
    oneLiner: "Runs exactly one copy of a pod on every (matching) node.",
    why: "For node-level agents — log shippers, metrics exporters, CNI plugins. Add a node and the DaemonSet immediately places a pod on it; remove a node and that pod goes away. Replica count tracks node count, not a number you pick.",
    relatedFaces: ["pods", "nodes"],
  },
  StatefulSet: {
    kind: "StatefulSet",
    title: "StatefulSet",
    oneLiner: "Like a Deployment but for stateful apps: stable, ordered identities (name-0, name-1…) and a dedicated volume per pod.",
    why: "Databases and clusters need each replica to keep its name and its data across restarts. StatefulSets create pods one ordinal at a time and give each its own PVC, unlike Deployments where pods are interchangeable.",
    relatedFaces: ["pods", "storage"],
  },
  Job: {
    kind: "Job",
    title: "Job",
    oneLiner: "Runs pods until a task completes successfully, then stops.",
    why: "For batch/one-off work (migrations, backups). Unlike a Deployment, a Job's pods are meant to reach Succeeded and NOT be restarted. It tracks completions rather than keeping N pods alive forever.",
    relatedFaces: ["pods"],
  },
  CronJob: {
    kind: "CronJob",
    title: "CronJob",
    oneLiner: "Creates a Job on a repeating schedule.",
    why: "Kubernetes' cron: every interval it spawns a fresh Job (which spawns pods) to do periodic work — nightly backups, report generation.",
    relatedFaces: ["pods", "control-plane"],
  },
  HPA: {
    kind: "HPA",
    title: "HorizontalPodAutoscaler",
    oneLiner: "Automatically scales a Deployment's replica count to hit a target metric (e.g. 50% CPU).",
    why: "Closes the feedback loop: as load rises, utilisation passes the target and the HPA raises desiredReplicas (up to maxReplicas); as load falls it scales back down (to minReplicas). Needs resource requests defined to compute a percentage.",
    relatedFaces: ["pods", "control-plane"],
  },
};

export const conceptFor = (kind: string): ConceptInfo | undefined => CONCEPTS[kind];
