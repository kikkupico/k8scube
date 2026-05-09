import * as THREE from "three";
import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { ControlPlaneFace } from "./faces/ControlPlaneFace";
import { NodesFace } from "./faces/NodesFace";
import { PodsFace } from "./faces/PodsFace";
import { NetworkingFace } from "./faces/NetworkingFace";
import { StorageFace } from "./faces/StorageFace";
import { FoundationsFace } from "./faces/FoundationsFace";

/**
 * Cube root. The cube body is a unit cube (half-extent 1) at origin.
 * Each face is a child group whose local +Z points outward from the cube.
 */
export function Cube() {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)), []);

  return (
    <group>
      <RoundedBox
        args={[1.98, 1.98, 1.98]}
        radius={0.05}
        smoothness={4}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial 
          color="#0f172a" 
          roughness={0.4} 
          metalness={0.8}
          emissive="#0ea5e9"
          emissiveIntensity={0.02}
        />
      </RoundedBox>

      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#0ea5e9" opacity={0.5} transparent />
      </lineSegments>

      <ControlPlaneFace />
...
      <NodesFace />
      <PodsFace />
      <NetworkingFace />
      <StorageFace />
      <FoundationsFace />
    </group>
  );
}
