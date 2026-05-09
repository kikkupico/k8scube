import type { FaceId } from "../state/store";

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

export const faceMeta = (face: FaceId): FaceMeta =>
  FACES.find((f) => f.id === face)!;
