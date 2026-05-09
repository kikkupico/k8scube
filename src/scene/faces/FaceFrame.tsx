import { useState, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { FaceId } from "../../state/store";
import { useApp } from "../../state/store";
import { conceptsByFace, faceMeta } from "../../content/concepts";
import { FACE_TRANSFORM } from "../faceTransform";

interface Props {
  face: FaceId;
  children: ReactNode;
}

export function FaceFrame({ face, children }: Props) {
  const meta = faceMeta(face);
  const concepts = conceptsByFace(face);
  const { position, rotation } = FACE_TRANSFORM[face];
  const mode = useApp((s) => s.mode);
  const setActiveFace = useApp((s) => s.setActiveFace);
  const setActiveConcept = useApp((s) => s.setActiveConcept);
  const activeFace = useApp((s) => s.activeFace);
  const activeConcept = useApp((s) => s.activeConcept);
  const [hovered, setHovered] = useState(false);

  const isActive = activeFace === face;
  const isDimmed = activeFace !== null && !isActive;
  const interactive = mode === "orbit";

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    setActiveFace(face);
  };
  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  };
  const onPointerOut = () => {
    if (!interactive) return;
    setHovered(false);
    document.body.style.cursor = "default";
  };

  return (
    <group position={position} rotation={rotation}>
      <mesh
        position={[0, 0, 0.001]}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <planeGeometry args={[1.96, 1.96]} />
        <meshStandardMaterial
          color={meta.color}
          transparent
          opacity={isActive ? 0.4 : hovered ? 0.25 : isDimmed ? 0.02 : 0.1}
          roughness={0.2}
          metalness={0.5}
          emissive={meta.color}
          emissiveIntensity={isActive ? 0.2 : 0.05}
        />
      </mesh>

      <group position={[0, 0, 0.01]} visible={!isDimmed || isActive}>
        {children}
      </group>

      {/* face title — 3D text label */}
      <group position={[0, 0.82, 0.05]}>
        <Text
          fontSize={0.14}
          fontWeight={800}
          color={meta.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#000000"
          fillOpacity={isDimmed ? 0.3 : 1}
          outlineOpacity={isDimmed ? 0.3 : 1}
        >
          {meta.title.toUpperCase()}
        </Text>
        <Text
          position={[0, -0.12, 0]}
          fontSize={0.055}
          fontWeight={400}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          fillOpacity={isDimmed ? 0.2 : 0.8}
        >
          {meta.subtitle.toUpperCase()}
        </Text>
      </group>

      {/* per-concept labels — 3D text, always visible but prominent when active */}
      {concepts.map((c) => {
        const isConceptActive = activeConcept === c.id;
        const shouldShow = isActive || (!activeFace && !isDimmed);
        
        return (
          <Text
            key={c.id}
            position={[c.position[0], c.position[1], 0.4]}
            fontSize={0.07}
            fontWeight={600}
            color={isConceptActive ? "#ffffff" : meta.color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.008}
            outlineColor={isConceptActive ? meta.color : "#000000"}
            fillOpacity={shouldShow ? (isConceptActive ? 1 : 0.8) : 0}
            outlineOpacity={shouldShow ? (isConceptActive ? 1 : 0.8) : 0}
            onClick={(e) => {
              if (!interactive) return;
              e.stopPropagation();
              setActiveFace(face);
              setActiveConcept(c.id);
            }}
            onPointerOver={(e) => {
              if (!interactive) return;
              e.stopPropagation();
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              if (!interactive) return;
              document.body.style.cursor = "default";
            }}
          >
            {c.title}
          </Text>
        );
      })}
    </group>
  );
}
