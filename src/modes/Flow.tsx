import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { FlowDef } from "./flowDefs";
import { resolveWaypoints } from "./flowDefs";

interface Props {
  flow: FlowDef;
}

export function Flow({ flow }: Props) {
  const points = useMemo(() => resolveWaypoints(flow), [flow]);
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points, !!flow.closed, "catmullrom", 0.5),
    [points, flow.closed],
  );
  const linePoints = useMemo(() => curve.getPoints(96), [curve]);

  const particleCount = flow.particleCount ?? 6;
  const speed = flow.speed ?? 0.15;

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ts = useMemo(
    () => Float32Array.from({ length: particleCount }, (_, i) => i / particleCount),
    [particleCount],
  );

  useFrame((_, dt) => {
    const m = meshRef.current;
    if (!m) return;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < particleCount; i++) {
      ts[i] = (ts[i] + dt * speed) % 1;
      curve.getPointAt(ts[i], tmp);
      dummy.position.copy(tmp);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <Line
        points={linePoints}
        color={flow.color}
        lineWidth={2.2}
        transparent
        opacity={0.65}
        dashed={false}
      />
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, particleCount]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.07, 14, 14]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={flow.color}
          emissiveIntensity={2.5}
          roughness={0.1}
          metalness={1}
        />
      </instancedMesh>
    </group>
  );
}
