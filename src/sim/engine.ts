import type {
  Action,
  ClusterEvent,
  ClusterSnapshot,
  K8sConfigMap,
  K8sCronJob,
  K8sDaemonSet,
  K8sDeployment,
  K8sHPA,
  K8sJob,
  K8sEgressTarget,
  K8sIngress,
  K8sNamespace,
  K8sNode,
  K8sPod,
  K8sPV,
  K8sPVC,
  K8sSecret,
  K8sService,
  PodPhase,
} from "../state/clusterStore";
import {
  DEFAULT_NODE_CAPACITY,
  DEFAULT_NS,
  DEFAULT_REQUESTS,
  NS_PALETTE,
  nextId,
  podNameFor,
  templateHashFor,
  type Resources,
} from "../state/clusterStore";

// ---------- Engine state shape (subset of ClusterState) ----------

export interface EngineState extends ClusterSnapshot {
  tick: number;
  pendingActions: Action[];
}

// ---------- Pure step ----------

export function step(prev: EngineState): EngineState {
  // shallow clone arrays so React sees new references where needed
  let s: EngineState = {
    ...prev,
    tick: prev.tick + 1,
    nodes: [...prev.nodes],
    namespaces: [...prev.namespaces],
    deployments: prev.deployments.map((d) => ({ ...d })),
    replicaSets: prev.replicaSets.map((r) => ({ ...r })),
    daemonSets: prev.daemonSets.map((d) => ({ ...d })),
    jobs: prev.jobs.map((j) => ({ ...j })),
    cronJobs: prev.cronJobs.map((c) => ({ ...c })),
    hpas: prev.hpas.map((h) => ({ ...h })),
    pods: prev.pods.map((p) => ({ ...p, volumes: [...p.volumes], containers: p.containers.map((c) => ({ ...c })) })),
    services: prev.services.map((sv) => ({ ...sv, endpoints: [...sv.endpoints] })),
    ingresses: prev.ingresses.map((i) => ({ ...i })),
    egressTargets: prev.egressTargets.map((e) => ({ ...e, usedBy: [...e.usedBy] })),
    pvs: prev.pvs.map((v) => ({ ...v })),
    pvcs: prev.pvcs.map((c) => ({ ...c })),
    configMaps: prev.configMaps.map((c) => ({ ...c })),
    secrets: prev.secrets.map((c) => ({ ...c })),
    events: [...prev.events],
    pendingActions: [],
  };

  // 1. Drain pending actions
  for (const a of prev.pendingActions) {
    s = applyAction(s, a);
  }

  // 2. Bind PVCs to PVs
  s = reconcilePVCs(s);

  // 2b. HPA controller — adjusts deployment.desiredReplicas from synthetic load
  s = reconcileHPA(s);

  // 3. Deployment controller — sets desiredReplicas on RSs per strategy
  s = reconcileDeployments(s);

  // 4. ReplicaSet controller — creates/terminates pods
  s = reconcileReplicaSets(s);

  // 4b. Other workload controllers — create their own pods
  s = reconcileDaemonSets(s);
  s = reconcileCronJobs(s);
  s = reconcileJobs(s);

  // 5. Scheduler — assigns Pending pods to a node
  s = scheduler(s);

  // 6. Kubelet — advances pod phases
  s = kubelet(s);

  // 7. Pod flight progress — pure visual (advance unconditionally)
  s = advanceFlights(s);

  // 8. Service controller — rebuild endpoints
  s = reconcileServices(s);

  // 9. Trim events
  if (s.events.length > 200) s.events = s.events.slice(0, 200);

  return s;
}

// ---------- Helpers ----------

function emit(s: EngineState, ev: Omit<ClusterEvent, "id" | "at">): EngineState {
  const evt: ClusterEvent = { id: nextId("ev"), at: s.tick, ...ev };
  s.events = [evt, ...s.events];
  return s;
}

function podsForRS(s: EngineState, rsId: string): K8sPod[] {
  return s.pods.filter((p) => p.ownerRef === rsId && p.phase !== "Terminating");
}

function podsForDeployment(s: EngineState, deployId: string): K8sPod[] {
  return s.pods.filter((p) => p.deploymentId === deployId && p.phase !== "Terminating");
}

function isAvailable(p: K8sPod): boolean {
  return p.phase === "Running" && p.containers.every((c) => c.ready);
}

/** Resource requests for a pod (sum of its containers), with defaults applied. */
export function podRequests(p: K8sPod): Resources {
  if (!p.containers.length) return { ...DEFAULT_REQUESTS };
  return p.containers.reduce(
    (acc, c) => {
      const r = c.requests ?? DEFAULT_REQUESTS;
      return { cpu: acc.cpu + r.cpu, mem: acc.mem + r.mem };
    },
    { cpu: 0, mem: 0 },
  );
}

/** Compute requested cpu/mem already committed to a node by its scheduled pods. */
export function nodeAllocated(s: EngineState, nodeId: string): Resources {
  return s.pods
    .filter((p) => p.nodeId === nodeId && p.phase !== "Terminating" && p.phase !== "Succeeded")
    .reduce(
      (acc, p) => {
        const r = podRequests(p);
        return { cpu: acc.cpu + r.cpu, mem: acc.mem + r.mem };
      },
      { cpu: 0, mem: 0 },
    );
}

/**
 * Pick the least-loaded Ready worker that still has room for the pod's
 * requests. Returns the chosen node, or a reason string explaining why nothing
 * fits (so the scheduler can emit an accurate FailedScheduling event).
 */
