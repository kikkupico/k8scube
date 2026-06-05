/**
 * Headless engine assertions. Run with: npx tsx src/sim/engine.test.ts
 * The engine is pure, so we build an EngineState, enqueue Actions, run step()
 * N times, and assert on the resulting snapshot. No test framework needed.
 */
import { step, type EngineState } from "./engine";
import type { Action, ClusterSnapshot } from "../state/clusterStore";
import { useCluster } from "../state/clusterStore";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
}

function freshState(): EngineState {
  useCluster.getState().resetCluster();
  const c = useCluster.getState();
  const snap: ClusterSnapshot = {
    nodes: c.nodes, namespaces: c.namespaces, deployments: c.deployments,
    replicaSets: c.replicaSets, daemonSets: c.daemonSets, jobs: c.jobs, cronJobs: c.cronJobs, hpas: c.hpas,
    pods: c.pods, services: c.services,
    ingresses: c.ingresses, egressTargets: c.egressTargets, pvs: c.pvs,
    pvcs: c.pvcs, configMaps: c.configMaps, secrets: c.secrets, events: c.events,
  };
  return { ...snap, tick: 0, pendingActions: [] };
}

function run(s: EngineState, ticks: number): EngineState {
  for (let i = 0; i < ticks; i++) s = step(s);
  return s;
}

function enqueue(s: EngineState, ...actions: Action[]): EngineState {
  return { ...s, pendingActions: [...s.pendingActions, ...actions] };
}

// ---- Test 1: baseline cluster stabilises ----
console.log("baseline:");
{
  let s = freshState();
  s = run(s, 6);
  const running = s.pods.filter((p) => p.phase === "Running").length;
  assert(running >= 4, `seed pods reach Running (got ${running})`);
}

// ---- Test 2: self-healing — deleting a pod brings a replacement ----
console.log("self-healing:");
{
  let s = freshState();
  s = run(s, 4);
  const victim = s.pods.find((p) => p.deploymentId === "deploy-fe" && p.phase === "Running")!;
  const beforeCount = s.pods.filter((p) => p.deploymentId === "deploy-fe").length;
  s = enqueue(s, { type: "DeletePod", name: victim.name });
  s = run(s, 8);
  const fe = s.pods.filter((p) => p.deploymentId === "deploy-fe");
  assert(!fe.some((p) => p.name === victim.name), "victim pod is gone");
  assert(fe.length >= beforeCount, `replacement created (now ${fe.length})`);
}

// ---- Test 3 (Phase 1): over-request -> pod stays Pending with FailedScheduling ----
console.log("phase1 unschedulable:");
{
  let s = freshState();
  s = enqueue(s, { type: "ApplyDeployment", spec: { name: "hungry", replicas: 5, image: "stress:1.0", requests: { cpu: 3000, mem: 1024 } } });
  s = run(s, 12);
  const hungry = s.pods.filter((p) => p.deploymentId && s.deployments.find((d) => d.id === p.deploymentId)?.name === "hungry");
  const pending = hungry.filter((p) => p.phase === "Pending");
  const scheduled = hungry.filter((p) => p.nodeId !== null);
  assert(pending.length > 0, `some hungry pods stuck Pending (${pending.length} pending)`);
  assert(scheduled.length <= 3, `at most one 3-core pod per 4-core worker scheduled (${scheduled.length})`);
  assert(s.events.some((e) => e.reason === "FailedScheduling" && /Insufficient/.test(e.message)), "FailedScheduling Insufficient event emitted");
}

// ---- Test 4 (Phase 1): adding a node unblocks a pending pod ----
console.log("phase1 add-node unblocks:");
{
  let s = freshState();
  s = enqueue(s, { type: "ApplyDeployment", spec: { name: "hungry", replicas: 5, image: "stress:1.0", requests: { cpu: 3000, mem: 1024 } } });
  s = run(s, 12);
  const pendingBefore = s.pods.filter((p) => p.phase === "Pending").length;
  s = enqueue(s, { type: "CreateNode", name: "extra-node" }, { type: "CreateNode", name: "extra-node-2" });
  s = run(s, 12);
  const pendingAfter = s.pods.filter((p) => p.phase === "Pending").length;
  assert(pendingAfter < pendingBefore, `pending count dropped after adding nodes (${pendingBefore} -> ${pendingAfter})`);
}

// ---- Test 5 (Phase 2): DaemonSet runs one pod per worker, tracks node count ----
console.log("phase2 daemonset:");
{
  let s = freshState();
  const workers = s.nodes.filter((n) => n.role === "worker").length;
  s = enqueue(s, { type: "ApplyDaemonSet", spec: { name: "node-exporter", image: "ne:1", requests: { cpu: 100, mem: 128 } } });
  s = run(s, 8);
  const ds = s.daemonSets[0];
  const dsPods = s.pods.filter((p) => p.ownerRef === ds.id && p.phase !== "Terminating");
  assert(dsPods.length === workers, `one daemon pod per worker (${dsPods.length}/${workers})`);
  assert(dsPods.every((p) => p.nodeId !== null), "every daemon pod is pinned to a node");
  // add a node -> daemonset expands
  s = enqueue(s, { type: "CreateNode", name: "extra" });
  s = run(s, 6);
  const after = s.pods.filter((p) => p.ownerRef === ds.id && p.phase !== "Terminating").length;
  assert(after === workers + 1, `daemon pods follow new node (${after})`);
}

