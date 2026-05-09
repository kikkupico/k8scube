import { useMemo } from "react";
import { Edges, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { ControlPlaneFace } from "./faces/ControlPlaneFace";
import { NodesFace } from "./faces/NodesFace";
import { PodsFace } from "./faces/PodsFace";
import { NetworkingFace } from "./faces/NetworkingFace";
import { StorageFace } from "./faces/StorageFace";
import { EdgeFace } from "./faces/EdgeFace";
import { useCluster } from "../state/clusterStore";
import { computeSliceLayout, SLAB_DEPTH, SLAB_WIDTH } from "./sliceLayout";

/**
 * Cube root. The cube body is a vertical stack of slabs:
 *   - top: egress / user-app entry
 *   - middle: one slab per worker node (driven by current cluster state)
 *   - bottom: control plane (the brain)
 *
 * Each Y band is shared between Nodes face (front) and Pods face (right),
 * so a pod scheduled on worker-K appears in slab K on both faces.
 */
export function Cube() {
  const nodes = useCluster((s) => s.nodes);
  const workers = useMemo(() => nodes.filter((n) => n.role === "worker"), [nodes]);
  const layout = useMemo(() => computeSliceLayout(workers.length), [workers.length]);

  return (
    <group>
      {/* Edge slab (top) — cluster boundary */}
      <Slab y={layout.edge.y} h={layout.edge.h} accent="#22d3ee" emissive={0.18} />

      {/* Worker slabs */}
      {layout.workers.map((rect, i) => {
        const node = workers[i];
        const status = node?.status ?? "Ready";
        const accent = status === "NotReady" ? "#ef4444" : status === "Cordoned" ? "#f59e0b" : "#3b82f6";
        return (
          <Slab key={node?.id ?? `slab-${i}`} y={rect.y} h={rect.h} accent={accent} emissive={status === "Ready" ? 0.1 : 0.18} />
        );
      })}

      {/* Control-plane slab (bottom) */}
      <Slab y={layout.controlPlane.y} h={layout.controlPlane.h} accent="#f59e0b" emissive={0.18} />

      {/* Corner rack rails — vertical pillars connecting all slabs */}
      <RackRails layout={layout} />

      {/* Faces */}
      <EdgeFace />
      <NodesFace />
      <PodsFace />
      <NetworkingFace />
      <StorageFace />
      <ControlPlaneFace />
    </group>
  );
}

interface SlabProps {
  y: number;
  h: number;
  accent: string;
  emissive: number;
}

function Slab({ y, h, accent, emissive }: SlabProps) {
  return (
    <group position={[0, y, 0]}>
      <RoundedBox args={[SLAB_WIDTH, h, SLAB_DEPTH]} radius={0.025} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial
          color="#0a1224"
          roughness={0.45}
          metalness={0.85}
          emissive={accent}
          emissiveIntensity={emissive}
        />
        <Edges threshold={20} color={accent} />
      </RoundedBox>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[SLAB_WIDTH * 0.998, h * 0.999, SLAB_DEPTH * 0.998]} />
        <meshBasicMaterial color={accent} transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

function RackRails({ layout }: { layout: ReturnType<typeof computeSliceLayout> }) {
  const top = layout.edge.y + layout.edge.h / 2;
  const bottom = layout.controlPlane.y - layout.controlPlane.h / 2;
  const railH = top - bottom;
  const cy = (top + bottom) / 2;
  const halfW = SLAB_WIDTH / 2 + 0.005;
  const halfD = SLAB_DEPTH / 2 + 0.005;
  const railColor = "#0ea5e9";

  const corners: [number, number][] = [
    [-halfW, -halfD],
    [+halfW, -halfD],
    [-halfW, +halfD],
    [+halfW, +halfD],
  ];

  const railGeo = useMemo(() => new THREE.BoxGeometry(0.025, railH, 0.025), [railH]);

  return (
    <group position={[0, cy, 0]}>
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]} geometry={railGeo}>
          <meshStandardMaterial color="#0f172a" emissive={railColor} emissiveIntensity={0.35} />
        </mesh>
      ))}
    </group>
  );
}
