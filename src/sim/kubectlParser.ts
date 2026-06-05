import type { Action, ClusterSnapshot, DeploymentSpec, K8sNode, K8sPod, Resources } from "../state/clusterStore";
import { DEFAULT_REQUESTS } from "../state/clusterStore";

/** Sum of a pod's container requests (defaults applied), mirroring the engine. */
function podReq(p: K8sPod): Resources {
  if (!p.containers.length) return DEFAULT_REQUESTS;
  return p.containers.reduce(
    (acc, c) => {
      const r = c.requests ?? DEFAULT_REQUESTS;
      return { cpu: acc.cpu + r.cpu, mem: acc.mem + r.mem };
    },
    { cpu: 0, mem: 0 },
  );
}

/** cpu/mem committed to a node by its non-terminating pods. */
function allocatedOn(pods: K8sPod[], nodeId: string): Resources {
  return pods
    .filter((p) => p.nodeId === nodeId && p.phase !== "Terminating")
    .reduce((acc, p) => { const r = podReq(p); return { cpu: acc.cpu + r.cpu, mem: acc.mem + r.mem }; }, { cpu: 0, mem: 0 });
}

export interface KubectlOutput {
  /** Lines to render in the terminal (already split). */
  lines: string[];
  /** Action(s) to enqueue, if any. */
  actions: Action[];
  /** If set, the command should keep watching the store and re-render until cancelled. */
  watch?: () => string[];
}

const help = [
  "kubectl supports (in this simulator):",
  "  get [pods|nodes|deployments|rs|daemonsets|jobs|cronjobs|hpa|services|events|pv|pvc|cm|secret|ingress|egress|ns] [-w] [-n NAMESPACE | -A]",
  "  describe pod|node NAME [-n NAMESPACE]",
  "  delete pod|deployment|pvc|svc|ingress NAME [-n NAMESPACE]",
  "  scale deployment NAME --replicas=N [-n NAMESPACE]",
  "  set image deployment/NAME container=IMAGE",
  "  rollout status|undo deployment/NAME",
  "  autoscale deployment NAME --min=N --max=M --cpu-percent=P",
  "  load deployment/NAME PERCENT   (sim only: inject CPU load to drive the HPA)",
  "  apply -f PRESET   (presets: redis, cache, hello, db, config, web, node-exporter, backup, report)",
  "  expose deployment NAME --port=80 [--type=ClusterIP|NodePort|LoadBalancer] [-n NAMESPACE]",
  "  drain|cordon|uncordon node NAME",
  "  create namespace NAME",
  "  delete namespace NAME",
  "  create node [NAME]   (joins a new worker)",
  "  delete node NAME     (evicts pods + removes worker)",
  "  scenario list | scenario run NAME",
];

const PRESETS: Record<string, () => Action[]> = {
  // each entry returns a list of Actions to enqueue. Inline data objects use
  // explicit Record<string,string> typing where needed.
  redis: () => [{ type: "ApplyDeployment", spec: { name: "redis", replicas: 1, image: "redis:7", color: "#ef4444" } }],
  cache: () => [{ type: "ApplyDeployment", spec: { name: "cache", replicas: 3, image: "memcached:1.6", color: "#f59e0b" } }],
  hello: () => [{ type: "ApplyDeployment", spec: { name: "hello", replicas: 2, image: "hello-world:1.0", color: "#10b981" } }],
  db: () => [
    { type: "ApplyPV", spec: { name: "pv-db-20gi", capacityGi: 20, storageClass: "fast" } },
    { type: "ApplyPVC", spec: { name: "db-data", namespace: "apps", capacityGi: 10, storageClass: "fast" } },
    { type: "ApplyDeployment", spec: { name: "postgres", namespace: "apps", replicas: 1, image: "postgres:16", color: "#10b981", volumeClaims: ["db-data"] } },
  ],
  config: () => [
    { type: "ApplyConfigMap", spec: { name: "demo-config", data: { ENV: "prod", REGION: "eu-west-1" } as Record<string, string> } },
    { type: "ApplySecret", spec: { name: "demo-secret", data: { token: "***" } as Record<string, string> } },
  ],
  web: () => [
    { type: "ApplyService", spec: { name: "frontend-svc", deploymentName: "frontend", type: "LoadBalancer" } },
    { type: "ApplyIngress", spec: { name: "web", host: "k8scube.local", serviceName: "frontend-svc" } },
  ],
  "node-exporter": () => [
    { type: "ApplyDaemonSet", spec: { name: "node-exporter", image: "node-exporter:1.7", color: "#22d3ee", requests: { cpu: 100, mem: 128 } } },
  ],
  backup: () => [
    { type: "ApplyJob", spec: { name: "db-backup", namespace: "apps", image: "backup:1.0", color: "#a855f7", completions: 3 } },
  ],
  report: () => [
    { type: "ApplyCronJob", spec: { name: "nightly-report", image: "report:1.0", color: "#a855f7", schedule: 20, completions: 1 } },
  ],
  payments: () => [
    { type: "ApplyEgressTarget", spec: { name: "stripe-api", host: "api.stripe.com", protocol: "https", usedBy: ["backend"] } },
  ],
  observability: () => [
    { type: "ApplyEgressTarget", spec: { name: "datadog", host: "agent.datadoghq.com", protocol: "https", usedBy: ["backend", "frontend"] } },
  ],
};

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}

