import { Edges, Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { faceMeta } from "../../content/concepts";

export function NetworkingFace() {
  const services = useCluster((s) => s.services);
  const meta = faceMeta("networking");
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);

  return (
    <FaceFrame face="networking">
      {services.map((svc, i) => {
        const x = (i % 2 === 0 ? -0.45 : 0.45);
        const y = (i < 2 ? 0.35 : -0.35);
        const isActive = activeEntityId === svc.id;

        return (
          <group key={svc.id} position={[x, y, 0]}>
            <Interactable
              onClick={(e) => {
                e.stopPropagation();
                setActiveEntity(svc.id);
              }}
            >
              <mesh castShadow position={[0, 0, 0.1]}>
                <boxGeometry args={[0.7, 0.4, 0.2]} />
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
              position={[0, -0.3, 0.2]}
              fontSize={0.06}
              fontWeight={600}
              color={isActive ? "#ffffff" : "#94a3b8"}
              anchorX="center"
              anchorY="middle"
            >
              {svc.name.toUpperCase()}
            </Text>
          </group>
        );
      })}
    </FaceFrame>
  );
}
