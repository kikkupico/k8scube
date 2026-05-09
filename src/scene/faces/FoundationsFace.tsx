import { FaceFrame } from "./FaceFrame";
import { Edges } from "@react-three/drei";
import { conceptsByFace, faceMeta } from "../../content/concepts";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";

export function FoundationsFace() {
  const concepts = conceptsByFace("foundations");
  const meta = faceMeta("foundations");
  const activeConcept = useApp((s) => s.activeConcept);
  const setActiveConcept = useApp((s) => s.setActiveConcept);

  return (
    <FaceFrame face="foundations">
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
              position={[c.position[0], c.position[1], 0.05]}
              castShadow
            >
              {/* flat tile — foundations are about boundaries, not extrusion */}
              <boxGeometry args={[0.55, 0.45, 0.06]} />
              <meshStandardMaterial
                color={isActive ? "#cbd5e1" : meta.color}
                roughness={0.7}
                flatShading
              />
              <Edges threshold={15} color="#1f2933" />
            </mesh>
          </Interactable>
        );
      })}
    </FaceFrame>
  );
}
