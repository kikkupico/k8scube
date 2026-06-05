import { useMemo } from "react";
import { Edges, Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { faceMeta } from "../../content/concepts";

export function StorageFace() {
  const pvs = useCluster((s) => s.pvs);
  const pvcs = useCluster((s) => s.pvcs);
  const cms = useCluster((s) => s.configMaps);
  const secrets = useCluster((s) => s.secrets);
  const meta = faceMeta("storage");
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);

  // Layout: PVs across the top row, PVCs across the middle row (with bind tethers),
  // ConfigMaps + Secrets across the bottom row.
  const pvSlots = useMemo(() => layout(pvs.length, 0.55), [pvs.length]);
  const pvcSlots = useMemo(() => layout(pvcs.length, 0.5), [pvcs.length]);
  const configSlots = useMemo(() => layout(cms.length + secrets.length, 0.4), [cms.length, secrets.length]);

  return (
    <FaceFrame face="storage">
      {/* PV row (top) */}
      {pvs.map((v, i) => {
        const x = pvSlots[i];
        const y = 0.5;
        const isActive = activeEntityId === v.id;
        return (
          <group key={v.id} position={[x, y, 0]}>
            <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(v.id); }} scaleHover={1.08}>
              <DiskStack capacityGi={v.capacityGi} status={v.status} highlight={isActive} />
            </Interactable>
            <Text position={[0, -0.25, 0.05]} fontSize={0.05} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.004} outlineColor="#ffffff">
              {v.name.toUpperCase()}
            </Text>
            <Text position={[0, -0.32, 0.05]} fontSize={0.038} fontWeight={700} color="#555555" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
              {v.capacityGi}Gi · {v.storageClass}
            </Text>
          </group>
        );
      })}

      {/* PVC row (middle) */}
      {pvcs.map((c, i) => {
        const x = pvcSlots[i];
        const y = -0.05;
        const isActive = activeEntityId === c.id;
        const boundPv = c.boundVolume ? pvs.find((v) => v.id === c.boundVolume) : null;
        const pvIdx = boundPv ? pvs.findIndex((v) => v.id === boundPv.id) : -1;
        const pvX = pvIdx >= 0 ? pvSlots[pvIdx] : null;

        return (
          <group key={c.id} position={[x, y, 0]}>
            {pvX !== null && c.status === "Bound" && (
              <Tether from={[0, 0.18, 0.04]} to={[pvX - x, 0.55 - y, 0.04]} color="#000000" />
            )}
            <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(c.id); }} scaleHover={1.08}>
              <PvcCard status={c.status} highlight={isActive} accent={meta.color} />
            </Interactable>
            <Text position={[0, -0.13, 0.05]} fontSize={0.045} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.004} outlineColor="#ffffff">
              PVC · {c.name.toUpperCase()}
            </Text>
            <Text position={[0, -0.19, 0.05]} fontSize={0.034} fontWeight={700} color="#555555" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
              ns:{c.namespace} · {c.capacityGi}Gi · {c.status}
            </Text>
          </group>
        );
      })}

      {/* ConfigMap + Secret row (bottom) */}
      {[...cms.map((c) => ({ kind: "cm" as const, c })), ...secrets.map((c) => ({ kind: "sec" as const, c }))].map((entry, i) => {
        const x = configSlots[i];
        const y = -0.6;
        const c = entry.c;
        const isActive = activeEntityId === c.id;
        return (
          <group key={c.id} position={[x, y, 0]}>
            <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(c.id); }} scaleHover={1.1}>
              <ConfigCard kind={entry.kind} highlight={isActive} accent={meta.color} />
            </Interactable>
            <Text position={[0, -0.14, 0.05]} fontSize={0.04} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.004} outlineColor="#ffffff">
              {entry.kind === "sec" ? "SECRET" : "CONFIGMAP"} · {c.name.toUpperCase()}
            </Text>
            <Text position={[0, -0.19, 0.05]} fontSize={0.032} fontWeight={700} color="#555555" anchorX="center" outlineWidth={0.002} outlineColor="#ffffff">
              ns:{c.namespace} · {Object.keys(c.data).length} keys
            </Text>
          </group>
        );
      })}

      {pvs.length === 0 && pvcs.length === 0 && cms.length === 0 && secrets.length === 0 && (
        <Text position={[0, 0, 0.05]} fontSize={0.06} fontWeight={800} color="#888888" anchorX="center" outlineWidth={0.004} outlineColor="#ffffff">
          no storage objects · try `kubectl apply -f db`
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

function DiskStack({ capacityGi, status: _status, highlight }: { capacityGi: number; status: "Available" | "Bound" | "Released"; highlight: boolean }) {
  const platters = Math.max(2, Math.min(5, Math.ceil(capacityGi / 10)));
  const stackColor = highlight ? "#000000" : "#ffffff";
  const edgeColor = highlight ? "#ffffff" : "#000000";
  
  return (
    <group>
      {Array.from({ length: platters }).map((_, i) => (
        <mesh key={i} position={[0, (i - (platters - 1) / 2) * 0.04, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.034, 24]} />
          <meshStandardMaterial color={stackColor} roughness={1.0} metalness={0.0} />
          <Edges threshold={20} color={edgeColor} />
        </mesh>
      ))}
      {/* Spindle */}
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.22, 12]} />
        <meshStandardMaterial color={highlight ? "#ffffff" : "#000000"} roughness={1.0} metalness={0.0} />
      </mesh>
      {/* Status LED */}
      <mesh position={[0.13, 0, 0.18]}>
        <sphereGeometry args={[0.014, 10, 10]} />
        <meshStandardMaterial color={highlight ? "#ffffff" : "#000000"} roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color={edgeColor} />
      </mesh>
    </group>
  );
}

