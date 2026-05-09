import type { FaceId } from "../state/store";

export interface Concept {
  id: string;
  face: FaceId;
  title: string;
  short: string;
  long: string;
  /** position in face-local space (XY plane, +Z is outward) */
  position: [number, number, number];
}

export interface FaceMeta {
  id: FaceId;
  title: string;
  subtitle: string;
  color: string;
}

export const FACES: FaceMeta[] = [
  { id: "control-plane", title: "Control Plane",  subtitle: "the brain (top)",         color: "#f59e0b" },
  { id: "nodes",         title: "Nodes",          subtitle: "the workers (front)",     color: "#2563eb" },
  { id: "pods",          title: "Pods & Workloads", subtitle: "the things that run (right)", color: "#10b981" },
  { id: "networking",    title: "Networking",     subtitle: "how things talk (left)",  color: "#8b5cf6" },
  { id: "storage",       title: "Storage & Config", subtitle: "what persists (back)",  color: "#ef4444" },
  { id: "foundations",   title: "Foundations",    subtitle: "boundaries (bottom)",     color: "#64748b" },
];

export const CONCEPTS: Concept[] = [
  // Control Plane (top)
  { id: "api-server", face: "control-plane", title: "kube-apiserver", position: [-0.5, 0.3, 0],
    short: "The front door to the cluster.",
    long: "The API server validates and exposes the Kubernetes API. Every other component, including kubectl, talks to it." },
  { id: "etcd", face: "control-plane", title: "etcd", position: [0.4, 0.3, 0],
    short: "The cluster's source of truth.",
    long: "A consistent, distributed key-value store that holds all cluster state. Lose etcd and you lose the cluster." },
  { id: "scheduler", face: "control-plane", title: "kube-scheduler", position: [-0.4, -0.4, 0],
    short: "Decides where pods run.",
    long: "Watches for new pods with no assigned node and picks one based on resources, affinity rules, and taints." },
  { id: "controller-manager", face: "control-plane", title: "controller-manager", position: [0.4, -0.4, 0],
    short: "Runs the control loops.",
    long: "Bundles core controllers (replicaset, node, endpoint, etc.) that drive actual state toward desired state." },

  // Nodes (front)
  { id: "kubelet", face: "nodes", title: "kubelet", position: [-0.4, 0.3, 0],
    short: "The agent on every node.",
    long: "Receives pod specs from the API server and makes sure the containers described in them are running and healthy." },
  { id: "kube-proxy", face: "nodes", title: "kube-proxy", position: [0.4, 0.3, 0],
    short: "Node-level networking glue.",
    long: "Maintains network rules so Service traffic reaches the right pods, regardless of which node they live on." },
  { id: "container-runtime", face: "nodes", title: "container runtime", position: [0, -0.3, 0],
    short: "Actually runs the containers.",
    long: "containerd, CRI-O, etc. Pulls images and starts/stops containers under the kubelet's direction." },

  // Pods (right)
  { id: "pod", face: "pods", title: "Pod", position: [-0.4, 0.3, 0],
    short: "The smallest deployable unit.",
    long: "One or more containers that share a network namespace and storage. Pods are ephemeral by design." },
  { id: "deployment", face: "pods", title: "Deployment", position: [0.4, 0.3, 0],
    short: "Stateless app manager.",
    long: "Declares a desired number of replicas and rolls out updates with a controlled strategy." },
  { id: "statefulset", face: "pods", title: "StatefulSet", position: [-0.4, -0.4, 0],
    short: "For pods that need identity.",
    long: "Gives each pod a stable name, ordering, and persistent storage. Use for databases, queues, etc." },
  { id: "daemonset", face: "pods", title: "DaemonSet", position: [0.4, -0.4, 0],
    short: "One pod per node.",
    long: "Ensures every node runs a copy of the pod. Used for log collectors, node agents, network plugins." },

  // Networking (left)
  { id: "service", face: "networking", title: "Service", position: [-0.4, 0.3, 0],
    short: "Stable address for a set of pods.",
    long: "ClusterIP, NodePort, or LoadBalancer. Selects pods by label and routes traffic to them." },
  { id: "ingress", face: "networking", title: "Ingress", position: [0.4, 0.3, 0],
    short: "HTTP routing into the cluster.",
    long: "L7 routing rules (host, path) handled by an Ingress controller (nginx, traefik, etc.)." },
  { id: "networkpolicy", face: "networking", title: "NetworkPolicy", position: [0, -0.3, 0],
    short: "Pod-to-pod firewall rules.",
    long: "Whitelists which pods can talk to which. Default-deny is a common security posture." },

  // Storage (back)
  { id: "pv", face: "storage", title: "PersistentVolume", position: [-0.4, 0.3, 0],
    short: "A piece of storage in the cluster.",
    long: "Provisioned by an admin or dynamically by a StorageClass. Independent of any pod's lifecycle." },
  { id: "pvc", face: "storage", title: "PersistentVolumeClaim", position: [0.4, 0.3, 0],
    short: "A request for storage.",
    long: "A pod claims storage via a PVC; Kubernetes binds it to a matching PV." },
  { id: "configmap", face: "storage", title: "ConfigMap", position: [-0.4, -0.4, 0],
    short: "Non-secret config as data.",
    long: "Mount as files or inject as env vars. Decouples configuration from images." },
  { id: "secret", face: "storage", title: "Secret", position: [0.4, -0.4, 0],
    short: "Sensitive config (base64'd).",
    long: "Like ConfigMap but for credentials. Encryption-at-rest in etcd is opt-in but recommended." },

  // Foundations (bottom)
  { id: "namespace", face: "foundations", title: "Namespace", position: [-0.4, 0.2, 0],
    short: "A scope for names.",
    long: "Logical partition of cluster resources. Most names (services, pods) only need to be unique within a namespace." },
  { id: "rbac", face: "foundations", title: "RBAC", position: [0.4, 0.2, 0],
    short: "Who can do what.",
    long: "Roles + RoleBindings (and Cluster equivalents) control access to API resources." },
  { id: "serviceaccount", face: "foundations", title: "ServiceAccount", position: [0, -0.3, 0],
    short: "Identity for in-cluster workloads.",
    long: "Pods run as a ServiceAccount; tokens authenticate them to the API server." },
];

export const conceptsByFace = (face: FaceId) =>
  CONCEPTS.filter((c) => c.face === face);

export const faceMeta = (face: FaceId): FaceMeta =>
  FACES.find((f) => f.id === face)!;