function findFittingNode(s: EngineState, pod: K8sPod): { node: K8sNode } | { reason: string } {
  const workers = s.nodes.filter((n) => n.role === "worker" && n.status === "Ready");
  if (!workers.length) return { reason: "no Ready worker nodes" };
  const req = podRequests(pod);
  let cpuBlocked = false;
  let memBlocked = false;
  const fitting = workers.filter((n) => {
    const used = nodeAllocated(s, n.id);
    const cpuOk = used.cpu + req.cpu <= n.capacity.cpu;
    const memOk = used.mem + req.mem <= n.capacity.mem;
    if (!cpuOk) cpuBlocked = true;
    if (!memOk) memBlocked = true;
    return cpuOk && memOk;
  });
  if (!fitting.length) {
    const what = cpuBlocked && memBlocked ? "cpu, memory" : cpuBlocked ? "cpu" : "memory";
    return { reason: `Insufficient ${what}` };
  }
  // least-loaded (by committed cpu) among the nodes that fit
  const node = fitting.reduce((best, n) =>
    nodeAllocated(s, n.id).cpu < nodeAllocated(s, best.id).cpu ? n : best,
  );
  return { node };
}

function findOrCreateNamespace(s: EngineState, name: string): K8sNamespace {
  let ns = s.namespaces.find((n) => n.name === name);
  if (ns) return ns;
  const color = NS_PALETTE[s.namespaces.length % NS_PALETTE.length];
  ns = { id: nextId("ns"), name, color };
  s.namespaces.push(ns);
  emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "Namespace", name, id: ns.id }, message: "namespace created" });
  return ns;
}

function pvcsForPod(s: EngineState, p: K8sPod): K8sPVC[] {
  if (!p.volumes.length) return [];
  return p.volumes
    .map((v) => s.pvcs.find((c) => c.name === v.claimName && c.namespace === p.namespace))
    .filter((c): c is K8sPVC => !!c);
}

// ---------- Actions ----------

