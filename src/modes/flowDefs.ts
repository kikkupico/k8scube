import * as THREE from "three";
import { conceptWorldPos } from "../scene/faceTransform";

export interface FlowDef {
  id: string;
  label: string;
  description: string;
  color: string;
  /** World-space waypoints. Strings resolve to concept anchors. */
  waypoints: (string | [number, number, number])[];
  /** Particles per second along the curve. */
  speed?: number;
  /** Number of in-flight particles. */
  particleCount?: number;
  /** Should the path close back on itself? */
  closed?: boolean;
}

export const FLOWS: FlowDef[] = [
  {
    id: "deploy",
    label: "Deployment lifecycle",
    description: "kubectl apply → api-server → etcd → scheduler → kubelet → pod",
    color: "#f59e0b",
    waypoints: [
      [-3.2, 2.4, 1.6],          // kubectl, off-cube
      "api-server",
      "etcd",
      "scheduler",
      "kubelet",
      "pod",
    ],
    particleCount: 6,
    speed: 0.12,
  },
  {
    id: "request",
    label: "External request",
    description: "client → ingress → service → pod",
    color: "#8b5cf6",
    waypoints: [
      [-3.2, 1.0, -0.6],          // external client, off-cube
      "ingress",
      "service",
      "pod",
    ],
    particleCount: 5,
    speed: 0.18,
  },
  {
    id: "control-loop",
    label: "Control loop",
    description: "controller-manager ↔ api-server ↔ etcd (continuous reconciliation)",
    color: "#10b981",
    waypoints: [
      "controller-manager",
      "api-server",
      "etcd",
      "controller-manager",
    ],
    particleCount: 4,
    speed: 0.1,
    closed: true,
  },
];

export function resolveWaypoints(flow: FlowDef): THREE.Vector3[] {
  return flow.waypoints.map((w) =>
    typeof w === "string" ? conceptWorldPos(w) : new THREE.Vector3(w[0], w[1], w[2]),
  );
}
