import { useMemo } from "react";
import { Edges, Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { faceMeta } from "../../content/concepts";

export function ControlPlaneFace() {
  const nodes = useCluster((s) => s.nodes);
  const cpNodes = useMemo(() => nodes.filter(n => n.role === "control-plane"), [nodes]);
  const meta = faceMeta("control-plane");
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);

  return (
    <FaceFrame face="control-plane">
      {cpNodes.map((node, i) => {
        const isActive = activeEntityId === node.id;
        const x = cpNodes.length > 1 ? (i % 2 === 0 ? -0.4 : 0.4) : 0;
        const y = cpNodes.length > 2 ? (i < 2 ? 0.3 : -0.3) : 0;
        
        return (
          <group key={node.id} position={[x, y, 0]}>
            <Interactable
              onClick={(e) => {
                e.stopPropagation();
                setActiveEntity(node.id);
              }}
            >
              <mesh castShadow position={[0, 0, 0.15]}>
                <boxGeometry args={[1.1, 0.7, 0.3]} />
                <meshStandardMaterial
                  color={isActive ? "#ffffff" : meta.color}
                  roughness={0.2}
                  metalness={0.8}
                  emissive={isActive ? "#ffffff" : meta.color}
                  emissiveIntensity={isActive ? 1.2 : 0.4}
                />
                <Edges threshold={15} color={isActive ? "#ffffff" : "#000000"} />
              </mesh>
            </Interactable>
            
            <Text
              position={[0, -0.45, 0.3]}
              fontSize={0.08}
              fontWeight={700}
              color={isActive ? "#ffffff" : "#94a3b8"}
              anchorX="center"
              anchorY="middle"
            >
              {node.name.toUpperCase()}
            </Text>
          </group>
        );
      })}
    </FaceFrame>
  );
}