function applyAction(s: EngineState, a: Action): EngineState {
  switch (a.type) {
    case "ScaleDeployment": {
      const d = s.deployments.find((x) => x.name === a.name && (a.namespace ? x.namespace === a.namespace : true));
      if (!d) return emit(s, { type: "Warning", reason: "NotFound", involvedObject: { kind: "Deployment", name: a.name, id: a.name }, message: `deployment ${a.name} not found` });
      d.desiredReplicas = Math.max(0, Math.floor(a.replicas));
      return emit(s, { type: "Normal", reason: "ScalingReplicaSet", involvedObject: { kind: "Deployment", name: d.name, id: d.id }, message: `scaled to ${d.desiredReplicas}` });
    }
    case "DeletePod": {
      const p = s.pods.find((x) => x.name === a.name && (a.namespace ? x.namespace === a.namespace : true));
      if (!p) return emit(s, { type: "Warning", reason: "NotFound", involvedObject: { kind: "Pod", name: a.name, id: a.name }, message: `pod ${a.name} not found` });
      if (p.phase !== "Terminating") {
        p.phase = "Terminating";
        p.terminationTicks = 1;
      }
      return emit(s, { type: "Normal", reason: "Killing", involvedObject: { kind: "Pod", name: p.name, id: p.id }, message: `requested deletion` });
    }
    case "DeleteDeployment": {
      const d = s.deployments.find((x) => x.name === a.name && (a.namespace ? x.namespace === a.namespace : true));
      if (!d) return s;
      for (const p of s.pods) if (p.deploymentId === d.id) { p.phase = "Terminating"; p.terminationTicks = 1; }
      s.replicaSets = s.replicaSets.filter((r) => r.deploymentId !== d.id);
      s.deployments = s.deployments.filter((x) => x.id !== d.id);
      s.services = s.services.map((sv) => sv.selector.deploymentId === d.id ? { ...sv, endpoints: [] } : sv);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "Deployment", name: d.name, id: d.id }, message: `deployment removed` });
    }
    case "SetImage": {
      const d = s.deployments.find((x) => x.name === a.deployment && (a.namespace ? x.namespace === a.namespace : true));
      if (!d) return emit(s, { type: "Warning", reason: "NotFound", involvedObject: { kind: "Deployment", name: a.deployment, id: a.deployment }, message: `deployment ${a.deployment} not found` });
      if (d.image === a.image) return s;
      d.image = a.image;
      d.templateHash = templateHashFor(a.image);
      const nextRevision = (d.rollouts[d.rollouts.length - 1]?.revision ?? 0) + 1;
      d.rollouts.push({ revision: nextRevision, templateHash: d.templateHash, image: a.image, at: s.tick });
      return emit(s, { type: "Normal", reason: "RollingUpdate", involvedObject: { kind: "Deployment", name: d.name, id: d.id }, message: `image -> ${a.image}` });
    }
    case "RolloutUndo": {
      const d = s.deployments.find((x) => x.name === a.deployment && (a.namespace ? x.namespace === a.namespace : true));
      if (!d || d.rollouts.length < 2) return s;
      const prev = d.rollouts[d.rollouts.length - 2];
      d.image = prev.image;
      d.templateHash = prev.templateHash;
      const nextRevision = (d.rollouts[d.rollouts.length - 1]?.revision ?? 0) + 1;
      d.rollouts.push({ revision: nextRevision, templateHash: prev.templateHash, image: prev.image, at: s.tick });
      return emit(s, { type: "Normal", reason: "RollbackTo", involvedObject: { kind: "Deployment", name: d.name, id: d.id }, message: `rolled back to revision ${prev.revision}` });
    }
    case "ApplyDeployment": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      findOrCreateNamespace(s, ns);
      const existing = s.deployments.find((x) => x.name === a.spec.name && x.namespace === ns);
      const image = a.spec.image;
      const hash = templateHashFor(image);
      if (existing) {
        existing.desiredReplicas = a.spec.replicas;
        if (a.spec.volumeClaims) existing.volumeClaims = a.spec.volumeClaims;
        if (a.spec.requests) existing.requests = a.spec.requests;
        if (existing.image !== image) {
          existing.image = image;
          existing.templateHash = hash;
          const nextRevision = (existing.rollouts[existing.rollouts.length - 1]?.revision ?? 0) + 1;
          existing.rollouts.push({ revision: nextRevision, templateHash: hash, image, at: s.tick });
        }
        return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "Deployment", name: existing.name, id: existing.id }, message: `applied` });
      }
      const d: K8sDeployment = {
        id: nextId("dep"),
        name: a.spec.name,
        namespace: ns,
        desiredReplicas: a.spec.replicas,
        color: a.spec.color ?? "#06b6d4",
        image,
        strategy: {
          type: a.spec.strategy?.type ?? "RollingUpdate",
          maxSurge: a.spec.strategy?.maxSurge ?? 1,
          maxUnavailable: a.spec.strategy?.maxUnavailable ?? 0,
        },
        templateHash: hash,
        rollouts: [{ revision: 1, templateHash: hash, image, at: s.tick }],
        volumeClaims: a.spec.volumeClaims ?? [],
        requests: a.spec.requests,
      };
      s.deployments.push(d);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "Deployment", name: d.name, id: d.id }, message: `created` });
    }
    // -------- other workload controllers --------
    case "ApplyDaemonSet": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      findOrCreateNamespace(s, ns);
      const existing = s.daemonSets.find((d) => d.name === a.spec.name && d.namespace === ns);
      const hash = templateHashFor(a.spec.image);
      if (existing) {
        existing.image = a.spec.image;
        existing.templateHash = hash;
        if (a.spec.requests) existing.requests = a.spec.requests;
        return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "DaemonSet", name: existing.name, id: existing.id }, message: `updated` });
      }
      const ds: K8sDaemonSet = {
        id: nextId("ds"), name: a.spec.name, namespace: ns, image: a.spec.image,
        color: a.spec.color ?? "#22d3ee", templateHash: hash, requests: a.spec.requests,
      };
      s.daemonSets.push(ds);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "DaemonSet", name: ds.name, id: ds.id }, message: `one pod per node` });
    }
    case "DeleteDaemonSet": {
      const ds = s.daemonSets.find((d) => d.name === a.name && (a.namespace ? d.namespace === a.namespace : true));
      if (!ds) return s;
      for (const p of s.pods) if (p.ownerRef === ds.id && p.phase !== "Terminating") { p.phase = "Terminating"; p.terminationTicks = 1; }
      s.daemonSets = s.daemonSets.filter((x) => x.id !== ds.id);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "DaemonSet", name: ds.name, id: ds.id }, message: `removed` });
    }
    case "ApplyJob": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      findOrCreateNamespace(s, ns);
      if (s.jobs.find((j) => j.name === a.spec.name && j.namespace === ns)) return s;
      const job: K8sJob = {
        id: nextId("job"), name: a.spec.name, namespace: ns, image: a.spec.image,
        color: a.spec.color ?? "#a855f7", templateHash: templateHashFor(a.spec.image),
        completions: Math.max(1, a.spec.completions ?? 1), succeeded: 0, requests: a.spec.requests,
      };
      s.jobs.push(job);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "Job", name: job.name, id: job.id }, message: `needs ${job.completions} completion(s)` });
    }
    case "DeleteJob": {
      const job = s.jobs.find((j) => j.name === a.name && (a.namespace ? j.namespace === a.namespace : true));
      if (!job) return s;
      for (const p of s.pods) if (p.ownerRef === job.id && p.phase !== "Terminating") { p.phase = "Terminating"; p.terminationTicks = 1; }
      s.jobs = s.jobs.filter((x) => x.id !== job.id);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "Job", name: job.name, id: job.id }, message: `removed` });
    }
    case "ApplyCronJob": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      findOrCreateNamespace(s, ns);
      if (s.cronJobs.find((c) => c.name === a.spec.name && c.namespace === ns)) return s;
      const cj: K8sCronJob = {
        id: nextId("cj"), name: a.spec.name, namespace: ns, image: a.spec.image,
        color: a.spec.color ?? "#a855f7", schedule: Math.max(1, a.spec.schedule),
        lastScheduledTick: s.tick, completions: Math.max(1, a.spec.completions ?? 1), requests: a.spec.requests,
      };
      s.cronJobs.push(cj);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "CronJob", name: cj.name, id: cj.id }, message: `every ${cj.schedule} ticks` });
    }
    case "DeleteCronJob": {
      const cj = s.cronJobs.find((c) => c.name === a.name && (a.namespace ? c.namespace === a.namespace : true));
      if (!cj) return s;
      s.cronJobs = s.cronJobs.filter((x) => x.id !== cj.id);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "CronJob", name: cj.name, id: cj.id }, message: `removed` });
    }
    // -------- autoscaling + probes --------
    case "ApplyHPA": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      const dep = s.deployments.find((d) => d.name === a.spec.deploymentName && d.namespace === ns);
      if (!dep) return emit(s, { type: "Warning", reason: "NotFound", involvedObject: { kind: "HorizontalPodAutoscaler", name: a.spec.deploymentName, id: a.spec.deploymentName }, message: `target deployment ${a.spec.deploymentName} not found` });
      const name = a.spec.name ?? a.spec.deploymentName;
      const existing = s.hpas.find((h) => h.name === name && h.namespace === ns);
      if (existing) {
        existing.minReplicas = a.spec.minReplicas;
        existing.maxReplicas = a.spec.maxReplicas;
        existing.targetCpuPercent = a.spec.targetCpuPercent;
        return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "HorizontalPodAutoscaler", name, id: existing.id }, message: `updated` });
      }
      const hpa: K8sHPA = {
        id: nextId("hpa"), name, namespace: ns, targetDeployment: dep.name,
        minReplicas: Math.max(1, a.spec.minReplicas), maxReplicas: Math.max(a.spec.minReplicas, a.spec.maxReplicas),
        targetCpuPercent: Math.max(1, a.spec.targetCpuPercent),
      };
      s.hpas.push(hpa);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "HorizontalPodAutoscaler", name, id: hpa.id }, message: `target ${hpa.targetCpuPercent}% cpu, ${hpa.minReplicas}-${hpa.maxReplicas} replicas` });
    }
    case "DeleteHPA": {
      const h = s.hpas.find((x) => x.name === a.name && (a.namespace ? x.namespace === a.namespace : true));
      if (!h) return s;
      s.hpas = s.hpas.filter((x) => x.id !== h.id);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "HorizontalPodAutoscaler", name: h.name, id: h.id }, message: `removed` });
    }
    case "SetLoad": {
      const d = s.deployments.find((x) => x.name === a.deployment && (a.namespace ? x.namespace === a.namespace : true));
      if (!d) return s;
      d.load = Math.max(0, a.load);
      return s;
    }
    case "SetReadiness": {
      const p = s.pods.find((x) => x.name === a.name && (a.namespace ? x.namespace === a.namespace : true));
      if (!p || p.phase !== "Running") return s;
      for (const c of p.containers) c.ready = a.ready;
      return emit(s, a.ready
        ? { type: "Normal", reason: "Ready", involvedObject: { kind: "Pod", name: p.name, id: p.id }, message: `readiness probe passing` }
        : { type: "Warning", reason: "Unhealthy", involvedObject: { kind: "Pod", name: p.name, id: p.id }, message: `readiness probe failed` });
    }
    case "FailLiveness": {
      const p = s.pods.find((x) => x.name === a.name && (a.namespace ? x.namespace === a.namespace : true));
      if (!p || p.phase !== "Running") return s;
      p.containers.forEach((c) => (c.ready = false));
      setPhase(s, p, "Failed", "Liveness", `liveness probe failed`);
      return s;
    }
    case "DrainNode": {
      const n = s.nodes.find((x) => x.name === a.node);
      if (!n) return s;
      n.status = "Cordoned";
      for (const p of s.pods) {
        if (p.nodeId === n.id && p.phase !== "Terminating") {
          p.phase = "Terminating";
          p.terminationTicks = 1;
        }
      }
      return emit(s, { type: "Normal", reason: "Drained", involvedObject: { kind: "Node", name: n.name, id: n.id }, message: `node drained` });
    }
    case "Cordon": {
      const n = s.nodes.find((x) => x.name === a.node);
      if (!n) return s;
      n.status = "Cordoned";
      return emit(s, { type: "Normal", reason: "Cordoned", involvedObject: { kind: "Node", name: n.name, id: n.id }, message: `cordoned` });
    }
    case "Uncordon": {
      const n = s.nodes.find((x) => x.name === a.node);
      if (!n) return s;
      n.status = "Ready";
      return emit(s, { type: "Normal", reason: "Uncordoned", involvedObject: { kind: "Node", name: n.name, id: n.id }, message: `back to Ready` });
    }
    // -------- storage --------
    case "ApplyPV": {
      const existing = s.pvs.find((p) => p.name === a.spec.name);
      if (existing) {
        existing.capacityGi = a.spec.capacityGi;
        if (a.spec.storageClass) existing.storageClass = a.spec.storageClass;
        return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "PersistentVolume", name: existing.name, id: existing.id }, message: `updated` });
      }
      const pv: K8sPV = {
        id: nextId("pv"),
        name: a.spec.name,
        capacityGi: a.spec.capacityGi,
        storageClass: a.spec.storageClass ?? "fast",
        status: "Available",
        boundClaim: null,
      };
      s.pvs.push(pv);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "PersistentVolume", name: pv.name, id: pv.id }, message: `${pv.capacityGi}Gi available` });
    }
    case "ApplyPVC": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      findOrCreateNamespace(s, ns);
      const existing = s.pvcs.find((c) => c.name === a.spec.name && c.namespace === ns);
      if (existing) return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "PVC", name: existing.name, id: existing.id }, message: `unchanged` });
      const pvc: K8sPVC = {
        id: nextId("pvc"),
        name: a.spec.name,
        namespace: ns,
        capacityGi: a.spec.capacityGi,
        storageClass: a.spec.storageClass ?? "fast",
        status: "Pending",
        boundVolume: null,
      };
      s.pvcs.push(pvc);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "PVC", name: pvc.name, id: pvc.id }, message: `requesting ${pvc.capacityGi}Gi` });
    }
    case "DeletePVC": {
      const c = s.pvcs.find((x) => x.name === a.name && (a.namespace ? x.namespace === a.namespace : true));
      if (!c) return s;
      // release bound PV
      if (c.boundVolume) {
        const pv = s.pvs.find((v) => v.id === c.boundVolume);
        if (pv) { pv.status = "Released"; pv.boundClaim = null; }
      }
      s.pvcs = s.pvcs.filter((x) => x.id !== c.id);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "PVC", name: c.name, id: c.id }, message: `released ${c.boundVolume ?? "<none>"}` });
    }
    case "ApplyConfigMap": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      findOrCreateNamespace(s, ns);
      const existing = s.configMaps.find((c) => c.name === a.spec.name && c.namespace === ns);
      if (existing) {
        existing.data = a.spec.data;
        return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "ConfigMap", name: existing.name, id: existing.id }, message: `updated` });
      }
      const cm: K8sConfigMap = { id: nextId("cm"), name: a.spec.name, namespace: ns, data: a.spec.data };
      s.configMaps.push(cm);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "ConfigMap", name: cm.name, id: cm.id }, message: `${Object.keys(cm.data).length} keys` });
    }
    case "ApplySecret": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      findOrCreateNamespace(s, ns);
      const existing = s.secrets.find((c) => c.name === a.spec.name && c.namespace === ns);
      if (existing) {
        existing.data = a.spec.data;
        return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "Secret", name: existing.name, id: existing.id }, message: `updated` });
      }
      const sec: K8sSecret = { id: nextId("sec"), name: a.spec.name, namespace: ns, data: a.spec.data };
      s.secrets.push(sec);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "Secret", name: sec.name, id: sec.id }, message: `${Object.keys(sec.data).length} keys` });
    }
    // -------- networking --------
    case "ApplyService": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      findOrCreateNamespace(s, ns);
      const dep = s.deployments.find((d) => d.name === a.spec.deploymentName);
      if (!dep) return emit(s, { type: "Warning", reason: "NotFound", involvedObject: { kind: "Service", name: a.spec.name, id: a.spec.name }, message: `target deployment ${a.spec.deploymentName} not found` });
      const existing = s.services.find((sv) => sv.name === a.spec.name && sv.namespace === ns);
      if (existing) {
        existing.type = a.spec.type ?? existing.type;
        existing.selector = { deploymentId: dep.id };
        return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "Service", name: existing.name, id: existing.id }, message: `updated` });
      }
      const svc: K8sService = {
        id: nextId("svc"),
        name: a.spec.name,
        namespace: ns,
        type: a.spec.type ?? "ClusterIP",
        selector: { deploymentId: dep.id },
        endpoints: [],
      };
      s.services.push(svc);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "Service", name: svc.name, id: svc.id }, message: `selecting ${dep.name}` });
    }
    case "DeleteService": {
      const sv = s.services.find((x) => x.name === a.name && (a.namespace ? x.namespace === a.namespace : true));
      if (!sv) return s;
      s.services = s.services.filter((x) => x.id !== sv.id);
      // also cull ingresses pointing at this service
      s.ingresses = s.ingresses.filter((i) => i.serviceName !== sv.name);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "Service", name: sv.name, id: sv.id }, message: `removed` });
    }
    case "ApplyIngress": {
      const ns = a.spec.namespace ?? DEFAULT_NS;
      findOrCreateNamespace(s, ns);
      const existing = s.ingresses.find((i) => i.name === a.spec.name && i.namespace === ns);
      if (existing) {
        existing.host = a.spec.host;
        existing.serviceName = a.spec.serviceName;
        return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "Ingress", name: existing.name, id: existing.id }, message: `updated` });
      }
      const ing: K8sIngress = { id: nextId("ing"), name: a.spec.name, namespace: ns, host: a.spec.host, serviceName: a.spec.serviceName };
      s.ingresses.push(ing);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "Ingress", name: ing.name, id: ing.id }, message: `${ing.host} -> ${ing.serviceName}` });
    }
    case "DeleteIngress": {
      const ing = s.ingresses.find((i) => i.name === a.name && (a.namespace ? i.namespace === a.namespace : true));
      if (!ing) return s;
      s.ingresses = s.ingresses.filter((x) => x.id !== ing.id);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "Ingress", name: ing.name, id: ing.id }, message: `removed` });
    }
    // -------- foundations --------
    case "CreateNamespace": {
      const existing = s.namespaces.find((n) => n.name === a.name);
      if (existing) return s;
      const ns: K8sNamespace = { id: nextId("ns"), name: a.name, color: a.color ?? NS_PALETTE[s.namespaces.length % NS_PALETTE.length] };
      s.namespaces.push(ns);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "Namespace", name: ns.name, id: ns.id }, message: `namespace created` });
    }
    case "DeleteNamespace": {
      if (a.name === DEFAULT_NS || a.name === "kube-system") {
        return emit(s, { type: "Warning", reason: "Forbidden", involvedObject: { kind: "Namespace", name: a.name, id: a.name }, message: `cannot delete protected namespace` });
      }
      const ns = s.namespaces.find((n) => n.name === a.name);
      if (!ns) return s;
      // cascade delete
      for (const p of s.pods) if (p.namespace === a.name) { p.phase = "Terminating"; p.terminationTicks = 1; }
      s.deployments = s.deployments.filter((d) => d.namespace !== a.name);
      s.daemonSets = s.daemonSets.filter((d) => d.namespace !== a.name);
      s.jobs = s.jobs.filter((j) => j.namespace !== a.name);
      s.cronJobs = s.cronJobs.filter((c) => c.namespace !== a.name);
      s.hpas = s.hpas.filter((h) => h.namespace !== a.name);
      s.services = s.services.filter((sv) => sv.namespace !== a.name);
      s.ingresses = s.ingresses.filter((i) => i.namespace !== a.name);
      s.pvcs = s.pvcs.filter((c) => {
        if (c.namespace !== a.name) return true;
        if (c.boundVolume) {
          const pv = s.pvs.find((v) => v.id === c.boundVolume);
          if (pv) { pv.status = "Released"; pv.boundClaim = null; }
        }
        return false;
      });
      s.configMaps = s.configMaps.filter((c) => c.namespace !== a.name);
      s.secrets = s.secrets.filter((c) => c.namespace !== a.name);
      s.namespaces = s.namespaces.filter((n) => n.id !== ns.id);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "Namespace", name: ns.name, id: ns.id }, message: `namespace removed (cascading)` });
    }
    // -------- nodes --------
    case "CreateNode": {
      const existingWorkers = s.nodes.filter((n) => n.role === "worker");
      const idx = existingWorkers.length + 1;
      const name = a.name ?? `worker-node-${idx}`;
      if (s.nodes.find((n) => n.name === name)) return s;
      const node: K8sNode = { id: nextId("node"), name, role: "worker", status: "Ready", capacity: { ...DEFAULT_NODE_CAPACITY } };
      s.nodes.push(node);
      return emit(s, { type: "Normal", reason: "NodeReady", involvedObject: { kind: "Node", name: node.name, id: node.id }, message: `joined the cluster` });
    }
    case "DeleteNode": {
      const n = s.nodes.find((x) => x.name === a.name && x.role === "worker");
      if (!n) return emit(s, { type: "Warning", reason: "NotFound", involvedObject: { kind: "Node", name: a.name, id: a.name }, message: `worker ${a.name} not found` });
      for (const p of s.pods) {
        if (p.nodeId === n.id && p.phase !== "Terminating") {
          p.phase = "Terminating";
          p.terminationTicks = 1;
        }
      }
      s.nodes = s.nodes.filter((x) => x.id !== n.id);
      return emit(s, { type: "Normal", reason: "NodeRemoved", involvedObject: { kind: "Node", name: n.name, id: n.id }, message: `node removed` });
    }
    // -------- egress targets --------
    case "ApplyEgressTarget": {
      const existing = s.egressTargets.find((e) => e.name === a.spec.name);
      if (existing) {
        existing.host = a.spec.host;
        if (a.spec.protocol) existing.protocol = a.spec.protocol;
        if (a.spec.usedBy) existing.usedBy = a.spec.usedBy;
        return emit(s, { type: "Normal", reason: "Applied", involvedObject: { kind: "EgressTarget", name: existing.name, id: existing.id }, message: `host ${existing.host}` });
      }
      const eg: K8sEgressTarget = {
        id: nextId("eg"),
        name: a.spec.name,
        host: a.spec.host,
        protocol: a.spec.protocol ?? "https",
        usedBy: a.spec.usedBy ?? [],
      };
      s.egressTargets.push(eg);
      return emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "EgressTarget", name: eg.name, id: eg.id }, message: `${eg.protocol}://${eg.host}` });
    }
    case "DeleteEgressTarget": {
      const eg = s.egressTargets.find((e) => e.name === a.name);
      if (!eg) return s;
      s.egressTargets = s.egressTargets.filter((x) => x.id !== eg.id);
      return emit(s, { type: "Normal", reason: "Deleted", involvedObject: { kind: "EgressTarget", name: eg.name, id: eg.id }, message: `removed` });
    }
  }
}

