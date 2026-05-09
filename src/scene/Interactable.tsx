import { useState, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

interface InteractableProps {
  children: ReactNode;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  scaleHover?: number;
}

export function Interactable({ children, onClick, scaleHover = 1.1 }: InteractableProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!groupRef.current) return;
    const targetScale = hovered ? scaleHover : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);
  });

  return (
    <group
      ref={groupRef}
      onClick={onClick}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      {children}
    </group>
  );
}
