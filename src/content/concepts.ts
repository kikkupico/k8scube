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