// ---------- PVC binder ----------

function reconcilePVCs(s: EngineState): EngineState {
  for (const pvc of s.pvcs) {
    if (pvc.status === "Bound" && pvc.boundVolume) continue;
    // look for an Available PV with matching storageClass and >= capacity
    const candidate = s.pvs.find(
      (v) => v.status === "Available" && v.storageClass === pvc.storageClass && v.capacityGi >= pvc.capacityGi,
    );
    if (!candidate) continue;
    candidate.status = "Bound";
    candidate.boundClaim = pvc.id;
    pvc.status = "Bound";
    pvc.boundVolume = candidate.id;
    emit(s, { type: "Normal", reason: "Bound", involvedObject: { kind: "PVC", name: pvc.name, id: pvc.id }, message: `bound to ${candidate.name}` });
  }
  return s;
}

// ---------- HPA controller ----------
// Adjusts a Deployment's desiredReplicas to hold a target CPU utilisation.
// desired = ceil(currentReplicas * currentUtil / targetUtil), clamped to [min,max].

function reconcileHPA(s: EngineState): EngineState {
  for (const hpa of s.hpas) {
    const dep = s.deployments.find((d) => d.name === hpa.targetDeployment && d.namespace === hpa.namespace);
    if (!dep) continue;
    const util = dep.load ?? 0; // synthetic avg CPU utilisation %
    const current = Math.max(1, dep.desiredReplicas);
    let desired = Math.ceil((current * util) / hpa.targetCpuPercent);
    desired = Math.max(hpa.minReplicas, Math.min(hpa.maxReplicas, desired));
    if (desired !== dep.desiredReplicas) {
      const dir = desired > dep.desiredReplicas ? "up" : "down";
      dep.desiredReplicas = desired;
      emit(s, { type: "Normal", reason: "SuccessfulRescale", involvedObject: { kind: "HorizontalPodAutoscaler", name: hpa.name, id: hpa.id }, message: `scaled ${dir} to ${desired} (cpu ${util}% vs target ${hpa.targetCpuPercent}%)` });
    }
  }
  return s;
}

