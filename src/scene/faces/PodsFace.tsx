import { Edges, Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";

export function PodsFace() {
  const pods = useCluster((s) => s.pods);
  const deployments = useCluster((s) => s.deployments);
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);

  return (
    <FaceFrame face="pods">
      {pods.map((pod, i) => {
        const deploy = deployments.find(d => d.id === pod.deploymentId);
        const color = deploy?.color || "#10b981";
        const x = (i % 2 === 0 ? -0.45 : 0.45);
        const y = 0.5 - Math.floor(i / 2) * 0.5;
        const isActive = activeEntityId === pod.id;
        
        return (
          <group key={pod.id} position={[x, y, 0]}>
            <Interactable
              onClick={(e) => {
                e.stopPropagation();
                setActiveEntity(pod.id);
              }}
            >
              <mesh castShadow position={[0, 0, 0.1]}>
                <boxGeometry args={[0.6, 0.4, 0.2]} />
                <meshStandardMaterial
                  color={isActive ? "#ffffff" : color}
                  roughness={0.2}
                  metalness={0.8}
                  emissive={isActive ? "#ffffff" : color}
                  emissiveIntensity={isActive ? 1.2 : 0.4}
                />
                <Edges threshold={15} color={isActive ? "#ffffff" : "#000000"} />
              </mesh>
            </Interactable>
            
            <Text
              position={[0, -0.3, 0.2]}
              fontSize={0.06}
              fontWeight={600}
              color={isActive ? "#ffffff" : "#94a3b8"}
              anchorX="center"
              anchorY="middle"
            >
              {pod.name.toUpperCase()}
            </Text>
          </group>
        );
      })}
    </FaceFrame>
  );
}
