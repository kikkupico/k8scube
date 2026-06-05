import { useMemo } from "react";
import { Edges, Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster, DEFAULT_REQUESTS, type K8sPod } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { faceMeta } from "../../content/concepts";
import { RackServer } from "../props/RackServer";
import { computeSliceLayout } from "../sliceLayout";

const RACK_WIDTH = 1.7;
const UNIT_GAP = 0.018;
const BAR_W = 0.5;

/** A thin emissive utilisation bar (background + fill that reddens as it saturates). */
function CapacityBar({ label, frac, y }: { label: string; frac: number; y: number }) {
  const f = Math.max(0, Math.min(1, frac));
  return (
    <group position={[RACK_WIDTH / 2 + 0.16, y, 0.06]}>
      <Text fontSize={0.035} fontWeight={700} color="#000000" anchorX="left" anchorY="middle" position={[0, 0.035, 0]} outlineWidth={0.002} outlineColor="#ffffff">
        {label} {Math.round(f * 100)}%
      </Text>
      <mesh position={[BAR_W / 2, 0, 0]}>
        <planeGeometry args={[BAR_W, 0.024]} />
        <meshBasicMaterial color="#ffffff" />
        <Edges threshold={20} color="#000000" />
      </mesh>
      {f > 0 && (
        <mesh position={[(BAR_W * f) / 2, 0, 0.002]}>
          <planeGeometry args={[BAR_W * f, 0.024]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      )}
    </group>
  );
}

function allocFrac(pods: K8sPod[], nodeId: string, capCpu: number, capMem: number) {
  let cpu = 0, mem = 0;
  for (const p of pods) {
    if (p.nodeId !== nodeId || p.phase === "Terminating") continue;
    for (const c of p.containers) { const r = c.requests ?? DEFAULT_REQUESTS; cpu += r.cpu; mem += r.mem; }
  }
  return { cpu: cpu / capCpu, mem: mem / capMem };
}

export function NodesFace() {
  const nodes = useCluster((s) => s.nodes);
  const pods = useCluster((s) => s.pods);
  const meta = faceMeta("nodes");
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);

  const workers = useMemo(() => nodes.filter((n) => n.role === "worker"), [nodes]);
  const layout = useMemo(() => computeSliceLayout(workers.length), [workers.length]);

  return (
    <FaceFrame face="nodes">
      {workers.map((node, i) => {
        const slab = layout.workers[i];
        if (!slab) return null;
        const isActive = activeEntityId === node.id;
        const podCount = pods.filter((p) => p.nodeId === node.id && p.phase !== "Terminating").length;

        // Fit chassis units across the slab band; one unit per pod (min 3, max 6)
        const units = Math.max(3, Math.min(6, podCount + 1));
        const usableW = RACK_WIDTH;
        const unitH = Math.min(slab.h * 0.78 / units - UNIT_GAP, 0.16);
        const totalH = units * unitH + (units - 1) * UNIT_GAP;
        const baseY = slab.y - totalH / 2 + unitH / 2;
        const fault = node.status === "NotReady";
        const cordoned = node.status === "Cordoned";
        const edgeColor = fault ? "#ef4444" : cordoned ? "#f59e0b" : meta.color;

        return (
          <group key={node.id} position={[0, 0, 0]}>
            <Interactable
              onClick={(e) => { e.stopPropagation(); setActiveEntity(node.id); }}
              scaleHover={1.02}
            >
              <group>
                {Array.from({ length: units }).map((_, u) => {
                  const y = baseY + u * (unitH + UNIT_GAP);
                  const hasPod = u < podCount;
                  return (
                    <group key={u} position={[0, y, 0.06]}>
                      <RackServer
                        width={usableW}
                        height={unitH}
                        depth={0.22}
                        edgeColor={edgeColor}
                        active={hasPod}
                        fault={fault}
                        highlight={isActive}
                      />
                    </group>
                  );
                })}
              </group>
            </Interactable>

            {/* Slab label on the left edge */}
            <group position={[-RACK_WIDTH / 2 - 0.08, slab.y, 0.05]}>
              <Text
                fontSize={0.05}
                fontWeight={800}
                color="#000000"
                anchorX="right"
                anchorY="middle"
                outlineWidth={0.004}
                outlineColor="#ffffff"
              >
                {node.name.toUpperCase()}
              </Text>
              <Text
                position={[0, -0.06, 0]}
                fontSize={0.034}
                fontWeight={700}
                color="#555555"
                anchorX="right"
                anchorY="middle"
                outlineWidth={0.002}
                outlineColor="#ffffff"
              >
                {node.status.toUpperCase()} · {podCount} POD{podCount === 1 ? "" : "S"}
              </Text>
            </group>

            {/* CPU / MEM utilisation bars on the right edge */}
            {(() => {
              const frac = allocFrac(pods, node.id, node.capacity.cpu, node.capacity.mem);
              return (
                <>
                  <CapacityBar label="CPU" frac={frac.cpu} y={slab.y + 0.05} />
                  <CapacityBar label="MEM" frac={frac.mem} y={slab.y - 0.05} />
                </>
              );
            })()}
          </group>
        );
      })}
    </FaceFrame>
  );
}