// ---------- Deployment controller ----------

function reconcileDeployments(s: EngineState): EngineState {
  for (const d of s.deployments) {
    let current = s.replicaSets.find((r) => r.deploymentId === d.id && r.templateHash === d.templateHash);
    if (!current) {
      const nextRevision = Math.max(0, ...s.replicaSets.filter((r) => r.deploymentId === d.id).map((r) => r.revision)) + 1;
      current = {
        id: nextId("rs"),
        deploymentId: d.id,
        templateHash: d.templateHash,
        desiredReplicas: 0,
        revision: nextRevision,
      };
      s.replicaSets.push(current);
    }
    const olds = s.replicaSets.filter((r) => r.deploymentId === d.id && r.id !== current.id);

    if (d.strategy.type === "Recreate") {
      let oldPodCount = 0;
      for (const r of olds) {
        r.desiredReplicas = 0;
        oldPodCount += podsForRS(s, r.id).length;
      }
      current.desiredReplicas = oldPodCount === 0 ? d.desiredReplicas : 0;
    } else {
      const totalDesired = d.desiredReplicas;
      const surge = d.strategy.maxSurge;
      const maxUnavailable = d.strategy.maxUnavailable;

      const allPodsForDep = podsForDeployment(s, d.id);
      const availableCount = allPodsForDep.filter(isAvailable).length;
      const totalCount = allPodsForDep.length;

      const currentPods = podsForRS(s, current.id).length;

      if (current.desiredReplicas < totalDesired) {
        if (totalCount < totalDesired + surge) {
          current.desiredReplicas = Math.min(totalDesired, current.desiredReplicas + 1);
        }
      }

      if (availableCount > totalDesired - maxUnavailable || currentPods >= totalDesired) {
        for (const r of olds) {
          if (r.desiredReplicas > 0) {
            r.desiredReplicas = Math.max(0, r.desiredReplicas - 1);
            break;
          }
        }
      }

      s.replicaSets = s.replicaSets.filter((r) => {
        if (r.deploymentId !== d.id || r.id === current!.id) return true;
        if (r.desiredReplicas === 0 && podsForRS(s, r.id).length === 0) return false;
        return true;
      });
    }
  }
  return s;
}

