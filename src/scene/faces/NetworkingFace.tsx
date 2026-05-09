import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Text } from "@react-three/drei";
import * as THREE from "three";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { faceMeta } from "../../content/concepts";

const PORT_LIMIT = 6;

export function NetworkingFace() {
  const services = useCluster((s) => s.services);
  const ingresses = useCluster((s) => s.ingresses);
  const deployments = useCluster((s) => s.deployments);
  const meta = faceMeta("networking");
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);

  // top: ingresses (one row)
  const ingressSlots = useMemo(() => layout(ingresses.length, 0.55), [ingresses.length]);
  // middle/bottom: services
  const svcSlots = useMemo(() => layout(services.length, 0.7), [services.length]);

  return (
    <FaceFrame face="networking">
      {/* External cloud icon (top-left) */}
      <group position={[-0.7, 0.78, 0.04]}>
        <mesh>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={meta.color} emissive={meta.color} emissiveIntensity={1.2} />
        </mesh>
        <Text position={[0.18, 0, 0]} fontSize={0.04} color={meta.color} anchorX="left" outlineWidth={0.002} outlineColor="#000000">
          INTERNET
        </Text>
      </group>

      {/* Ingresses */}
      {ingresses.map((ing, i) => {
        const x = ingressSlots[i];
        const y = 0.55;
        const isActive = activeEntityId === ing.id;
        const targetSvc = services.find((sv) => sv.name === ing.serviceName);
        const targetIdx = targetSvc ? services.findIndex((sv) => sv.id === targetSvc.id) : -1;
        const targetX = targetIdx >= 0 ? svcSlots[targetIdx] : null;
        return (
          <group key={ing.id} position={[x, y, 0]}>
            {targetX !== null && <Tether from={[0, -0.08, 0.04]} to={[targetX - x, -0.55 - y + 0.55, 0.04]} color={meta.color} />}
            <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(ing.id); }} scaleHover={1.08}>
              <IngressGateway highlight={isActive} accent={meta.color} />
            </Interactable>
            <Text position={[0, -0.18, 0.05]} fontSize={0.045} color={isActive ? "#ffffff" : meta.color} anchorX="center" outlineWidth={0.002} outlineColor="#000000">
              ING · {ing.host}
            </Text>
            <Text position={[0, -0.23, 0.05]} fontSize={0.034} color="#94a3b8" anchorX="center">
              → {ing.serviceName}
            </Text>
          </group>
        );
      })}

      {/* Services as patch panels */}
      {services.map((sv, i) => {
        const x = svcSlots[i];
        const y = -0.3;
        const isActive = activeEntityId === sv.id;
        const dep = deployments.find((d) => d.id === sv.selector.deploymentId);
        const color = dep?.color ?? meta.color;
        return (
          <group key={sv.id} position={[x, y, 0]}>
            <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(sv.id); }} scaleHover={1.06}>
              <PatchPanel
                color={color}
                accent={meta.color}
                portsLit={Math.min(PORT_LIMIT, sv.endpoints.length)}
                portTotal={PORT_LIMIT}
                serviceType={sv.type}
                highlight={isActive}
              />
            </Interactable>
            <Text position={[0, -0.21, 0.05]} fontSize={0.05} color={isActive ? "#ffffff" : color} anchorX="center" outlineWidth={0.002} outlineColor="#000000">
              {sv.name.toUpperCase()}
            </Text>
            <Text position={[0, -0.27, 0.05]} fontSize={0.038} color="#94a3b8" anchorX="center">
              {sv.type} · {sv.endpoints.length} EP · ns:{sv.namespace}
            </Text>
            {/* live request micro-flow when service has endpoints */}
            {sv.endpoints.length > 0 && <RequestPulse color={color} />}
          </group>
        );
      })}

      {services.length === 0 && (
        <Text position={[0, 0, 0.05]} fontSize={0.06} color="#475569" anchorX="center">
          no services · try `kubectl expose deployment frontend --type=ClusterIP`
        </Text>
      )}
    </FaceFrame>
  );
}

function layout(n: number, step: number): number[] {
  if (n === 0) return [];
  const total = (n - 1) * step;
  const start = -total / 2;
  return Array.from({ length: n }, (_, i) => start + i * step);
}

// ---------- Sub-props ----------

