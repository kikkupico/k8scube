import { FaceFrame } from "./FaceFrame";
import { Edges } from "@react-three/drei";
import { conceptsByFace, faceMeta } from "../../content/concepts";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";

export function StorageFace() {
  const concepts = conceptsByFace("storage");
  const meta = faceMeta("storage");
  const activeConcept = useApp((s) => s.activeConcept);
  const setActiveConcept = useApp((s) => s.setActiveConcept);

  return (
    <FaceFrame face="storage">
      {concepts.map((c) => {
        const isActive = activeConcept === c.id;
        // PV/PVC are cylinders (drums); ConfigMap/Secret are flat boxes (cards)
        const isVolume = c.id === "pv" || c.id === "pvc";
        return (
          <Interactable
            key={c.id}
            onClick={(e) => {
              e.stopPropagation();
              setActiveConcept(c.id);
            }}
          >
            <mesh
              position={[c.position[0], c.position[1], isVolume ? 0.18 : 0.08]}
              castShadow
            >
              {isVolume ? (
                <cylinderGeometry args={[0.14, 0.14, 0.36, 24]} />
              ) : (
                <boxGeometry args={[0.42, 0.32, 0.16]} />
              )}
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
