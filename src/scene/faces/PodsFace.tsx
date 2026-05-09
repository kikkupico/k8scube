import { FaceFrame } from "./FaceFrame";
import { Edges } from "@react-three/drei";
import { conceptsByFace, faceMeta } from "../../content/concepts";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";

export function PodsFace() {
  const concepts = conceptsByFace("pods");
  const meta = faceMeta("pods");
  const activeConcept = useApp((s) => s.activeConcept);
  const setActiveConcept = useApp((s) => s.setActiveConcept);

  return (
    <FaceFrame face="pods">
      {concepts.map((c) => {
        const isActive = activeConcept === c.id;
        return (
          <Interactable
            key={c.id}
            onClick={(e) => {
              e.stopPropagation();
              setActiveConcept(c.id);
            }}
          >
            <group position={[c.position[0], c.position[1], 0]}>
              {/* a cluster of three small cubes representing pods */}
              {[
                [0, 0, 0.12],
                [0.18, 0.05, 0.12],
                [-0.05, 0.16, 0.12],
              ].map((pos, i) => (
                <mesh
                  key={i}
                  position={pos as [number, number, number]}
                  castShadow
                >
                  <boxGeometry args={[0.16, 0.16, 0.16]} />
                  <meshStandardMaterial
                    color={isActive ? "#ffffff" : meta.color}
                    roughness={0.2}
                    metalness={0.8}
                    emissive={isActive ? "#ffffff" : meta.color}
                    emissiveIntensity={isActive ? 1.2 : 0.3}
                  />
                  <Edges threshold={15} color={isActive ? "#ffffff" : "#000000"} />
                </mesh>
              ))}
            </group>
          </Interactable>
        );
      })}
    </FaceFrame>
  );
}
