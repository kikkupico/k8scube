import * as THREE from "three";

export interface FlowDef {
  id: string;
  label: string;
  description: string;
  color: string;
  /** World-space waypoints. */
  waypoints: [number, number, number][];
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
      [-3.2, 2.4, 1.6],
      [0, 1.2, 0], // top
      [0, 0, 1.2], // front
      [1.2, 0, 0], // right
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
      [-3.2, 1.0, -0.6],
      [-1.2, 0, 0], // left
      [1.2, 0, 0], // right
    ],
    particleCount: 5,
    speed: 0.18,
  },
];

export function resolveWaypoints(flow: FlowDef): THREE.Vector3[] {
  return flow.waypoints.map((w) => new THREE.Vector3(w[0], w[1], w[2]));
}