// ---------- ReplicaSet controller ----------

function reconcileReplicaSets(s: EngineState): EngineState {
  for (const rs of s.replicaSets) {
    const dep = s.deployments.find((d) => d.id === rs.deploymentId);
    if (!dep) continue;
    const have = podsForRS(s, rs.id);
    const diff = rs.desiredReplicas - have.length;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        const pod: K8sPod = {
          id: nextId("pod"),
          name: podNameFor(dep.name, rs.templateHash),
          namespace: dep.namespace,
          ownerRef: rs.id,
          deploymentId: dep.id,
          nodeId: null,
          phase: "Pending",
          restartCount: 0,
          containers: [{ name: dep.name, image: dep.image, ready: false, requests: dep.requests ?? { ...DEFAULT_REQUESTS } }],
          volumes: dep.volumeClaims.map((c) => ({ name: c, claimName: c })),
          templateHash: rs.templateHash,
          createdAt: s.tick,
          phaseTicks: 0,
          terminationTicks: 0,
          failuresInARow: 0,
          backoffTicks: 0,
          flightProgress: 0,
        };
        s.pods.push(pod);
        emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "Pod", name: pod.name, id: pod.id }, message: `pending scheduling` });
      }
    } else if (diff < 0) {
      const excess = [...have].sort((a, b) => b.createdAt - a.createdAt).slice(0, -diff);
      for (const p of excess) {
        p.phase = "Terminating";
        p.terminationTicks = 1;
        emit(s, { type: "Normal", reason: "Killing", involvedObject: { kind: "Pod", name: p.name, id: p.id }, message: `excess replica` });
      }
    }
  }
  return s;
}

