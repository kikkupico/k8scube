import { FaceFrame } from "./FaceFrame";
import { Edges } from "@react-three/drei";
import { conceptsByFace, faceMeta } from "../../content/concepts";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";

export function ControlPlaneFace() {
  const concepts = conceptsByFace("control-plane");
  const meta = faceMeta("control-plane");
  const activeConcept = useApp((s) => s.activeConcept);
  const setActiveConcept = useApp((s) => s.setActiveConcept);

  return (
    <FaceFrame face="control-plane">
      {concepts.map((c, i) => {
        const height = 0.25 + (i % 3) * 0.15;
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
              position={[c.position[0], c.position[1], height / 2]}
              castShadow
            >
              <boxGeometry args={[0.45, 0.35, height]} />
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
