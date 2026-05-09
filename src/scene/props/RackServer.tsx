import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export interface RackServerProps {
  width?: number;
  height?: number;
  depth?: number;
  edgeColor?: string;
  /** primary chassis tint */
  bodyColor?: string;
  /** activity LED on/off (driven by hot pod count) */
  active?: boolean;
  /** when true a red fault LED stays lit */
  fault?: boolean;
  /** when true the chassis edges glow brighter */
  highlight?: boolean;
  /** label text on the right side of the bezel */
  label?: string;
}

/**
 * 19-inch-style rack chassis. Renders a thin chassis with a vented bezel and
 * a strip of status LEDs (power / activity / fault).
 */
export function RackServer({
  width = 0.95,
  height = 0.18,
  depth = 0.32,
  edgeColor = "#0ea5e9",
  bodyColor = "#0b1220",
  active = true,
  fault = false,
  highlight = false,
  label,
}: RackServerProps) {
  const activityRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useFrame((state) => {
    if (!activityRef.current) return;
    if (!active) {
      activityRef.current.emissiveIntensity = 0.05;
      return;
    }
    // pulse: faster when "hot"
    const t = state.clock.elapsedTime;
    activityRef.current.emissiveIntensity = 0.4 + Math.sin(t * 5) * 0.4 + 0.4;
  });

  return (
    <group>
      {/* Chassis body */}
      <RoundedBox args={[width, height, depth]} radius={0.012} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.35}
          metalness={0.85}
          emissive={edgeColor}
          emissiveIntensity={highlight ? 0.18 : 0.05}
        />
        <Edges threshold={20} color={edgeColor} />
      </RoundedBox>

      {/* Mount ears */}
      {[[-1, 0], [1, 0]].map(([sx], i) => (
        <mesh key={i} position={[sx * (width / 2 - 0.012), 0, depth / 2 - 0.005]}>
          <boxGeometry args={[0.04, height * 0.95, 0.01]} />
          <meshStandardMaterial color="#1e293b" emissive={edgeColor} emissiveIntensity={0.15} />
        </mesh>
      ))}

      {/* Front bezel — darker inset rect */}
      <mesh position={[0, 0, depth / 2 + 0.001]}>
        <planeGeometry args={[width * 0.86, height * 0.78]} />
        <meshStandardMaterial color="#020617" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Drive bay slats: thin extruded boxes across the bezel */}
      {Array.from({ length: 8 }).map((_, i) => {
        const slatW = (width * 0.7) / 8 - 0.005;
        const x = -width * 0.35 + (i + 0.5) * (width * 0.7) / 8;
        return (
          <mesh key={i} position={[x, 0, depth / 2 + 0.003]}>
            <boxGeometry args={[slatW, height * 0.55, 0.005]} />
            <meshStandardMaterial color="#0a1424" roughness={0.6} metalness={0.7} emissive={edgeColor} emissiveIntensity={0.06} />
          </mesh>
        );
      })}

      {/* Status LEDs (right side of bezel) */}
      {/* Power (steady green) */}
      <mesh position={[width * 0.42, height * 0.22, depth / 2 + 0.004]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1.5} />
      </mesh>
      {/* Activity (cyan, pulsing) */}
      <mesh position={[width * 0.42, height * 0.0, depth / 2 + 0.004]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial ref={activityRef} color={edgeColor} emissive={edgeColor} emissiveIntensity={0.5} />
      </mesh>
      {/* Fault (only when fault=true) */}
      {fault && (
        <mesh position={[width * 0.42, -height * 0.22, depth / 2 + 0.004]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} />
        </mesh>
      )}

      {/* Optional label engraved on the left of the bezel — kept as transparent decals */}
      {label && (
        <mesh position={[-width * 0.4, 0, depth / 2 + 0.004]}>
          <planeGeometry args={[width * 0.18, height * 0.32]} />
          <meshStandardMaterial color="#1e293b" emissive={edgeColor} emissiveIntensity={0.3} />
        </mesh>
      )}
    </group>
  );
}
