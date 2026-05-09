import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { faceMeta } from "../../content/concepts";
import { RackServer } from "../props/RackServer";
import { computeSliceLayout } from "../sliceLayout";

const RACK_WIDTH = 1.7;
const UNIT_GAP = 0.018;

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
                fontWeight={700}
                color={isActive ? "#ffffff" : edgeColor}
                anchorX="right"
                anchorY="middle"
                outlineWidth={0.003}
                outlineColor="#000000"
              >
                {node.name.toUpperCase()}
              </Text>
              <Text
                position={[0, -0.06, 0]}
                fontSize={0.034}
                color="#94a3b8"
                anchorX="right"
                anchorY="middle"
              >
                {node.status.toUpperCase()} · {podCount} POD{podCount === 1 ? "" : "S"}
              </Text>
            </group>
          </group>
        );
      })}
    </FaceFrame>
  );
}
