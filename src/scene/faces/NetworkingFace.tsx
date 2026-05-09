import { FaceFrame } from "./FaceFrame";
import { Edges } from "@react-three/drei";
import { conceptsByFace, faceMeta } from "../../content/concepts";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";

export function NetworkingFace() {
  const concepts = conceptsByFace("networking");
  const meta = faceMeta("networking");
  const activeConcept = useApp((s) => s.activeConcept);
  const setActiveConcept = useApp((s) => s.setActiveConcept);

  return (
    <FaceFrame face="networking">
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
            <mesh
              position={[c.position[0], c.position[1], 0.15]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              {/* short cylinder = a "wire bundle" */}
              <cylinderGeometry args={[0.16, 0.16, 0.3, 24]} />
              <meshStandardMaterial
                color={isActive ? "#ffffff" : meta.color}
                roughness={0.2}
                metalness={0.8}
                emissive={isActive ? "#ffffff" : meta.color}
                emissiveIntensity={isActive ? 1.2 : 0.3}
              />
              <Edges threshold={15} color={isActive ? "#ffffff" : "#000000"} />
            </mesh>
          </Interactable>
        );
      })}
    </FaceFrame>
  );
}