function ageString(tickNow: number, createdAt: number): string {
  const dt = tickNow - createdAt;
  if (dt < 0) return "0s";
  if (dt < 60) return `${dt}t`;
  return `${Math.floor(dt / 60)}m${dt % 60}t`;
}

interface NsScope { ns?: string; all?: boolean }

function nsScopeFromTokens(tokens: string[]): { scope: NsScope; rest: string[] } {
  const scope: NsScope = {};
  const rest: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-n") { scope.ns = tokens[i + 1]; i++; continue; }
    if (t.startsWith("--namespace=")) { scope.ns = t.split("=")[1]; continue; }
    if (t === "-A" || t === "--all-namespaces") { scope.all = true; continue; }
    rest.push(t);
  }
  return { scope, rest };
}

function inScope<T extends { namespace?: string }>(items: T[], scope: NsScope, defaultNs = "default"): T[] {
  if (scope.all) return items;
  const ns = scope.ns ?? defaultNs;
  return items.filter((x) => x.namespace === ns);
}

// ---------- Renderers ----------

function renderPods(s: ClusterSnapshot & { tick: number }, scope: NsScope): string[] {
  const filtered = inScope(s.pods, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 32)} ${pad("READY", 7)} ${pad("STATUS", 20)} ${pad("RESTARTS", 9)} ${pad("AGE", 7)} ${pad("NODE", 16)}`;
  const rows = filtered.map((p) => {
    const ready = `${p.containers.filter((c) => c.ready).length}/${p.containers.length}`;
    const node = p.nodeId ? s.nodes.find((n) => n.id === p.nodeId)?.name ?? "-" : "<unscheduled>";
    return `${pad(p.namespace, 10)} ${pad(p.name, 32)} ${pad(ready, 7)} ${pad(p.phase, 20)} ${pad(String(p.restartCount), 9)} ${pad(ageString(s.tick, p.createdAt), 7)} ${pad(node, 16)}`;
  });
  return [header, ...rows];
}

function renderNodes(s: ClusterSnapshot): string[] {
  const header = `${pad("NAME", 22)} ${pad("ROLE", 16)} ${pad("STATUS", 12)} ${pad("CPU", 14)} ${pad("MEM", 16)}`;
  const rows = s.nodes.map((n) => {
    const used = allocatedOn(s.pods, n.id);
    const cpu = `${used.cpu}/${n.capacity.cpu}m`;
    const mem = `${used.mem}/${n.capacity.mem}Mi`;
    return `${pad(n.name, 22)} ${pad(n.role, 16)} ${pad(n.status, 12)} ${pad(cpu, 14)} ${pad(mem, 16)}`;
  });
  return [header, ...rows];
}

function describeNode(n: K8sNode, pods: K8sPod[]): string[] {
  const used = allocatedOn(pods, n.id);
  const onNode = pods.filter((p) => p.nodeId === n.id && p.phase !== "Terminating");
  const cpuPct = Math.round((used.cpu / n.capacity.cpu) * 100);
  const memPct = Math.round((used.mem / n.capacity.mem) * 100);
  return [
    `Name:        ${n.name}`,
    `Role:        ${n.role}`,
    `Status:      ${n.status}`,
    `Capacity:    cpu ${n.capacity.cpu}m, mem ${n.capacity.mem}Mi`,
    `Allocated:   cpu ${used.cpu}m (${cpuPct}%), mem ${used.mem}Mi (${memPct}%)`,
    `Pods:        ${onNode.length}`,
    ...onNode.map((p) => `  - ${p.name} (${p.phase})`),
  ];
}

function renderDeployments(s: ClusterSnapshot, scope: NsScope): string[] {
  const filtered = inScope(s.deployments, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 18)} ${pad("READY", 7)} ${pad("UP-TO-DATE", 12)} ${pad("STRATEGY", 14)} ${pad("IMAGE", 24)}`;
  const rows = filtered.map((d) => {
    const ownPods = s.pods.filter((p) => p.deploymentId === d.id);
    const ready = ownPods.filter((p) => p.phase === "Running" && p.containers.every((c) => c.ready)).length;
    const upto = ownPods.filter((p) => p.templateHash === d.templateHash).length;
    return `${pad(d.namespace, 10)} ${pad(d.name, 18)} ${pad(`${ready}/${d.desiredReplicas}`, 7)} ${pad(String(upto), 12)} ${pad(d.strategy.type, 14)} ${pad(d.image, 24)}`;
  });
  return [header, ...rows];
}

