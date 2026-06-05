import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Text } from "@react-three/drei";
import * as THREE from "three";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { faceMeta } from "../../content/concepts";

/**
 * Top face — the cluster's external boundary.
 *
 * Upper half: INGRESS — user/browser → ingress hosts → traffic falls into cluster
 * Lower half: EGRESS — pods reach out → external APIs (Stripe, S3, ...) → particles rise out
 *
 * The same face represents both directions of the boundary, so the metaphor
 * matches reality: this is the cluster's "skin", not just one direction of flow.
 */
export function EdgeFace() {
  const ingresses = useCluster((s) => s.ingresses);
  const services = useCluster((s) => s.services);
  const egressTargets = useCluster((s) => s.egressTargets);
  const meta = faceMeta("edge");
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);

  const ingSlots = useMemo(() => layout(ingresses.length, 0.55), [ingresses.length]);
  const egSlots = useMemo(() => layout(egressTargets.length, 0.55), [egressTargets.length]);

  return (
    <FaceFrame face="edge">
      {/* ------ INGRESS HALF (upper) ------ */}
      <group position={[0, 0.5, 0]}>
        {/* USER */}
        <group position={[-0.7, 0.32, 0.05]}>
          <UserIcon color="#000000" />
          <Text position={[0.18, 0, 0]} fontSize={0.04} fontWeight={800} color="#000000" anchorX="left" outlineWidth={0.003} outlineColor="#ffffff">
            USER · BROWSER
          </Text>
          <Text position={[0.18, -0.05, 0]} fontSize={0.028} fontWeight={700} color="#555555" anchorX="left" outlineWidth={0.002} outlineColor="#ffffff">
            inbound HTTP
          </Text>
        </group>

        {/* INGRESS label */}
        <Text position={[0.7, 0.34, 0.05]} fontSize={0.04} fontWeight={800} color="#000000" anchorX="right" outlineWidth={0.003} outlineColor="#ffffff">
          INGRESS · INBOUND ↓
        </Text>

        {/* falling particles from above */}
        {ingresses.length > 0 && <ParticleStream color="#000000" count={4} from={0.4} to={-0.18} direction="down" />}

        {/* ingress gates */}
        {ingresses.map((ing, i) => {
          const x = ingSlots[i];
          const y = -0.05;
          const isActive = activeEntityId === ing.id;
          const svc = services.find((sv) => sv.name === ing.serviceName && sv.namespace === ing.namespace);
          return (
            <group key={ing.id} position={[x, y, 0]}>
              <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(ing.id); }} scaleHover={1.08}>
                <PortalGate accent={meta.color} highlight={isActive} arrow="down" />
              </Interactable>
              <Text position={[0, -0.12, 0.05]} fontSize={0.04} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.003} outlineColor="#ffffff">
                {ing.host}
              </Text>
              <Text position={[0, -0.16, 0.05]} fontSize={0.028} fontWeight={700} color="#555555" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
                → {ing.serviceName} · {svc ? `${svc.endpoints.length} EP` : "no svc"}
              </Text>
              {/* tether down into the cluster */}
              <Tether from={[0, -0.07, 0.04]} to={[0, -0.22, 0.04]} color="#000000" />
            </group>
          );
        })}

        {ingresses.length === 0 && (
          <Text position={[0, -0.05, 0.05]} fontSize={0.04} fontWeight={800} color="#888888" anchorX="center" outlineWidth={0.003} outlineColor="#ffffff">
            no Ingresses · `kubectl apply -f web`
          </Text>
        )}
      </group>

      {/* ------ DIVIDER ------ */}
      <group position={[0, 0, 0.04]}>
        <mesh>
          <planeGeometry args={[1.78, 0.012]} />
          <meshStandardMaterial color="#000000" roughness={1.0} metalness={0.0} />
        </mesh>
        <Text position={[-0.45, 0.04, 0]} fontSize={0.034} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
          INGRESS ↓
        </Text>
        <Text position={[0, 0.04, 0]} fontSize={0.034} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
          ─ CLUSTER BOUNDARY ─
        </Text>
        <Text position={[0.45, 0.04, 0]} fontSize={0.034} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
          ↑ EGRESS
        </Text>
      </group>

      {/* ------ EGRESS HALF (lower) ------ */}
      <group position={[0, -0.5, 0]}>
        {/* EGRESS label */}
        <Text position={[-0.7, -0.32, 0.05]} fontSize={0.04} fontWeight={800} color="#000000" anchorX="left" outlineWidth={0.003} outlineColor="#ffffff">
          EGRESS · OUTBOUND ↑
        </Text>

        {/* External cloud */}
        <group position={[0.7, -0.32, 0.05]}>
          <CloudIcon color="#000000" />
          <Text position={[0, -0.07, 0]} fontSize={0.034} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
            EXTERNAL APIs
          </Text>
        </group>

        {/* rising particles */}
        {egressTargets.length > 0 && <ParticleStream color="#000000" count={4} from={0.18} to={-0.4} direction="up" />}

        {/* egress portals */}
        {egressTargets.map((eg, i) => {
          const x = egSlots[i];
          const y = 0.05;
          const isActive = activeEntityId === eg.id;
          return (
            <group key={eg.id} position={[x, y, 0]}>
              {/* tether rising out of the cluster */}
              <Tether from={[0, 0.08, 0.04]} to={[0, 0.22, 0.04]} color="#000000" />
              <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(eg.id); }} scaleHover={1.08}>
                <PortalGate accent={meta.color} highlight={isActive} arrow="up" />
              </Interactable>
              <Text position={[0, 0.13, 0.05]} fontSize={0.04} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.003} outlineColor="#ffffff">
                {eg.host}
              </Text>
              <Text position={[0, 0.17, 0.05]} fontSize={0.028} fontWeight={700} color="#555555" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
                {eg.protocol} · used by {eg.usedBy.length || 0}
              </Text>
            </group>
          );
        })}

        {egressTargets.length === 0 && (
          <Text position={[0, 0.05, 0.05]} fontSize={0.04} fontWeight={800} color="#888888" anchorX="center" outlineWidth={0.003} outlineColor="#ffffff">
            no egress targets · `kubectl apply -f payments`
          </Text>
        )}
      </group>
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

