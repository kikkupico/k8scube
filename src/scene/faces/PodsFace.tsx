import { useMemo } from "react";
import { Edges, Text } from "@react-three/drei";
import { FaceFrame } from "./FaceFrame";
import { useCluster } from "../../state/clusterStore";
import { useApp } from "../../state/store";
import { Interactable } from "../Interactable";
import { PodCapsule } from "../props/PodCapsule";
import { computeSliceLayout } from "../sliceLayout";

const SHELF_W = 1.78;
const POD_LANE_X_PADDING = 0.08;

export function PodsFace() {
  const pods = useCluster((s) => s.pods);
  const nodes = useCluster((s) => s.nodes);
  const deployments = useCluster((s) => s.deployments);
  const daemonSets = useCluster((s) => s.daemonSets);
  const jobs = useCluster((s) => s.jobs);

  // Color a pod by its owning workload (Deployment, DaemonSet or Job).
  const colorForPod = useMemo(() => {
    return (p: typeof pods[number]): string => {
      const dep = deployments.find((d) => d.id === p.deploymentId);
      if (dep) return dep.color;
      const ds = daemonSets.find((d) => d.id === p.ownerRef);
      if (ds) return ds.color;
      const job = jobs.find((j) => j.id === p.ownerRef);
      if (job) return job.color;
      return "#06b6d4";
    };
  }, [deployments, daemonSets, jobs]);
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);

  const workers = useMemo(() => nodes.filter((n) => n.role === "worker"), [nodes]);
  const layout = useMemo(() => computeSliceLayout(workers.length), [workers.length]);

  // Pre-bucket pods per worker; keep deterministic order so positions don't jump.
  const podsByNode = useMemo(() => {
    const map = new Map<string, typeof pods>();
    for (const w of workers) map.set(w.id, []);
    for (const p of pods) {
      if (!p.nodeId || p.phase === "Terminating") continue;
      const arr = map.get(p.nodeId);
      if (arr) arr.push(p);
    }
    // sort within each node by deployment+createdAt for stable layout
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.deploymentId ?? "").localeCompare(b.deploymentId ?? "") || a.createdAt - b.createdAt);
    }
    return map;
  }, [pods, workers]);

  // Pods that are still in flight or unscheduled — render in a "pending bay" at the top
  const pending = useMemo(
    () => pods.filter((p) => !p.nodeId && p.phase !== "Terminating"),
    [pods],
  );

  return (
    <FaceFrame face="pods">
      {workers.map((node, i) => {
        const slab = layout.workers[i];
        if (!slab) return null;
        const isNodeActive = activeEntityId === node.id;
        const slabPods = podsByNode.get(node.id) ?? [];

        // Layout pods in a row across the slab (wrap if many)
        const maxPerRow = 6;
        const rows = Math.max(1, Math.ceil(slabPods.length / maxPerRow));
        const rowH = slab.h * 0.7 / rows;

        return (
          <group key={node.id}>
            {/* Slab background tint that matches the node row, picks up node selection */}
            <mesh
              position={[0, slab.y, 0.012]}
              onClick={(e) => { e.stopPropagation(); setActiveEntity(node.id); }}
            >
              <planeGeometry args={[SHELF_W + 0.04, slab.h * 0.92]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent
                opacity={isNodeActive ? 0.95 : 0.45}
                roughness={1.0}
                metalness={0.0}
              />
              <Edges threshold={20} color="#000000" />
            </mesh>

            {/* Node label on the right edge of this slab */}
            <group position={[SHELF_W / 2 + 0.08, slab.y, 0.05]}>
              <Text fontSize={0.045} fontWeight={800} color="#000000" anchorX="left" anchorY="middle" outlineWidth={0.004} outlineColor="#ffffff">
                {node.name.toUpperCase()}
              </Text>
              <Text position={[0, -0.05, 0]} fontSize={0.03} fontWeight={700} color="#555555" anchorX="left" anchorY="middle" outlineWidth={0.002} outlineColor="#ffffff">
                {slabPods.length} POD{slabPods.length === 1 ? "" : "S"}
              </Text>
            </group>

            {/* Pods inside this slab */}
            {slabPods.map((pod, pi) => {
              const row = Math.floor(pi / maxPerRow);
              const col = pi % maxPerRow;
              const inRow = Math.min(maxPerRow, slabPods.length - row * maxPerRow);
              const usableW = SHELF_W - POD_LANE_X_PADDING * 2;
              const xStep = usableW / Math.max(1, inRow);
              const x = -usableW / 2 + xStep / 2 + col * xStep;
              const y = slab.y + (rows > 1 ? (rows - 1) / 2 * rowH - row * rowH : 0);

              const color = colorForPod(pod);
              const isActive = activeEntityId === pod.id;
              const visible = pod.flightProgress >= 1;

              return (
                <group key={pod.id} position={[x, y, 0.18]}>
                  <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(pod.id); }} scaleHover={1.18}>
                    <group visible={visible}>
                      <PodCapsule
                        color={color}
                        phase={pod.phase}
                        containers={pod.containers.length}
                        highlight={isActive}
                        scale={pod.phase === "Terminating" ? 0.001 : Math.min(1, slab.h * 1.6)}
                      />
                    </group>
                  </Interactable>
                </group>
              );
            })}

            {/* Empty slab placeholder text */}
            {slabPods.length === 0 && (
              <Text position={[0, slab.y, 0.05]} fontSize={0.035} color="#888888" anchorX="center" anchorY="middle">
                — empty —
              </Text>
            )}
          </group>
        );
      })}

      {/* Pending bay at the top — pods waiting on PVC / scheduling */}
      {pending.length > 0 && (
        <group position={[0, 0.86, 0.08]}>
          <Text fontSize={0.04} fontWeight={800} color="#000000" anchorX="center" outlineWidth={0.004} outlineColor="#ffffff">
            PENDING ({pending.length})
          </Text>
          {pending.map((p, i) => {
            const xStep = 0.16;
            const x = (i - (pending.length - 1) / 2) * xStep;
            const color = colorForPod(p);
            return (
              <group key={p.id} position={[x, -0.1, 0]}>
                <Interactable onClick={(e) => { e.stopPropagation(); setActiveEntity(p.id); }} scaleHover={1.2}>
                  <PodCapsule color={color} phase={p.phase} containers={1} scale={0.6} />
                </Interactable>
              </group>
            );
          })}
        </group>
      )}
    </FaceFrame>
  );
}