function renderServices(s: ClusterSnapshot, scope: NsScope): string[] {
  const filtered = inScope(s.services, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 22)} ${pad("TYPE", 14)} ${pad("SELECTOR", 24)} ${pad("ENDPOINTS", 8)}`;
  const rows = filtered.map((sv) => {
    const sel = `deployment=${s.deployments.find((d) => d.id === sv.selector.deploymentId)?.name ?? "-"}`;
    return `${pad(sv.namespace, 10)} ${pad(sv.name, 22)} ${pad(sv.type, 14)} ${pad(sel, 24)} ${pad(String(sv.endpoints.length), 8)}`;
  });
  return [header, ...rows];
}

function renderRS(s: ClusterSnapshot): string[] {
  const header = `${pad("NAME", 22)} ${pad("DEPLOY", 16)} ${pad("DESIRED", 8)} ${pad("CURRENT", 8)} ${pad("HASH", 8)}`;
  const rows = s.replicaSets.map((r) => {
    const dep = s.deployments.find((d) => d.id === r.deploymentId)?.name ?? "-";
    const cur = s.pods.filter((p) => p.ownerRef === r.id && p.phase !== "Terminating").length;
    return `${pad(r.id, 22)} ${pad(dep, 16)} ${pad(String(r.desiredReplicas), 8)} ${pad(String(cur), 8)} ${pad(r.templateHash, 8)}`;
  });
  return [header, ...rows];
}

function renderDaemonSets(s: ClusterSnapshot, scope: NsScope): string[] {
  const filtered = inScope(s.daemonSets, scope);
  const workers = s.nodes.filter((n) => n.role === "worker").length;
  const header = `${pad("NS", 10)} ${pad("NAME", 20)} ${pad("DESIRED", 8)} ${pad("READY", 7)} ${pad("IMAGE", 24)}`;
  const rows = filtered.map((d) => {
    const own = s.pods.filter((p) => p.ownerRef === d.id && p.phase !== "Terminating");
    const ready = own.filter((p) => p.phase === "Running").length;
    return `${pad(d.namespace, 10)} ${pad(d.name, 20)} ${pad(String(workers), 8)} ${pad(`${ready}/${own.length}`, 7)} ${pad(d.image, 24)}`;
  });
  return [header, ...rows];
}

function renderJobs(s: ClusterSnapshot, scope: NsScope): string[] {
  const filtered = inScope(s.jobs, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 24)} ${pad("COMPLETIONS", 12)} ${pad("ACTIVE", 7)} ${pad("IMAGE", 24)}`;
  const rows = filtered.map((j) => {
    const own = s.pods.filter((p) => p.ownerRef === j.id);
    const succeeded = own.filter((p) => p.phase === "Succeeded").length;
    const active = own.filter((p) => p.phase !== "Succeeded" && p.phase !== "Terminating").length;
    return `${pad(j.namespace, 10)} ${pad(j.name, 24)} ${pad(`${succeeded}/${j.completions}`, 12)} ${pad(String(active), 7)} ${pad(j.image, 24)}`;
  });
  return [header, ...rows];
}

