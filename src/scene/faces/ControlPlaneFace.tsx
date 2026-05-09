import { useMemo } from "react";
import { Edges, Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { faceMeta } from "../../content/concepts";
import { computeSliceLayout } from "../sliceLayout";

const COMPONENTS = [
  { id: "api", label: "API SERVER" },
  { id: "etcd", label: "ETCD" },
  { id: "sched", label: "SCHEDULER" },
  { id: "ctrl", label: "CTRL-MGR" },
];

/**
 * The control plane lives on the top face AND on the front of the topmost
 * slab. Rendering a wide chassis at the slab's Y means it lines up with the
 * physical control-plane slab when looking from the front.
 */
export function ControlPlaneFace() {
  const nodes = useCluster((s) => s.nodes);
  const cpNodes = useMemo(() => nodes.filter(n => n.role === "control-plane"), [nodes]);
  const meta = faceMeta("control-plane");
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);
  const tick = useCluster((s) => s.tick);
  const workers = useMemo(() => nodes.filter((n) => n.role === "worker"), [nodes]);
  const layout = useMemo(() => computeSliceLayout(workers.length), [workers.length]);

  // Place a small CP "control rail" on the *top* face spanning component LEDs.
  // Most of the rich CP visual lives on the topmost slab when viewed from the
  // front (the wide chassis with chasing LEDs).
  return (
    <FaceFrame face="control-plane">
      <Text position={[0, 0.78, 0.05]} fontSize={0.06} color={meta.color} anchorX="center" outlineWidth={0.002} outlineColor="#000000">
        CONTROL PLANE — TOP SLAB
      </Text>

      {cpNodes.map((node) => {
        const isActive = activeEntityId === node.id;
        const edgeColor = node.status === "Ready" ? meta.color : "#ef4444";
        return (
          <group key={node.id} position={[0, 0, 0]}>
            <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(node.id); }} scaleHover={1.04}>
              <group>
                {/* Control surface: a low pad with LED row on the top face */}
                <mesh castShadow position={[0, 0, 0.13]}>
                  <boxGeometry args={[1.4, 0.36, 0.18]} />
                  <meshStandardMaterial color="#0b1220" roughness={0.35} metalness={0.85} emissive={edgeColor} emissiveIntensity={isActive ? 0.25 : 0.08} />
                  <Edges threshold={20} color={edgeColor} />
                </mesh>
                <mesh position={[0, 0, 0.221]}>
                  <planeGeometry args={[1.32, 0.28]} />
                  <meshStandardMaterial color="#020617" roughness={0.7} metalness={0.2} />
                </mesh>
                {COMPONENTS.map((c, i) => {
                  const x = -0.5 + i * 0.32;
                  const ledOn = ((tick + i) % 4) < 3;
                  return (
                    <group key={c.id} position={[x, 0.04, 0.226]}>
                      <mesh>
                        <sphereGeometry args={[0.018, 10, 10]} />
                        <meshStandardMaterial color={ledOn ? edgeColor : "#1e293b"} emissive={edgeColor} emissiveIntensity={ledOn ? 1.5 : 0.1} />
                      </mesh>
                      <Text position={[0, -0.07, 0]} fontSize={0.034} fontWeight={700} color={edgeColor} anchorX="center" anchorY="middle" outlineWidth={0.002} outlineColor="#000000">
                        {c.label}
                      </Text>
                    </group>
                  );
                })}
              </group>
            </Interactable>

            <Text position={[0, -0.3, 0.3]} fontSize={0.06} fontWeight={700} color={isActive ? "#ffffff" : edgeColor} anchorX="center" anchorY="middle" outlineWidth={0.003} outlineColor="#000000">
              {node.name.toUpperCase()}
            </Text>
          </group>
        );
      })}

      {/* A thin marker ring representing the slab band the CP physically lives in */}
      <mesh position={[0, -0.85, 0.04]}>
        <planeGeometry args={[1.6, 0.012]} />
        <meshStandardMaterial color={meta.color} emissive={meta.color} emissiveIntensity={1.2} transparent opacity={0.7} />
      </mesh>
      <Text position={[0, -0.9, 0.05]} fontSize={0.034} color="#94a3b8" anchorX="center">
        slab y = {layout.controlPlane.y.toFixed(2)}
      </Text>
    </FaceFrame>
  );
}
