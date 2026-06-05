import { useMemo } from "react";
import { Edges, Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { computeSliceLayout } from "../sliceLayout";

const COMPONENTS = [
  { id: "api", label: "API SERVER" },
  { id: "etcd", label: "ETCD" },
  { id: "sched", label: "SCHEDULER" },
  { id: "ctrl", label: "CTRL-MGR" },
];

/**
 * Bottom face — the control plane substrate.
 *
 * Top half: control-plane components (api-server, etcd, scheduler, ctrl-mgr)
 * Bottom half: namespace tiles — the api-server is what owns namespaces, so
 *              this is conceptually the right home for them.
 */
export function ControlPlaneFace() {
  const nodes = useCluster((s) => s.nodes);
  const namespaces = useCluster((s) => s.namespaces);
  const pods = useCluster((s) => s.pods);
  const deployments = useCluster((s) => s.deployments);
  const cpNodes = useMemo(() => nodes.filter(n => n.role === "control-plane"), [nodes]);
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);
  const tick = useCluster((s) => s.tick);
  const workers = useMemo(() => nodes.filter((n) => n.role === "worker"), [nodes]);
  const layout = useMemo(() => computeSliceLayout(workers.length), [workers.length]);

  const nsSlots = useMemo(() => layoutPositions(namespaces.length, 0.42), [namespaces.length]);

  return (
    <FaceFrame face="control-plane">
      <Text position={[0, 0.85, 0.05]} fontSize={0.05} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.004} outlineColor="#ffffff">
        CONTROL PLANE — BOTTOM SLAB
      </Text>

      {/* CP nodes & components */}
      <group position={[0, 0.35, 0]}>
        {cpNodes.map((node) => {
          const isActive = activeEntityId === node.id;
          const panelColor = isActive ? "#000000" : "#ffffff";
          const panelEdge = isActive ? "#ffffff" : "#000000";
          return (
            <group key={node.id}>
              <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(node.id); }} scaleHover={1.04}>
                <group>
                  <mesh castShadow position={[0, 0, 0.13]}>
                    <boxGeometry args={[1.4, 0.34, 0.18]} />
                    <meshStandardMaterial color={panelColor} roughness={1.0} metalness={0.0} />
                    <Edges threshold={20} color={panelEdge} />
                  </mesh>
                  <mesh position={[0, 0, 0.221]}>
                    <planeGeometry args={[1.32, 0.26]} />
                    <meshStandardMaterial color={isActive ? "#111111" : "#eeeeee"} roughness={1.0} metalness={0.0} />
                    <Edges threshold={20} color={panelEdge} />
                  </mesh>
                  {COMPONENTS.map((c, i) => {
                    const x = -0.5 + i * 0.32;
                    const ledOn = ((tick + i) % 4) < 3;
                    const ledColor = ledOn ? (isActive ? "#ffffff" : "#000000") : (isActive ? "#555555" : "#e5e7eb");
                    return (
                      <group key={c.id} position={[x, 0.04, 0.226]}>
                        <mesh>
                          <sphereGeometry args={[0.018, 10, 10]} />
                          <meshStandardMaterial color={ledColor} roughness={1.0} metalness={0.0} />
                          <Edges threshold={20} color={panelEdge} />
                        </mesh>
                        <Text position={[0, -0.07, 0]} fontSize={0.034} fontWeight={800} color={isActive ? "#ffffff" : "#000000"} anchorX="center" anchorY="middle" outlineWidth={0.003} outlineColor={isActive ? "#000000" : "#ffffff"}>
                          {c.label}
                        </Text>
                      </group>
                    );
                  })}
                </group>
              </Interactable>

              <Text position={[0, -0.28, 0.3]} fontSize={0.05} fontWeight={800} color={isActive ? "#555555" : "#000000"} anchorX="center" anchorY="middle" outlineWidth={0.004} outlineColor="#ffffff">
                {node.name.toUpperCase()}
              </Text>
            </group>
          );
        })}
      </group>

      {/* divider */}
      <mesh position={[0, -0.05, 0.04]}>
        <planeGeometry args={[1.78, 0.012]} />
        <meshStandardMaterial color="#000000" roughness={1.0} metalness={0.0} />
      </mesh>
      <Text position={[0, -0.105, 0.05]} fontSize={0.032} fontWeight={700} color="#000000" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
        ─ NAMESPACES (api-server owned) ─
      </Text>

      {/* Namespace tiles */}
      <group position={[0, -0.4, 0]}>
        {namespaces.map((ns, i) => {
          const x = nsSlots[i];
          const isActive = activeEntityId === ns.id;
          const podCount = pods.filter((p) => p.namespace === ns.name).length;
          const depCount = deployments.filter((d) => d.namespace === ns.name).length;
          return (
            <group key={ns.id} position={[x, 0, 0]}>
              <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(ns.id); }} scaleHover={1.08}>
                <NamespaceTile color={ns.color} highlight={isActive} pods={podCount} deps={depCount} />
              </Interactable>
              <Text position={[0, -0.13, 0.05]} fontSize={0.032} fontWeight={700} color="#000000" anchorX="center" outlineWidth={0.003} outlineColor="#ffffff">
                {ns.name.toUpperCase()}
              </Text>
            </group>
          );
        })}
      </group>

      {/* slab ref */}
      <Text position={[0, -0.92, 0.05]} fontSize={0.028} fontWeight={700} color="#555555" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
        slab y = {layout.controlPlane.y.toFixed(2)} · h = {layout.controlPlane.h.toFixed(2)}
      </Text>
    </FaceFrame>
  );
}

function layoutPositions(n: number, step: number): number[] {
  if (n === 0) return [];
  const total = (n - 1) * step;
  const start = -total / 2;
  return Array.from({ length: n }, (_, i) => start + i * step);
}

function NamespaceTile({ color, highlight, pods, deps }: { color: string; highlight: boolean; pods: number; deps: number }) {
  const tileColor = highlight ? "#000000" : color;
  const textColor = highlight ? "#ffffff" : "#000000";
  const edgeColor = highlight ? "#ffffff" : "#000000";
  return (
    <group>
      <mesh castShadow position={[0, 0, 0.06]} rotation={[0, 0, Math.PI / 6]}>
        <cylinderGeometry args={[0.078, 0.078, 0.035, 6]} />
        <meshStandardMaterial color={tileColor} roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color={edgeColor} />
      </mesh>
      <Text position={[0, 0, 0.085]} fontSize={0.022} color={textColor} anchorX="center" anchorY="middle" outlineWidth={0.002} outlineColor={highlight ? "#000000" : "#ffffff"}>
        {`${pods}P · ${deps}D`}
      </Text>
    </group>
  );
}