// ---- Test 6 (Phase 2): Job runs to completion and does not over-create ----
console.log("phase2 job:");
{
  let s = freshState();
  s = enqueue(s, { type: "ApplyJob", spec: { name: "backup", namespace: "apps", image: "b:1", completions: 3 } });
  s = run(s, 20);
  const job = s.jobs[0];
  const own = s.pods.filter((p) => p.ownerRef === job.id);
  const succeeded = own.filter((p) => p.phase === "Succeeded").length;
  assert(job.succeeded === 3, `job records 3 completions (got ${job.succeeded})`);
  assert(succeeded === 3, `exactly 3 pods Succeeded (got ${succeeded})`);
  assert(own.every((p) => p.phase === "Succeeded"), "no extra pods left running");
  // running further must not create more pods
  const countBefore = own.length;
  s = run(s, 8);
  const countAfter = s.pods.filter((p) => p.ownerRef === job.id).length;
  assert(countAfter === countBefore, `completed job creates no more pods (${countBefore} -> ${countAfter})`);
}

// ---- Test 7 (Phase 2): CronJob spawns a Job on schedule ----
console.log("phase2 cronjob:");
{
  let s = freshState();
  s = enqueue(s, { type: "ApplyCronJob", spec: { name: "report", image: "r:1", schedule: 5, completions: 1 } });
  s = run(s, 1);
  const jobsAfter1 = s.jobs.length;
  s = run(s, 7); // cross the schedule boundary
  const jobsAfter8 = s.jobs.length;
  assert(jobsAfter8 > jobsAfter1, `cronjob spawned a job after its schedule (${jobsAfter1} -> ${jobsAfter8})`);
  // history limit: leaving it running must not accumulate jobs without bound
  s = run(s, 60);
  const cjJobs = s.jobs.filter((j) => j.name.startsWith("report-")).length;
  assert(cjJobs <= 3, `cronjob keeps only recent jobs (history limit), got ${cjJobs}`);
}

// ---- Test 8 (Phase 3): readiness gate drops a pod from Service endpoints ----
console.log("phase3 readiness:");
{
  let s = freshState();
  s = run(s, 3);
  const svc = s.services.find((x) => x.name === "frontend-svc")!;
  const pod = s.pods.find((p) => p.deploymentId === "deploy-fe" && p.phase === "Running")!;
  assert(svc.endpoints.includes(pod.id), "pod starts in Service endpoints");
  s = enqueue(s, { type: "SetReadiness", name: pod.name, namespace: pod.namespace, ready: false });
  s = run(s, 2);
  const svc2 = s.services.find((x) => x.name === "frontend-svc")!;
  const pod2 = s.pods.find((p) => p.id === pod.id)!;
  assert(!svc2.endpoints.includes(pod.id), "unready pod removed from endpoints");
  assert(pod2.phase === "Running", "but pod is still Running (not restarted)");
  s = enqueue(s, { type: "SetReadiness", name: pod.name, namespace: pod.namespace, ready: true });
  s = run(s, 2);
  const svc3 = s.services.find((x) => x.name === "frontend-svc")!;
  assert(svc3.endpoints.includes(pod.id), "pod returns to endpoints once ready");
}

// ---- Test 9 (Phase 3): liveness failure restarts the container in place ----
console.log("phase3 liveness:");
{
  let s = freshState();
  s = run(s, 3);
  const pod = s.pods.find((p) => p.deploymentId === "deploy-be" && p.phase === "Running")!;
  const id = pod.id;
  s = enqueue(s, { type: "FailLiveness", name: pod.name, namespace: pod.namespace });
  s = run(s, 6);
  const same = s.pods.find((p) => p.id === id);
  assert(!!same, "same pod id persists (restarted in place, not replaced)");
  assert((same?.restartCount ?? 0) >= 1, `restart count incremented (${same?.restartCount})`);
  assert(same?.phase === "Running", "pod recovered to Running");
}

// ---- Test 10 (Phase 3): HPA scales up under load and back down ----
console.log("phase3 autoscale:");
{
  let s = freshState();
  s = run(s, 3);
  s = enqueue(s,
    { type: "ApplyHPA", spec: { deploymentName: "frontend", minReplicas: 2, maxReplicas: 6, targetCpuPercent: 50 } },
    { type: "SetLoad", deployment: "frontend", load: 160 },
  );
  s = run(s, 12);
  const depUp = s.deployments.find((d) => d.name === "frontend")!;
  assert(depUp.desiredReplicas > 2, `HPA scaled up under 160% load (replicas=${depUp.desiredReplicas})`);
  assert(depUp.desiredReplicas <= 6, "respects maxReplicas");
  assert(s.events.some((e) => e.reason === "SuccessfulRescale"), "SuccessfulRescale event emitted");
  s = enqueue(s, { type: "SetLoad", deployment: "frontend", load: 5 });
  s = run(s, 12);
  const depDown = s.deployments.find((d) => d.name === "frontend")!;
  assert(depDown.desiredReplicas === 2, `HPA scaled back to minReplicas under low load (${depDown.desiredReplicas})`);
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