function IngressGateway({ highlight, accent }: { highlight: boolean; accent: string }) {
  return (
    <group>
      <mesh castShadow position={[0, 0, 0.08]}>
        <boxGeometry args={[0.4, 0.16, 0.08]} />
        <meshStandardMaterial color="#0a1424" roughness={0.4} metalness={0.8} emissive={accent} emissiveIntensity={highlight ? 0.5 : 0.2} />
        <Edges threshold={20} color={accent} />
      </mesh>
      {/* triangular "antenna" */}
      <mesh position={[0, 0.13, 0.12]}>
        <coneGeometry args={[0.04, 0.08, 4]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} />
      </mesh>
      {/* Two outgoing port LEDs */}
      {[-0.12, 0.12].map((x, i) => (
        <mesh key={i} position={[x, -0.04, 0.13]}>
          <sphereGeometry args={[0.013, 8, 8]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
        </mesh>
      ))}
    </group>
  );
}

function PatchPanel({ color, accent, portsLit, portTotal, serviceType, highlight }: {
  color: string; accent: string; portsLit: number; portTotal: number; serviceType: "ClusterIP" | "NodePort" | "LoadBalancer"; highlight: boolean;
}) {
  // typeBar color hints external exposure
  const typeBarColor = serviceType === "LoadBalancer" ? "#10b981" : serviceType === "NodePort" ? "#f59e0b" : "#475569";
  return (
    <group>
      {/* Chassis */}
      <mesh castShadow position={[0, 0, 0.08]}>
        <boxGeometry args={[0.62, 0.32, 0.1]} />
        <meshStandardMaterial color="#0a1424" roughness={0.35} metalness={0.85} emissive={color} emissiveIntensity={highlight ? 0.45 : 0.18} />
        <Edges threshold={20} color={color} />
      </mesh>
      {/* Bezel inset */}
      <mesh position={[0, 0, 0.131]}>
        <planeGeometry args={[0.56, 0.26]} />
        <meshStandardMaterial color="#020617" roughness={0.7} />
      </mesh>
      {/* Type bar — top strip indicating ClusterIP/NodePort/LoadBalancer */}
      <mesh position={[0, 0.105, 0.132]}>
        <planeGeometry args={[0.5, 0.018]} />
        <meshStandardMaterial color={typeBarColor} emissive={typeBarColor} emissiveIntensity={1.1} />
      </mesh>
      {/* Port row */}
      {Array.from({ length: portTotal }).map((_, i) => {
        const x = -0.22 + i * (0.44 / (portTotal - 1));
        const lit = i < portsLit;
        return (
          <group key={i} position={[x, -0.01, 0.133]}>
            {/* port jack */}
            <mesh>
              <boxGeometry args={[0.05, 0.06, 0.008]} />
              <meshStandardMaterial color="#020617" roughness={0.6} metalness={0.7} emissive={lit ? color : "#1e293b"} emissiveIntensity={lit ? 0.5 : 0.15} />
            </mesh>
            {/* port LED below */}
            <mesh position={[0, -0.06, 0.005]}>
              <sphereGeometry args={[0.01, 8, 8]} />
              <meshStandardMaterial color={lit ? color : "#1e293b"} emissive={lit ? color : "#1e293b"} emissiveIntensity={lit ? 1.5 : 0.1} />
            </mesh>
          </group>
        );
      })}
      {/* Brand strip (left) */}
      <mesh position={[-0.27, 0.0, 0.133]}>
        <planeGeometry args={[0.04, 0.18]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function RequestPulse({ color }: { color: string }) {
  // Two small spheres travelling left→right beneath the patch panel ports
  const aRef = useRef<THREE.Mesh>(null);
  const bRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = (state.clock.elapsedTime * 0.6) % 1;
    const t2 = (t + 0.5) % 1;
    if (aRef.current) aRef.current.position.set(-0.28 + t * 0.56, -0.13, 0.14);
    if (bRef.current) bRef.current.position.set(-0.28 + t2 * 0.56, -0.13, 0.14);
  });
  return (
    <group>
      <mesh ref={aRef}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={2.2} />
      </mesh>
      <mesh ref={bRef}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={2.2} />
      </mesh>
    </group>
  );
}

function Tether({ from, to, color }: { from: [number, number, number]; to: [number, number, number]; color: string }) {
  const a = from;
  const b = to;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  return (
    <mesh position={[mx, my, a[2]]} rotation={[0, 0, angle]}>
      <planeGeometry args={[len, 0.012]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} transparent opacity={0.7} />
    </mesh>
  );
}
