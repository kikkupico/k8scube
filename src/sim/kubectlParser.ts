import type { Action, ClusterSnapshot, DeploymentSpec } from "../state/clusterStore";

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
  "  get [pods|nodes|deployments|services|rs|events|pv|pvc|cm|secret|ingress|ns] [-w] [-n NAMESPACE | -A]",
  "  describe pod NAME [-n NAMESPACE]",
  "  delete pod|deployment|pvc|svc|ingress NAME [-n NAMESPACE]",
  "  scale deployment NAME --replicas=N [-n NAMESPACE]",
  "  set image deployment/NAME container=IMAGE",
  "  rollout status|undo deployment/NAME",
  "  apply -f PRESET   (presets: redis, cache, hello, db, config, web)",
  "  expose deployment NAME --port=80 [--type=ClusterIP|NodePort|LoadBalancer] [-n NAMESPACE]",
  "  drain|cordon|uncordon node NAME",
  "  create namespace NAME",
  "  delete namespace NAME",
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
  const header = `${pad("NAME", 22)} ${pad("ROLE", 16)} ${pad("STATUS", 12)}`;
  const rows = s.nodes.map((n) => `${pad(n.name, 22)} ${pad(n.role, 16)} ${pad(n.status, 12)}`);
  return [header, ...rows];
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
    if (kind !== "pod" || !name) return { lines: ["usage: describe pod NAME [-n NAMESPACE]"], actions: [] };
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
    if (kind === "pvc")                              return { lines: [`pvc "${name}" deletion requested`], actions: [{ type: "DeletePVC", name, namespace: ns }] };
    if (kind === "svc" || kind === "service")        return { lines: [`service "${name}" deletion requested`], actions: [{ type: "DeleteService", name, namespace: ns }] };
    if (kind === "ingress" || kind === "ing")        return { lines: [`ingress "${name}" deletion requested`], actions: [{ type: "DeleteIngress", name, namespace: ns }] };
    if (kind === "namespace" || kind === "ns")       return { lines: [`namespace "${name}" deletion requested`], actions: [{ type: "DeleteNamespace", name }] };
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

  // ---- create ----
  if (verb === "create") {
    const kind = tokens.shift();
    const name = tokens.shift();
    if (kind === "namespace" || kind === "ns") {
      if (!name) return { lines: ["usage: create namespace NAME"], actions: [] };
      return { lines: [`namespace/${name} created`], actions: [{ type: "CreateNamespace", name }] };
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
