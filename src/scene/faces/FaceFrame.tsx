import { useState, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { Edges, Text } from "@react-three/drei";
import type { FaceId } from "../../state/store";
import { useApp } from "../../state/store";
import { faceMeta } from "../../content/concepts";
import { FACE_TRANSFORM } from "../faceTransform";

interface Props {
  face: FaceId;
  children?: ReactNode;
}

export function FaceFrame({ face, children }: Props) {
  const meta = faceMeta(face);
  const { position, rotation } = FACE_TRANSFORM[face];
  const mode = useApp((s) => s.mode);
  const setActiveFace = useApp((s) => s.setActiveFace);
  const activeFace = useApp((s) => s.activeFace);
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
          color="#ffffff"
          transparent
          opacity={isActive ? 0.9 : hovered ? 0.75 : isDimmed ? 0.05 : 0.55}
          roughness={1.0}
          metalness={0.0}
        />
        <Edges threshold={20} color="#000000" />
      </mesh>

      <group position={[0, 0, 0.01]} visible={!isDimmed || isActive}>
        {children}
      </group>

      {/* face title — 3D text label */}
      <group position={[0, 0.82, 0.05]}>
        <Text
          fontSize={0.14}
          fontWeight={800}
          color="#000000"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.008}
          outlineColor="#ffffff"
          fillOpacity={isDimmed ? 0.3 : 1}
          outlineOpacity={isDimmed ? 0.3 : 1}
        >
          {meta.title.toUpperCase()}
        </Text>
        <Text
          position={[0, -0.12, 0]}
          fontSize={0.055}
          fontWeight={700}
          color="#555555"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor="#ffffff"
          fillOpacity={isDimmed ? 0.2 : 0.8}
        >
          {meta.subtitle.toUpperCase()}
        </Text>
      </group>
    </group>
  );
}
