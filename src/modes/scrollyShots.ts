import type { FaceId } from "../state/store";

export interface Shot {
  id: string;
  /** Face the shot focuses on (null = wide overview). Used to highlight the legend. */
  face: FaceId | null;
  /** Camera eye position in world space. */
  eye: [number, number, number];
  /** Look-at target. */
  look: [number, number, number];
  title: string;
  body: string;
}

/**
 * Distance from cube center for a head-on face-filling shot.
 * The cube has half-extent 1; at fov=35° this puts the face nicely in frame.
 */
const D = 4.2;

/**
 * Tiny offset used on top/bottom shots so eye and look aren't perfectly
 * collinear with the world up axis (avoids camera up-vector ambiguity).
 */
const E = 0.001;

/**
 * The narrative spine of the scrolly experience — a guided pass through
 * a deployment lifecycle. Every topic shot views its face head-on, matching
 * orbit mode's click behavior.
 */
export const SHOTS: Shot[] = [
  {
    id: "overview",
    face: null,
    eye: [4.5, 3.8, 5.2],
    look: [0, 0, 0],
    title: "Kubernetes, as a cube.",
    body: "A cluster has many moving parts. We're going to look at six facets — the brain on top, the workers in front, and the rest along the way.",
  },
  {
    id: "control-plane",
    face: "control-plane",
    eye: [0, D, E],
    look: [0, 0, 0],
    title: "It starts at the control plane.",
    body: "When you run kubectl, your request lands on the api-server — the front door. It validates the request and writes the new desired state into etcd, the cluster's source of truth.",
  },
  {
    id: "scheduler",
    face: "control-plane",
    // Closer overhead, recentered on the scheduler's position on the top face.
    eye: [-0.4, 3.0, 0.4 + E],
    look: [-0.4, 0, 0.4],
    title: "The scheduler picks a home.",
    body: "A new pod with no node assigned catches the scheduler's attention. It evaluates resources, taints, and affinity rules to choose the right node.",
  },
  {
    id: "nodes",
    face: "nodes",
    eye: [0, 0, D],
    look: [0, 0, 0],
    title: "The kubelet takes over.",
    body: "On each node, kubelet receives pod specs from the api-server and asks the container runtime to pull images and start containers. kube-proxy keeps the network rules in sync.",
  },
  {
    id: "pods",
    face: "pods",
    eye: [D, 0, 0],
    look: [0, 0, 0],
    title: "Pods are what actually run.",
    body: "A Pod is one or more containers sharing a network and storage. Deployments, StatefulSets, and DaemonSets are different ways to ask the cluster to keep pods alive.",
  },
  {
    id: "networking",
    face: "networking",
    eye: [-D, 0, 0],
    look: [0, 0, 0],
    title: "Pods come and go — Services don't.",
    body: "A Service gives a set of pods a stable address, so callers don't care which pod they hit. Ingress brings traffic in from outside the cluster.",
  },
  {
    id: "storage",
    face: "storage",
    eye: [0, 0, -D],
    look: [0, 0, 0],
    title: "When state needs to survive.",
    body: "PersistentVolumes are durable storage; pods claim them via PersistentVolumeClaims. ConfigMap and Secret keep configuration and credentials out of your container images.",
  },
  {
    id: "foundations",
    face: "foundations",
    eye: [0, -D, E],
    look: [0, 0, 0],
    title: "The boundaries that hold it together.",
    body: "Namespaces partition the cluster into scopes. RBAC controls who can do what. ServiceAccounts give each workload an identity to authenticate with.",
  },
  {
    id: "outro",
    face: null,
    eye: [4.5, 3.8, 5.2],
    look: [0, 0, 0],
    title: "Six facets, one cube.",
    body: "That's Kubernetes from a few angles. Switch to Orbit mode to navigate it yourself, or to Explore to watch the control loops in motion.",
  },
];