function renderCronJobs(s: ClusterSnapshot & { tick: number }, scope: NsScope): string[] {
  const filtered = inScope(s.cronJobs, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 20)} ${pad("SCHEDULE", 14)} ${pad("LAST", 10)} ${pad("IMAGE", 24)}`;
  const rows = filtered.map((c) => {
    const last = c.lastScheduledTick > 0 ? `${s.tick - c.lastScheduledTick}t ago` : "never";
    return `${pad(c.namespace, 10)} ${pad(c.name, 20)} ${pad(`every ${c.schedule}t`, 14)} ${pad(last, 10)} ${pad(c.image, 24)}`;
  });
  return [header, ...rows];
}

function renderHPA(s: ClusterSnapshot, scope: NsScope): string[] {
  const filtered = inScope(s.hpas, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 18)} ${pad("TARGET", 18)} ${pad("MINPODS", 8)} ${pad("MAXPODS", 8)} ${pad("REPLICAS", 9)} ${pad("CPU%/TGT", 12)}`;
  const rows = filtered.map((h) => {
    const dep = s.deployments.find((d) => d.name === h.targetDeployment && d.namespace === h.namespace);
    const replicas = dep ? dep.desiredReplicas : 0;
    const cpu = `${dep?.load ?? 0}/${h.targetCpuPercent}`;
    return `${pad(h.namespace, 10)} ${pad(h.name, 18)} ${pad(`Deployment/${h.targetDeployment}`, 18)} ${pad(String(h.minReplicas), 8)} ${pad(String(h.maxReplicas), 8)} ${pad(String(replicas), 9)} ${pad(cpu, 12)}`;
  });
  return [header, ...rows];
}

function renderEvents(s: ClusterSnapshot & { tick: number }): string[] {
  const header = `${pad("AGE", 7)} ${pad("TYPE", 8)} ${pad("REASON", 18)} ${pad("OBJECT", 22)} MESSAGE`;
  const rows = s.events.slice(0, 30).map((e) => {
    return `${pad(ageString(s.tick, e.at), 7)} ${pad(e.type, 8)} ${pad(e.reason, 18)} ${pad(`${e.involvedObject.kind}/${e.involvedObject.name}`, 22)} ${e.message}`;
  });
  return [header, ...rows];
}

function renderPVs(s: ClusterSnapshot): string[] {
  const header = `${pad("NAME", 22)} ${pad("CAPACITY", 10)} ${pad("CLASS", 8)} ${pad("STATUS", 12)} CLAIM`;
  const rows = s.pvs.map((v) => {
    const claim = v.boundClaim ? s.pvcs.find((c) => c.id === v.boundClaim)?.name ?? v.boundClaim : "-";
    return `${pad(v.name, 22)} ${pad(`${v.capacityGi}Gi`, 10)} ${pad(v.storageClass, 8)} ${pad(v.status, 12)} ${claim}`;
  });
  return [header, ...rows];
}

function renderPVCs(s: ClusterSnapshot, scope: NsScope): string[] {
  const filtered = inScope(s.pvcs, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 18)} ${pad("STATUS", 10)} ${pad("VOLUME", 22)} ${pad("CAPACITY", 10)} CLASS`;
  const rows = filtered.map((c) => {
    const vol = c.boundVolume ? s.pvs.find((v) => v.id === c.boundVolume)?.name ?? c.boundVolume : "-";
    return `${pad(c.namespace, 10)} ${pad(c.name, 18)} ${pad(c.status, 10)} ${pad(vol, 22)} ${pad(`${c.capacityGi}Gi`, 10)} ${c.storageClass}`;
  });
  return [header, ...rows];
}

function renderConfigMaps(s: ClusterSnapshot, scope: NsScope): string[] {
  const filtered = inScope(s.configMaps, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 22)} DATA`;
  const rows = filtered.map((c) => `${pad(c.namespace, 10)} ${pad(c.name, 22)} ${Object.keys(c.data).length} keys`);
  return [header, ...rows];
}

