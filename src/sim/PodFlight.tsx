import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useCluster } from "../state/clusterStore";
import { faceLocalToWorld } from "../scene/faceTransform";
import { computeSliceLayout } from "../scene/sliceLayout";

const TOP_API = new THREE.Vector3(-0.5, 1.05, 0.2);
const TOP_SCHED = new THREE.Vector3(0.4, 1.05, -0.1);

/**
 * Renders one glowing particle per in-flight pod. The pod's PodCapsule on the
 * Pods face is hidden until flightProgress reaches 1.
 */
export function PodFlights() {
  const pods = useCluster((s) => s.pods);
  const nodes = useCluster((s) => s.nodes);
  const deployments = useCluster((s) => s.deployments);

  const workers = useMemo(() => nodes.filter((n) => n.role === "worker"), [nodes]);
  const layout = useMemo(() => computeSliceLayout(workers.length), [workers.length]);

  const inFlight = useMemo(() => pods.filter((p) => p.flightProgress < 1 && p.nodeId), [pods]);

  return (
    <group>
      {inFlight.map((p) => {
        const node = nodes.find((n) => n.id === p.nodeId);
        const dep = deployments.find((d) => d.id === p.deploymentId);
        if (!node) return null;

        const nodeIndex = workers.findIndex((n) => n.id === node.id);
        if (nodeIndex < 0) return null;
        const slab = layout.workers[nodeIndex];
        if (!slab) return null;

        // Land position: on the Nodes face (front), at the slab's Y.
        const landWorld = faceLocalToWorld("nodes", 0, slab.y, 0.45);
        return (
          <PodFlightParticle
            key={p.id}
            color={dep?.color ?? "#06b6d4"}
            from={TOP_API}
            via={TOP_SCHED}
            to={landWorld}
            progress={p.flightProgress}
          />
        );
      })}
    </group>
  );
}

interface ParticleProps {
  color: string;
  from: THREE.Vector3;
  via: THREE.Vector3;
  to: THREE.Vector3;
  progress: number;
}

function PodFlightParticle({ color: _color, from, via, to, progress }: ParticleProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3([from.clone(), via.clone(), to.clone()], false, "catmullrom", 0.5),
    [from, via, to],
  );

  useFrame((state) => {
    const t = THREE.MathUtils.clamp(progress, 0, 0.999);
    const pos = curve.getPointAt(t);
    if (meshRef.current) {
      meshRef.current.position.copy(pos);
      meshRef.current.scale.setScalar(0.6 + Math.sin(state.clock.elapsedTime * 8) * 0.1);
    }
    if (trailRef.current) {
      const trailT = Math.max(0, t - 0.06);
      trailRef.current.position.copy(curve.getPointAt(trailT));
    }
  });

  return (
    <group>
      <mesh ref={trailRef}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshBasicMaterial color="#888888" transparent opacity={0.4} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  );
}