function UserIcon({ color: _color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.04, 0]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color="#000000" />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <coneGeometry args={[0.06, 0.06, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color="#000000" />
      </mesh>
    </group>
  );
}

function CloudIcon({ color: _color }: { color: string }) {
  return (
    <group>
      {/* three overlapping spheres approximating a cloud */}
      <mesh position={[-0.05, 0, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color="#000000" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color="#000000" />
      </mesh>
      <mesh position={[0.06, -0.005, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color="#000000" />
      </mesh>
    </group>
  );
}

interface PortalGateProps { accent: string; highlight: boolean; arrow: "down" | "up" }
function PortalGate({ accent: _accent, highlight, arrow }: PortalGateProps) {
  const bodyColor = highlight ? "#000000" : "#ffffff";
  const edgeColor = highlight ? "#ffffff" : "#000000";
  const innerColor = highlight ? "#ffffff" : "#000000";
  
  return (
    <group>
      <mesh castShadow position={[0, 0, 0.06]}>
        <boxGeometry args={[0.42, 0.13, 0.08]} />
        <meshStandardMaterial color={bodyColor} roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color={edgeColor} />
      </mesh>
      {/* gate beam */}
      <mesh position={[0, 0, 0.11]}>
        <planeGeometry args={[0.36, 0.014]} />
        <meshStandardMaterial color={innerColor} roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color={edgeColor} />
      </mesh>
      {/* arrow indicator */}
      <mesh position={[0, arrow === "down" ? -0.04 : 0.04, 0.11]} rotation={[0, 0, arrow === "down" ? Math.PI : 0]}>
        <coneGeometry args={[0.022, 0.04, 3]} />
        <meshStandardMaterial color={innerColor} roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color={edgeColor} />
      </mesh>
      {/* port LEDs */}
      {[-0.14, 0.14].map((x, i) => (
        <mesh key={i} position={[x, 0, 0.11]}>
          <sphereGeometry args={[0.011, 8, 8]} />
          <meshStandardMaterial color={innerColor} roughness={1.0} metalness={0.0} />
          <Edges threshold={20} color={edgeColor} />
        </mesh>
      ))}
    </group>
  );
}

function Tether({ from, to, color: _color }: { from: [number, number, number]; to: [number, number, number]; color: string }) {
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
      <planeGeometry args={[len, 0.01]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.45} />
    </mesh>
  );
}

interface StreamProps { color: string; count: number; from: number; to: number; direction: "down" | "up" }
function ParticleStream({ color: _color, count, from, to, direction }: StreamProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(() => Float32Array.from({ length: count }, (_, i) => i / count), [count]);
  useFrame((state, dt) => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < count; i++) {
      offsets[i] = (offsets[i] + dt * 0.5) % 1;
      const t = offsets[i];
      const x = (i - (count - 1) / 2) * 0.18 + Math.sin(state.clock.elapsedTime + i) * 0.02;
      const y = direction === "down" ? from - t * (from - to) : from + t * (to - from);
      dummy.position.set(x, y, 0.06);
      dummy.scale.setScalar(1 - t * 0.4);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.014, 8, 8]} />
      <meshBasicMaterial color="#000000" />
    </instancedMesh>
  );
}