// ---------- DaemonSet controller ----------
// Ensures exactly one pod per Ready worker. DaemonSet pods are pinned directly
// to their node (bypassing the capacity-based scheduler, like real node agents).

function reconcileDaemonSets(s: EngineState): EngineState {
  for (const ds of s.daemonSets) {
    const readyWorkers = s.nodes.filter((n) => n.role === "worker" && n.status === "Ready");
    for (const node of readyWorkers) {
      const has = s.pods.some((p) => p.ownerRef === ds.id && p.nodeId === node.id && p.phase !== "Terminating");
      if (has) continue;
      const pod: K8sPod = {
        id: nextId("pod"),
        name: podNameFor(ds.name, ds.templateHash),
        namespace: ds.namespace,
        ownerKind: "DaemonSet",
        ownerRef: ds.id,
        deploymentId: null,
        nodeId: node.id, // pinned
        phase: "Pending",
        restartCount: 0,
        containers: [{ name: ds.name, image: ds.image, ready: false, requests: ds.requests ?? { ...DEFAULT_REQUESTS } }],
        volumes: [],
        templateHash: ds.templateHash,
        createdAt: s.tick,
        phaseTicks: 0,
        terminationTicks: 0,
        failuresInARow: 0,
        backoffTicks: 0,
        flightProgress: 0,
      };
      s.pods.push(pod);
      emit(s, { type: "Normal", reason: "Scheduled", involvedObject: { kind: "Pod", name: pod.name, id: pod.id }, message: `daemon pod on ${node.name}` });
    }
  }
  return s;
}

// ---------- Job controller ----------
// Keeps `completions` pods running until that many reach Succeeded, then stops.

function reconcileJobs(s: EngineState): EngineState {
  for (const job of s.jobs) {
    const own = s.pods.filter((p) => p.ownerRef === job.id);
    job.succeeded = own.filter((p) => p.phase === "Succeeded").length;
    if (job.succeeded >= job.completions) continue;
    const active = own.filter((p) => p.phase !== "Succeeded" && p.phase !== "Terminating").length;
    const needed = job.completions - job.succeeded - active;
    for (let i = 0; i < needed; i++) {
      const pod: K8sPod = {
        id: nextId("pod"),
        name: podNameFor(job.name, job.templateHash),
        namespace: job.namespace,
        ownerKind: "Job",
        ownerRef: job.id,
        deploymentId: null,
        nodeId: null, // scheduled normally
        phase: "Pending",
        restartCount: 0,
        containers: [{ name: job.name, image: job.image, ready: false, requests: job.requests ?? { ...DEFAULT_REQUESTS } }],
        volumes: [],
        templateHash: job.templateHash,
        createdAt: s.tick,
        phaseTicks: 0,
        terminationTicks: 0,
        failuresInARow: 0,
        backoffTicks: 0,
        flightProgress: 0,
      };
      s.pods.push(pod);
      emit(s, { type: "Normal", reason: "Created", involvedObject: { kind: "Pod", name: pod.name, id: pod.id }, message: `job pod (pending scheduling)` });
    }
  }
  return s;
}

// ---------- CronJob controller ----------
// Spawns a fresh Job every `schedule` ticks.

function reconcileCronJobs(s: EngineState): EngineState {
  for (const cj of s.cronJobs) {
    if (s.tick - cj.lastScheduledTick < cj.schedule) continue;
    cj.lastScheduledTick = s.tick;
    const job: K8sJob = {
      id: nextId("job"),
      name: `${cj.name}-${s.tick}`,
      namespace: cj.namespace,
      image: cj.image,
      color: cj.color,
      templateHash: templateHashFor(cj.image),
      completions: cj.completions,
      succeeded: 0,
      requests: cj.requests,
    };
    s.jobs.push(job);
    emit(s, { type: "Normal", reason: "SuccessfulCreate", involvedObject: { kind: "CronJob", name: cj.name, id: cj.id }, message: `created job ${job.name}` });

    // successfulJobsHistoryLimit: keep only the most recent N Jobs from this
    // CronJob; terminate older ones (and let the kubelet GC their pods) so a
    // long-running CronJob demo doesn't accumulate Succeeded pods forever.
    const HISTORY_LIMIT = 3;
    const mine = s.jobs.filter((j) => j.name.startsWith(`${cj.name}-`));
    if (mine.length > HISTORY_LIMIT) {
      const stale = mine.slice(0, mine.length - HISTORY_LIMIT);
      const staleIds = new Set(stale.map((j) => j.id));
      for (const p of s.pods) if (p.ownerRef && staleIds.has(p.ownerRef) && p.phase !== "Terminating") { p.phase = "Terminating"; p.terminationTicks = 1; }
      s.jobs = s.jobs.filter((j) => !staleIds.has(j.id));
    }
  }
  return s;
}

