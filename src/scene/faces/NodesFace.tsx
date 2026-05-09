import { FaceFrame } from "./FaceFrame";
import { Edges } from "@react-three/drei";
import { conceptsByFace, faceMeta } from "../../content/concepts";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";

export function NodesFace() {
  const concepts = conceptsByFace("nodes");
  const meta = faceMeta("nodes");
  const activeConcept = useApp((s) => s.activeConcept);
  const setActiveConcept = useApp((s) => s.setActiveConcept);

  return (
    <FaceFrame face="nodes">
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
              {/* node "rack" — a slab with a few horizontal stripes */}
              <mesh position={[0, 0, 0.1]} castShadow>
                <boxGeometry args={[0.55, 0.5, 0.2]} />
                <meshStandardMaterial
                  color={isActive ? "#ffffff" : meta.color}
                  roughness={0.2}
                  metalness={0.8}
                  emissive={isActive ? "#ffffff" : meta.color}
                  emissiveIntensity={isActive ? 1.2 : 0.3}
                />
                <Edges threshold={15} color={isActive ? "#ffffff" : "#000000"} />
              </mesh>
              {[0.12, 0, -0.12].map((y, i) => (
                <mesh key={i} position={[0, y, 0.21]}>
                  <boxGeometry args={[0.5, 0.06, 0.02]} />
                  <meshStandardMaterial color="#1e3a8a" />
                </mesh>
              ))}
            </group>
          </Interactable>
        );
      })}
    </FaceFrame>
  );
}
