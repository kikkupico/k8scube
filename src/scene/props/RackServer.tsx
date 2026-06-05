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
  edgeColor: _edgeColor = "#0ea5e9",
  bodyColor: _bodyColor = "#0b1220",
  active = true,
  fault = false,
  highlight: _highlight = false,
  label,
}: RackServerProps) {
  const activityRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useFrame((state) => {
    if (!activityRef.current) return;
    if (!active) {
      activityRef.current.color.set("#ffffff");
      return;
    }
    const t = state.clock.elapsedTime;
    const lit = Math.sin(t * 12) > 0;
    activityRef.current.color.set(lit ? "#000000" : "#ffffff");
  });

  return (
    <group>
      {/* Chassis body */}
      <RoundedBox args={[width, height, depth]} radius={0.012} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial
          color="#ffffff"
          roughness={1.0}
          metalness={0.0}
        />
        <Edges threshold={20} color="#000000" />
      </RoundedBox>

      {/* Mount ears */}
      {[[-1, 0], [1, 0]].map(([sx], i) => (
        <mesh key={i} position={[sx * (width / 2 - 0.012), 0, depth / 2 - 0.005]}>
          <boxGeometry args={[0.04, height * 0.95, 0.01]} />
          <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0.0} />
          <Edges threshold={20} color="#000000" />
        </mesh>
      ))}

      {/* Front bezel — slightly darker gray inset rect */}
      <mesh position={[0, 0, depth / 2 + 0.001]}>
        <planeGeometry args={[width * 0.86, height * 0.78]} />
        <meshStandardMaterial color="#eeeeee" roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color="#000000" />
      </mesh>

      {/* Drive bay slats */}
      {Array.from({ length: 8 }).map((_, i) => {
        const slatW = (width * 0.7) / 8 - 0.005;
        const x = -width * 0.35 + (i + 0.5) * (width * 0.7) / 8;
        return (
          <mesh key={i} position={[x, 0, depth / 2 + 0.003]}>
            <boxGeometry args={[slatW, height * 0.55, 0.005]} />
            <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0.0} />
            <Edges threshold={20} color="#000000" />
          </mesh>
        );
      })}

      {/* Status LEDs (right side of bezel) */}
      {/* Power (steady black when active, otherwise white) */}
      <mesh position={[width * 0.42, height * 0.22, depth / 2 + 0.004]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#000000" roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color="#000000" />
      </mesh>
      {/* Activity (blinking black/white) */}
      <mesh position={[width * 0.42, height * 0.0, depth / 2 + 0.004]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial ref={activityRef} color="#ffffff" roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color="#000000" />
      </mesh>
      {/* Fault */}
      {fault && (
        <mesh position={[width * 0.42, -height * 0.22, depth / 2 + 0.004]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial color="#000000" roughness={1.0} metalness={0.0} />
          <Edges threshold={20} color="#000000" />
        </mesh>
      )}

      {/* Optional label */}
      {label && (
        <mesh position={[-width * 0.4, 0, depth / 2 + 0.004]}>
          <planeGeometry args={[width * 0.18, height * 0.32]} />
          <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0.0} />
          <Edges threshold={20} color="#000000" />
        </mesh>
      )}
    </group>
  );
}