// ---------- Scheduler ----------

function scheduler(s: EngineState): EngineState {
  for (const p of s.pods) {
    if (p.phase !== "Pending" || p.nodeId !== null) continue;
    const result = findFittingNode(s, p);
    if ("reason" in result) {
      // emit only when the pod first becomes unschedulable / the reason changes,
      // so a permanently-Pending pod doesn't spam the event log every tick
      if (p.pendingReason !== result.reason) {
        emit(s, { type: "Warning", reason: "FailedScheduling", involvedObject: { kind: "Pod", name: p.name, id: p.id }, message: result.reason });
      }
      p.pendingReason = result.reason;
      continue;
    }
    p.nodeId = result.node.id;
    p.pendingReason = undefined;
    p.flightProgress = 0;
    emit(s, { type: "Normal", reason: "Scheduled", involvedObject: { kind: "Pod", name: p.name, id: p.id }, message: `assigned to ${result.node.name}` });
  }
  return s;
}

// ---------- Kubelet ----------

function setPhase(s: EngineState, p: K8sPod, phase: PodPhase, reason: string, msg: string) {
  p.phase = phase;
  p.phaseTicks = 0;
  emit(s, { type: phase === "Failed" || phase === "CrashLoopBackOff" ? "Warning" : "Normal", reason, involvedObject: { kind: "Pod", name: p.name, id: p.id }, message: msg });
}

function kubelet(s: EngineState): EngineState {
  for (const p of s.pods) {
    if (!p.nodeId) continue;
    const node = s.nodes.find((n) => n.id === p.nodeId);
    if (!node || node.status === "NotReady") continue;

    p.phaseTicks += 1;

    if (p.phase === "Pending") {
      // wait until flight reaches the node before starting
      if (p.flightProgress < 1) continue;
      // if any required PVC is not bound, stay Pending and emit an occasional warning
      const claims = pvcsForPod(s, p);
      const unbound = claims.filter((c) => c.status !== "Bound");
      if (unbound.length) {
        p.pendingReason = "WaitingForPVC";
        if (p.phaseTicks % 5 === 0) {
          emit(s, { type: "Warning", reason: "FailedAttachVolume", involvedObject: { kind: "Pod", name: p.name, id: p.id }, message: `waiting for PVC: ${unbound.map((c) => c.name).join(", ")}` });
        }
        continue;
      }
      p.pendingReason = undefined;
      setPhase(s, p, "ContainerCreating", "Pulling", `pulling ${p.containers[0]?.image}`);
      continue;
    }
    if (p.phase === "ContainerCreating") {
      if (p.phaseTicks >= 2) {
        for (const c of p.containers) c.ready = true;
        setPhase(s, p, "Running", "Started", `containers ready`);
        p.failuresInARow = 0;
      }
      continue;
    }
    if (p.phase === "Running") {
      // Job pods run to completion instead of staying up forever
      if (p.ownerKind === "Job" && p.phaseTicks >= 3) {
        for (const c of p.containers) c.ready = false;
        setPhase(s, p, "Succeeded", "Completed", `job container finished`);
      }
      continue;
    }
    if (p.phase === "Terminating") {
      p.terminationTicks -= 1;
      continue;
    }
    if (p.phase === "Failed") {
      p.failuresInARow += 1;
      if (p.failuresInARow >= 3) {
        setPhase(s, p, "CrashLoopBackOff", "BackOff", `crash loop`);
        p.backoffTicks = 4;
      } else {
        p.restartCount += 1;
        for (const c of p.containers) c.ready = false;
        setPhase(s, p, "ContainerCreating", "Pulling", `restarting`);
      }
      continue;
    }
    if (p.phase === "CrashLoopBackOff") {
      p.backoffTicks -= 1;
      if (p.backoffTicks <= 0) {
        p.restartCount += 1;
        for (const c of p.containers) c.ready = false;
        setPhase(s, p, "ContainerCreating", "Pulling", `back-off retry`);
      }
      continue;
    }
  }

  s.pods = s.pods.filter((p) => {
    if (p.phase !== "Terminating") return true;
    if (p.terminationTicks <= 0) {
      emit(s, { type: "Normal", reason: "Killed", involvedObject: { kind: "Pod", name: p.name, id: p.id }, message: `removed` });
      return false;
    }
    return true;
  });
  return s;
}

// ---------- Pod flight ----------

function advanceFlights(s: EngineState): EngineState {
  for (const p of s.pods) {
    if (p.flightProgress < 1 && p.nodeId) {
      p.flightProgress = Math.min(1, p.flightProgress + 0.5);
    }
  }
  return s;
}

// ---------- Service controller ----------

function reconcileServices(s: EngineState): EngineState {
  for (const sv of s.services) {
    const matching = s.pods
      .filter((p) => p.deploymentId === sv.selector.deploymentId && isAvailable(p))
      .map((p) => p.id)
      .sort();
    const same = matching.length === sv.endpoints.length && matching.every((id, i) => sv.endpoints[i] === id);
    if (!same) sv.endpoints = matching;
  }
  return s;
}

// ---------- Failure injection (used by scenarios) ----------

export function injectPodFailure(s: EngineState, podId: string): EngineState {
  const p = s.pods.find((x) => x.id === podId);
  if (!p) return s;
  p.containers.forEach((c) => (c.ready = false));
  setPhase(s, p, "Failed", "Liveness", `liveness probe failed`);
  return s;
}

export function injectNodeFailure(s: EngineState, nodeId: string): EngineState {
  const n = s.nodes.find((x) => x.id === nodeId);
  if (!n) return s;
  n.status = "NotReady";
  for (const p of s.pods) {
    if (p.nodeId === nodeId && p.phase !== "Terminating") {
      p.phase = "Terminating";
      p.terminationTicks = 2;
    }
  }
  return emit(s, { type: "Warning", reason: "NodeNotReady", involvedObject: { kind: "Node", name: n.name, id: n.id }, message: `node went NotReady` });
}