function renderSecrets(s: ClusterSnapshot, scope: NsScope): string[] {
  const filtered = inScope(s.secrets, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 22)} DATA`;
  const rows = filtered.map((c) => `${pad(c.namespace, 10)} ${pad(c.name, 22)} ${Object.keys(c.data).length} keys (opaque)`);
  return [header, ...rows];
}

function renderIngresses(s: ClusterSnapshot, scope: NsScope): string[] {
  const filtered = inScope(s.ingresses, scope);
  const header = `${pad("NS", 10)} ${pad("NAME", 14)} ${pad("HOST", 22)} SERVICE`;
  const rows = filtered.map((i) => `${pad(i.namespace, 10)} ${pad(i.name, 14)} ${pad(i.host, 22)} ${i.serviceName}`);
  return [header, ...rows];
}

function renderEgressTargets(s: ClusterSnapshot): string[] {
  const header = `${pad("NAME", 18)} ${pad("HOST", 28)} ${pad("PROTO", 8)} USED BY`;
  const rows = s.egressTargets.map((e) => `${pad(e.name, 18)} ${pad(e.host, 28)} ${pad(e.protocol, 8)} ${e.usedBy.join(", ") || "-"}`);
  return [header, ...rows];
}

function renderNamespaces(s: ClusterSnapshot): string[] {
  const header = `${pad("NAME", 18)} POD COUNT  DEPLOY COUNT  SVC COUNT`;
  const rows = s.namespaces.map((n) => {
    const pods = s.pods.filter((p) => p.namespace === n.name).length;
    const deps = s.deployments.filter((d) => d.namespace === n.name).length;
    const svcs = s.services.filter((sv) => sv.namespace === n.name).length;
    return `${pad(n.name, 18)} ${pad(String(pods), 10)} ${pad(String(deps), 13)} ${svcs}`;
  });
  return [header, ...rows];
}

// ---------- Parser ----------

export function parseKubectl(
  raw: string,
  snapshot: ClusterSnapshot & { tick: number },
): KubectlOutput {
  const text = raw.trim();
  if (!text) return { lines: [], actions: [] };

  if (text === "help" || text === "kubectl help" || text === "kubectl --help") {
    return { lines: help, actions: [] };
  }
  if (text === "clear") return { lines: ["__CLEAR__"], actions: [] };

  const tokens = text.split(/\s+/);
  if (tokens[0] === "kubectl") tokens.shift();

  const verb = tokens.shift();
  if (!verb) return { lines: ["?"], actions: [] };

  // ---- get ----
  if (verb === "get") {
    const what = tokens.shift();
    const watch = tokens.includes("-w");
    const { scope } = nsScopeFromTokens(tokens.filter((t) => t !== "-w"));

    const renderFn = (snap: ClusterSnapshot & { tick: number }): string[] => {
      switch (what) {
        case "pods":
        case "po": return renderPods(snap, scope);
        case "nodes":
        case "no": return renderNodes(snap);
        case "deployments":
        case "deploy": return renderDeployments(snap, scope);
        case "services":
        case "svc": return renderServices(snap, scope);
        case "rs":
        case "replicasets": return renderRS(snap);
        case "ds":
        case "daemonset":
        case "daemonsets": return renderDaemonSets(snap, scope);
        case "job":
        case "jobs": return renderJobs(snap, scope);
        case "cronjob":
        case "cronjobs":
        case "cj": return renderCronJobs(snap, scope);
        case "hpa":
        case "horizontalpodautoscaler":
        case "horizontalpodautoscalers": return renderHPA(snap, scope);
        case "events":
        case "ev": return renderEvents(snap);
        case "pv":
        case "persistentvolumes": return renderPVs(snap);
        case "pvc":
        case "persistentvolumeclaims": return renderPVCs(snap, scope);
        case "cm":
        case "configmap":
        case "configmaps": return renderConfigMaps(snap, scope);
        case "secret":
        case "secrets": return renderSecrets(snap, scope);
        case "ingress":
        case "ing": return renderIngresses(snap, scope);
        case "egress":
        case "egresstargets":
        case "et": return renderEgressTargets(snap);
        case "ns":
        case "namespace":
        case "namespaces": return renderNamespaces(snap);
        case undefined: return ["specify a resource"];
        default: return [`unknown resource: ${what}`];
      }
    };
    const lines = renderFn(snapshot);
    return { lines, actions: [], watch: watch ? () => renderFn(snapshot) : undefined };
  }

  // ---- describe ----
  if (verb === "describe") {
    const kind = tokens.shift();
    const name = tokens.shift();
    if ((kind === "node" || kind === "no") && name) {
      const n = snapshot.nodes.find((x) => x.name === name);
      if (!n) return { lines: [`node "${name}" not found`], actions: [] };
      return { lines: describeNode(n, snapshot.pods), actions: [] };
    }
    if (kind !== "pod" || !name) return { lines: ["usage: describe pod|node NAME [-n NAMESPACE]"], actions: [] };
    const { scope } = nsScopeFromTokens(tokens);
    const ns = scope.ns ?? "default";
    const p = snapshot.pods.find((x) => x.name === name && (scope.all || x.namespace === ns));
    if (!p) return { lines: [`pod "${name}" not found`], actions: [] };
    const node = p.nodeId ? snapshot.nodes.find((n) => n.id === p.nodeId)?.name : "<unscheduled>";
    const dep = snapshot.deployments.find((d) => d.id === p.deploymentId);
    return {
      lines: [
        `Name:           ${p.name}`,
        `Namespace:      ${p.namespace}`,
        `Status:         ${p.phase}${p.pendingReason ? ` (${p.pendingReason})` : ""}`,
        `Node:           ${node}`,
        `Owner:          ReplicaSet/${p.ownerRef}`,
        `Deployment:     ${dep?.name ?? "-"}`,
        `Image:          ${p.containers[0]?.image ?? "-"}`,
        `Restart count:  ${p.restartCount}`,
        `Volumes:        ${p.volumes.map((v) => `${v.name} (claim=${v.claimName})`).join(", ") || "-"}`,
        `Template hash:  ${p.templateHash}`,
        `Created at:     tick ${p.createdAt}`,
      ],
      actions: [],
    };
  }

  // ---- delete ----
  if (verb === "delete") {
    const kind = tokens.shift();
    const name = tokens.shift();
    if (!kind || !name) return { lines: ["usage: delete pod|deployment|pvc|svc|ingress|namespace NAME [-n NS]"], actions: [] };
    const { scope } = nsScopeFromTokens(tokens);
    const ns = scope.ns;
    if (kind === "pod" || kind === "po")            return { lines: [`pod "${name}" deletion requested`], actions: [{ type: "DeletePod", name, namespace: ns }] };
    if (kind === "deployment" || kind === "deploy") return { lines: [`deployment "${name}" deletion requested`], actions: [{ type: "DeleteDeployment", name, namespace: ns }] };
    if (kind === "daemonset" || kind === "ds")      return { lines: [`daemonset "${name}" deletion requested`], actions: [{ type: "DeleteDaemonSet", name, namespace: ns }] };
    if (kind === "job" || kind === "jobs")          return { lines: [`job "${name}" deletion requested`], actions: [{ type: "DeleteJob", name, namespace: ns }] };
    if (kind === "cronjob" || kind === "cj")        return { lines: [`cronjob "${name}" deletion requested`], actions: [{ type: "DeleteCronJob", name, namespace: ns }] };
    if (kind === "hpa")                              return { lines: [`hpa "${name}" deletion requested`], actions: [{ type: "DeleteHPA", name, namespace: ns }] };
    if (kind === "pvc")                              return { lines: [`pvc "${name}" deletion requested`], actions: [{ type: "DeletePVC", name, namespace: ns }] };
    if (kind === "svc" || kind === "service")        return { lines: [`service "${name}" deletion requested`], actions: [{ type: "DeleteService", name, namespace: ns }] };
    if (kind === "ingress" || kind === "ing")        return { lines: [`ingress "${name}" deletion requested`], actions: [{ type: "DeleteIngress", name, namespace: ns }] };
    if (kind === "namespace" || kind === "ns")       return { lines: [`namespace "${name}" deletion requested`], actions: [{ type: "DeleteNamespace", name }] };
    if (kind === "node" || kind === "no")            return { lines: [`node "${name}" deletion requested`], actions: [{ type: "DeleteNode", name }] };
    if (kind === "egress" || kind === "et")          return { lines: [`egress target "${name}" deletion requested`], actions: [{ type: "DeleteEgressTarget", name }] };
    return { lines: [`cannot delete ${kind}`], actions: [] };
  }

  // ---- scale ----
  if (verb === "scale") {
    const kindNamePair = tokens.shift();
    if (!kindNamePair) return { lines: ["usage: scale deployment NAME --replicas=N"], actions: [] };
    let name: string | undefined;
    if (kindNamePair.includes("/")) name = kindNamePair.split("/")[1];
    else if (kindNamePair === "deployment" || kindNamePair === "deploy") name = tokens.shift();
    else return { lines: ["usage: scale deployment NAME --replicas=N"], actions: [] };
    if (!name) return { lines: ["missing deployment name"], actions: [] };
    const { scope, rest } = nsScopeFromTokens(tokens);
    const repFlag = rest.find((t) => t.startsWith("--replicas"));
    const m = repFlag?.match(/--replicas[=\s](\d+)/);
    if (!m) return { lines: ["specify --replicas=N"], actions: [] };
    return { lines: [`deployment "${name}" scaled to ${m[1]}`], actions: [{ type: "ScaleDeployment", name, namespace: scope.ns, replicas: parseInt(m[1], 10) }] };
  }

  // ---- set image ----
  if (verb === "set" && tokens[0] === "image") {
    tokens.shift();
    const target = tokens.shift();
    const containerSpec = tokens.shift();
    if (!target || !target.includes("/") || !containerSpec || !containerSpec.includes("=")) {
      return { lines: ["usage: set image deployment/NAME container=IMAGE"], actions: [] };
    }
    const name = target.split("/")[1];
    const image = containerSpec.split("=")[1];
    const { scope } = nsScopeFromTokens(tokens);
    return { lines: [`deployment "${name}" image set to ${image}`], actions: [{ type: "SetImage", deployment: name, namespace: scope.ns, image }] };
  }

  // ---- rollout ----
  if (verb === "rollout") {
    const sub = tokens.shift();
    const target = tokens.shift();
    if (!target || !target.includes("/")) return { lines: ["usage: rollout status|undo deployment/NAME"], actions: [] };
    const name = target.split("/")[1];
    const { scope } = nsScopeFromTokens(tokens);
    if (sub === "undo")   return { lines: [`rollback to previous revision queued for ${name}`], actions: [{ type: "RolloutUndo", deployment: name, namespace: scope.ns }] };
    if (sub === "status") {
      const d = snapshot.deployments.find((x) => x.name === name && (scope.ns ? x.namespace === scope.ns : true));
      if (!d) return { lines: [`deployment ${name} not found`], actions: [] };
      const own = snapshot.pods.filter((p) => p.deploymentId === d.id);
      const upto = own.filter((p) => p.templateHash === d.templateHash && p.phase === "Running").length;
      return { lines: [`deployment "${name}": ${upto} of ${d.desiredReplicas} updated replicas available (image ${d.image})`], actions: [] };
    }
    return { lines: [`unknown rollout sub-command: ${sub}`], actions: [] };
  }

  // ---- apply ----
  if (verb === "apply") {
    const f = tokens.indexOf("-f");
    if (f < 0 || !tokens[f + 1]) return { lines: [`usage: apply -f PRESET (presets: ${Object.keys(PRESETS).join(", ")})`], actions: [] };
    const presetName = tokens[f + 1].replace(/\.ya?ml$/, "");
    const builder = PRESETS[presetName];
    if (!builder) return { lines: [`no preset named ${presetName}; available: ${Object.keys(PRESETS).join(", ")}`], actions: [] };
    const actions = builder();
    return { lines: actions.map((a) => `${a.type.replace(/^Apply/, "")} created`), actions };
  }

  // ---- expose ----
  if (verb === "expose") {
    const kind = tokens.shift();
    const name = tokens.shift();
    if (kind !== "deployment" && kind !== "deploy") return { lines: ["usage: expose deployment NAME [--type=...] [--port=80]"], actions: [] };
    if (!name) return { lines: ["missing deployment name"], actions: [] };
    const { scope, rest } = nsScopeFromTokens(tokens);
    const typeFlag = rest.find((t) => t.startsWith("--type="));
    const type = (typeFlag?.split("=")[1] ?? "ClusterIP") as "ClusterIP" | "NodePort" | "LoadBalancer";
    return {
      lines: [`service/${name} created (${type})`],
      actions: [{ type: "ApplyService", spec: { name, namespace: scope.ns, deploymentName: name, type } }],
    };
  }

  // ---- autoscale (creates an HPA) ----
  if (verb === "autoscale") {
    const kind = tokens.shift();
    let name: string | undefined;
    if (kind === "deployment" || kind === "deploy") name = tokens.shift();
    else if (kind && kind.includes("/")) name = kind.split("/")[1];
    if (!name) return { lines: ["usage: autoscale deployment NAME --min=N --max=M --cpu-percent=P"], actions: [] };
    const { scope, rest } = nsScopeFromTokens(tokens);
    const num = (flag: string, dflt: number) => {
      const f = rest.find((t) => t.startsWith(flag));
      const m = f?.match(/=(\d+)/);
      return m ? parseInt(m[1], 10) : dflt;
    };
    const min = num("--min", 1);
    const max = num("--max", Math.max(min, 5));
    const cpu = num("--cpu-percent", 50);
    return {
      lines: [`horizontalpodautoscaler/${name} autoscaled (${min}-${max} pods, target ${cpu}% cpu)`],
      actions: [{ type: "ApplyHPA", spec: { deploymentName: name, namespace: scope.ns, minReplicas: min, maxReplicas: max, targetCpuPercent: cpu } }],
    };
  }

  // ---- load (SIMULATOR ONLY: inject synthetic CPU utilisation for the HPA demo) ----
  if (verb === "load") {
    const t0 = tokens.shift();
    if (!t0) return { lines: ["usage (sim only): load deployment/NAME PERCENT"], actions: [] };
    let name: string | undefined;
    if (t0.includes("/")) name = t0.split("/")[1];
    else if (t0 === "deployment" || t0 === "deploy") name = tokens.shift();
    else name = t0;
    const pct = parseInt(tokens.shift() ?? "", 10);
    if (!name || Number.isNaN(pct)) return { lines: ["usage (sim only): load deployment/NAME PERCENT"], actions: [] };
    const { scope } = nsScopeFromTokens(tokens);
    return { lines: [`synthetic load on ${name} set to ${pct}% cpu`], actions: [{ type: "SetLoad", deployment: name, namespace: scope.ns, load: pct }] };
  }

  // ---- create ----
  if (verb === "create") {
    const kind = tokens.shift();
    const name = tokens.shift();
    if (kind === "namespace" || kind === "ns") {
      if (!name) return { lines: ["usage: create namespace NAME"], actions: [] };
      return { lines: [`namespace/${name} created`], actions: [{ type: "CreateNamespace", name }] };
    }
    if (kind === "node" || kind === "no") {
      return { lines: [`node/${name ?? "(auto)"} joining cluster`], actions: [{ type: "CreateNode", name }] };
    }
    if (kind === "service" || kind === "svc") {
      if (!name) return { lines: ["usage: create service NAME --tcp=PORT --selector=DEPLOY"], actions: [] };
      const { scope } = nsScopeFromTokens(tokens);
      return { lines: [`service/${name} created`], actions: [{ type: "ApplyService", spec: { name, namespace: scope.ns, deploymentName: name, type: "ClusterIP" } }] };
    }
    if (kind === "ingress" || kind === "ing") {
      if (!name) return { lines: ["usage: create ingress NAME --rule=HOST=SVC"], actions: [] };
      const { scope, rest } = nsScopeFromTokens(tokens);
      const ruleFlag = rest.find((t) => t.startsWith("--rule="));
      const m = ruleFlag?.match(/--rule=([^=]+)=(.+)/);
      const host = m?.[1] ?? "k8scube.local";
      const svc = m?.[2] ?? name;
      return { lines: [`ingress/${name} created`], actions: [{ type: "ApplyIngress", spec: { name, namespace: scope.ns, host, serviceName: svc } }] };
    }
    return { lines: [`cannot create ${kind}`], actions: [] };
  }

  // ---- drain / cordon / uncordon ----
  if (verb === "drain" || verb === "cordon" || verb === "uncordon") {
    let name: string | undefined;
    if (tokens[0] === "node") { tokens.shift(); name = tokens.shift(); }
    else { name = tokens.shift(); }
    if (!name) return { lines: [`usage: ${verb} node NAME`], actions: [] };
    if (verb === "drain")   return { lines: [`node "${name}" drained`], actions: [{ type: "DrainNode", node: name }] };
    if (verb === "cordon")  return { lines: [`node "${name}" cordoned`], actions: [{ type: "Cordon", node: name }] };
    return { lines: [`node "${name}" uncordoned`], actions: [{ type: "Uncordon", node: name }] };
  }

  // ---- scenario ----
  if (verb === "scenario") {
    const sub = tokens.shift();
    if (sub === "list") return { lines: ["__SCENARIO_LIST__"], actions: [] };
    if (sub === "run") {
      const name = tokens.shift();
      if (!name) return { lines: ["usage: scenario run NAME"], actions: [] };
      return { lines: [`__SCENARIO_RUN__:${name}`], actions: [] };
    }
    return { lines: ["usage: scenario list | scenario run NAME"], actions: [] };
  }

  return { lines: [`error: unknown command "${verb}". Try: help`], actions: [] };
}

// keep types aligned
export type { DeploymentSpec };