function PvcCard({ status: _status, highlight, accent: _accent }: { status: "Pending" | "Bound" | "Lost"; highlight: boolean; accent: string }) {
  const bodyColor = highlight ? "#000000" : "#ffffff";
  const edgeColor = highlight ? "#ffffff" : "#000000";
  const elementColor = highlight ? "#ffffff" : "#000000";
  
  return (
    <group>
      <mesh castShadow position={[0, 0, 0.08]}>
        <boxGeometry args={[0.32, 0.18, 0.05]} />
        <meshStandardMaterial color={bodyColor} roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color={edgeColor} />
      </mesh>
      {/* "claim" symbol */}
      {Array.from({ length: 3 }).map((_, i) => (
        <mesh key={i} position={[-0.1 + i * 0.06, 0.02, 0.111]}>
          <planeGeometry args={[0.045, 0.012]} />
          <meshStandardMaterial color={elementColor} roughness={1.0} metalness={0.0} />
        </mesh>
      ))}
      {/* status pip */}
      <mesh position={[0.13, -0.05, 0.111]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color={elementColor} roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color={edgeColor} />
      </mesh>
    </group>
  );
}

function ConfigCard({ kind, highlight, accent: _accent }: { kind: "cm" | "sec"; highlight: boolean; accent: string }) {
  const bodyColor = highlight ? "#000000" : "#ffffff";
  const edgeColor = highlight ? "#ffffff" : "#000000";
  const elementColor = highlight ? "#ffffff" : "#000000";
  
  return (
    <group>
      <mesh castShadow position={[0, 0, 0.08]}>
        <boxGeometry args={[0.24, 0.2, 0.05]} />
        <meshStandardMaterial color={bodyColor} roughness={1.0} metalness={0.0} />
        <Edges threshold={20} color={edgeColor} />
      </mesh>
      {/* document fold corner */}
      <mesh position={[0.08, 0.07, 0.111]}>
        <planeGeometry args={[0.06, 0.06]} />
        <meshStandardMaterial color={elementColor} roughness={1.0} metalness={0.0} />
      </mesh>
      {/* lines */}
      {[0.02, -0.02, -0.06].map((y, i) => (
        <mesh key={i} position={[-0.04, y, 0.111]}>
          <planeGeometry args={[0.13, 0.008]} />
          <meshStandardMaterial color={elementColor} roughness={1.0} metalness={0.0} />
        </mesh>
      ))}
      {/* lock for secrets */}
      {kind === "sec" && (
        <group position={[-0.085, 0.065, 0.115]}>
          <mesh>
            <boxGeometry args={[0.04, 0.03, 0.01]} />
            <meshStandardMaterial color={elementColor} roughness={1.0} metalness={0.0} />
            <Edges threshold={20} color={edgeColor} />
          </mesh>
          <mesh position={[0, 0.018, 0]}>
            <torusGeometry args={[0.012, 0.004, 6, 12, Math.PI]} />
            <meshStandardMaterial color={elementColor} roughness={1.0} metalness={0.0} />
            <Edges threshold={20} color={edgeColor} />
          </mesh>
        </group>
      )}
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
      <planeGeometry args={[len, 0.012]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.45} />
    </mesh>
  );
}
