import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import type { PodPhase } from "../../state/clusterStore";

export interface PodCapsuleProps {
  color: string;
  phase: PodPhase;
  containers?: number;
  highlight?: boolean;
  /** scale multiplier (used for terminating shrink) */
  scale?: number;
}

const CAP_RADIUS = 0.085;
const CAP_LENGTH = 0.16;

export function PodCapsule({ color, phase, containers = 1, highlight = false, scale = 1 }: PodCapsuleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const targetScale = useRef(new THREE.Vector3(scale, scale, scale));

  useFrame((state) => {
    const g = groupRef.current;
    const m = matRef.current;
    if (!g || !m) return;
    const t = state.clock.elapsedTime;

    // scale lerp
    targetScale.current.set(scale, scale, scale);
    g.scale.lerp(targetScale.current, 0.18);

    // phase-driven visual state
    switch (phase) {
      case "Pending":
        m.emissiveIntensity = 0.15 + (Math.sin(t * 2.5) + 1) * 0.1;
        m.color.set("#475569");
        break;
      case "ContainerCreating":
        m.emissiveIntensity = 0.4 + (Math.sin(t * 6) + 1) * 0.25;
        m.color.set(color);
        g.rotation.y = t * 1.2;
        break;
      case "Running":
        m.emissiveIntensity = highlight ? 0.9 : 0.55;
        m.color.set(color);
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0, 0.1);
        break;
      case "Failed":
        m.emissiveIntensity = 0.5;
        m.color.set(Math.random() < 0.2 ? "#ef4444" : color);
        break;
      case "CrashLoopBackOff":
        m.emissiveIntensity = 0.25 + (Math.sin(t * 1.4) + 1) * 0.1;
        m.color.set("#ef4444");
        break;
      case "Terminating":
        m.emissiveIntensity = 0.2;
        m.color.set("#1e293b");
        break;
      default:
        m.emissiveIntensity = 0.3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Body — capsule */}
      <mesh castShadow>
        <capsuleGeometry args={[CAP_RADIUS, CAP_LENGTH, 6, 12]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          roughness={0.25}
          metalness={0.7}
        />
        <Edges threshold={28} color={highlight ? "#ffffff" : color} />
      </mesh>

      {/* Container rings */}
      {Array.from({ length: containers }).map((_, i) => {
        const y = ((i + 1) / (containers + 1) - 0.5) * CAP_LENGTH;
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[CAP_RADIUS * 1.04, 0.008, 6, 24]} />
            <meshStandardMaterial color="#020617" emissive={color} emissiveIntensity={0.6} roughness={0.4} metalness={0.4} />
          </mesh>
        );
      })}

      {/* Top loop (handle) */}
      <mesh position={[0, CAP_LENGTH / 2 + CAP_RADIUS + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.025, 0.005, 6, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}
