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
    if (highlight) {
      m.color.set("#000000");
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0, 0.1);
      return;
    }

    switch (phase) {
      case "Pending": {
        const lit = Math.sin(t * 5) > 0;
        m.color.set(lit ? "#ffffff" : "#cccccc");
        break;
      }
      case "ContainerCreating": {
        const lit = Math.sin(t * 12) > 0;
        m.color.set(lit ? "#999999" : "#ffffff");
        g.rotation.y = t * 1.5;
        break;
      }
      case "Running":
        m.color.set(color);
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0, 0.1);
        break;
      case "Failed": {
        const blink = Math.random() < 0.2;
        m.color.set(blink ? "#000000" : "#666666");
        break;
      }
      case "CrashLoopBackOff": {
        const lit = Math.sin(t * 6) > 0;
        m.color.set(lit ? "#333333" : "#999999");
        break;
      }
      case "Succeeded":
        m.color.set("#eeeeee");
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0, 0.1);
        break;
      case "Terminating":
        m.color.set("#555555");
        break;
      default:
        m.color.set(color);
    }
  });

  const edgeColor = highlight ? "#ffffff" : "#000000";
  const bodyColor = highlight ? "#000000" : color;

  return (
    <group ref={groupRef}>
      {/* Body — capsule */}
      <mesh castShadow>
        <capsuleGeometry args={[CAP_RADIUS, CAP_LENGTH, 6, 12]} />
        <meshStandardMaterial
          ref={matRef}
          color={bodyColor}
          roughness={1.0}
          metalness={0.0}
        />
        <Edges threshold={28} color={edgeColor} />
      </mesh>

      {/* Container rings */}
      {Array.from({ length: containers }).map((_, i) => {
        const y = ((i + 1) / (containers + 1) - 0.5) * CAP_LENGTH;
        const ringFill = highlight ? "#ffffff" : "#000000";
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[CAP_RADIUS * 1.04, 0.008, 6, 24]} />
            <meshStandardMaterial color={ringFill} roughness={1.0} metalness={0.0} />
            <Edges threshold={28} color={edgeColor} />
          </mesh>
        );
      })}

      {/* Top loop (handle) */}
      <mesh position={[0, CAP_LENGTH / 2 + CAP_RADIUS + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.025, 0.005, 6, 16]} />
        <meshStandardMaterial color={bodyColor} roughness={1.0} metalness={0.0} />
        <Edges threshold={28} color={edgeColor} />
      </mesh>
    </group>
  );
}
