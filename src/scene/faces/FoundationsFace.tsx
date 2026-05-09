import { useMemo } from "react";
import { Edges, Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { faceMeta } from "../../content/concepts";

export function FoundationsFace() {
  const namespaces = useCluster((s) => s.namespaces);
  const pods = useCluster((s) => s.pods);
  const deployments = useCluster((s) => s.deployments);
  const services = useCluster((s) => s.services);
  const meta = faceMeta("foundations");
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);

  // Pre-aggregate counts per namespace
  const stats = useMemo(() => {
    return namespaces.map((ns) => {
      const nsP = pods.filter((p) => p.namespace === ns.name).length;
      const nsD = deployments.filter((d) => d.namespace === ns.name).length;
      const nsS = services.filter((s) => s.namespace === ns.name).length;
      return { ns, pods: nsP, deps: nsD, svcs: nsS, total: nsP + nsD + nsS };
    });
  }, [namespaces, pods, deployments, services]);

  const positions = useMemo(() => hexGridPositions(stats.length, 0.45), [stats.length]);

  return (
    <FaceFrame face="foundations">
      {/* Title hint */}
      <Text position={[0, 0.78, 0.05]} fontSize={0.05} color={meta.color} anchorX="center" outlineWidth={0.002} outlineColor="#000000">
        NAMESPACES · CLUSTER BOUNDARIES
      </Text>

      {stats.map((entry, i) => {
        const [x, y] = positions[i];
        const isActive = activeEntityId === entry.ns.id;
        return (
          <group key={entry.ns.id} position={[x, y, 0]}>
            <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(entry.ns.id); }} scaleHover={1.06}>
              <NamespaceHex
                color={entry.ns.color}
                size={0.18 + Math.min(0.12, entry.total * 0.012)}
                highlight={isActive}
              />
            </Interactable>
            <Text position={[0, -0.22, 0.05]} fontSize={0.05} color={isActive ? "#ffffff" : entry.ns.color} anchorX="center" outlineWidth={0.002} outlineColor="#000000">
              {entry.ns.name.toUpperCase()}
            </Text>
            <Text position={[0, -0.28, 0.05]} fontSize={0.034} color="#94a3b8" anchorX="center">
              {entry.pods} pods · {entry.deps} deploy · {entry.svcs} svc
            </Text>
            {/* mini SA badge */}
            <ServiceAccountBadge color={entry.ns.color} position={[0.16, 0.16, 0.05]} />
          </group>
        );
      })}

      {/* RBAC label across the bottom */}
      <Text position={[0, -0.82, 0.05]} fontSize={0.04} color="#475569" anchorX="center">
        RBAC · SERVICEACCOUNTS · QUOTAS · NETWORKPOLICIES (visual)
      </Text>
    </FaceFrame>
  );
}

function hexGridPositions(n: number, step: number): [number, number][] {
  // simple hex layout: rows offset by half a step
  const cols = Math.ceil(Math.sqrt(n));
  const positions: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = (c - (cols - 1) / 2) * step + (r % 2 === 1 ? step / 2 : 0);
    const y = -(r - (Math.ceil(n / cols) - 1) / 2) * step * 0.85;
    positions.push([x, y]);
  }
  return positions;
}

function NamespaceHex({ color, size, highlight }: { color: string; size: number; highlight: boolean }) {
  return (
    <group>
      {/* hex base */}
      <mesh castShadow position={[0, 0, 0.05]} rotation={[0, 0, Math.PI / 6]}>
        <cylinderGeometry args={[size, size, 0.05, 6]} />
        <meshStandardMaterial color="#0a1424" roughness={0.4} metalness={0.85} emissive={color} emissiveIntensity={highlight ? 0.6 : 0.25} />
        <Edges threshold={20} color={color} />
      </mesh>
      {/* center "namespace" pillar */}
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[size * 0.45, size * 0.45, 0.05]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
        <Edges threshold={20} color={color} />
      </mesh>
      {/* corner pillars */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i * Math.PI) / 3;
        return (
          <mesh key={i} position={[Math.cos(a) * size * 0.85, Math.sin(a) * size * 0.85, 0.09]}>
            <boxGeometry args={[0.025, 0.025, 0.02]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
          </mesh>
        );
      })}
    </group>
  );
}

function ServiceAccountBadge({ color, position }: { color: string; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <torusGeometry args={[0.022, 0.005, 6, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <circleGeometry args={[0.014, 16]} />
        <meshStandardMaterial color="#020617" emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}
