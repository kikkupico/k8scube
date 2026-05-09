# K8SCUBE — Improvement Plan

This plan upgrades K8SCUBE from a static cluster diagram into a richer, more believable
Kubernetes learning toy. It covers three dimensions:

1. **Visual upgrade** — racked-server nodes, capsule-style pods, richer Tron skin.
2. **Simulation upgrade** — a real reconcile loop, kubectl shell, rolling deploys, self-healing.
3. **Pedagogy upgrade** — scenarios, event log, time controls, guided tours.

It is structured as **phases**, each phase shippable on its own. An implementing agent
can pick up any phase without having read the others; cross-references use file paths
and IDs that already exist (or will exist after a named phase).

---

## 0. Constraints to preserve

- **Tron aesthetic** stays. Dark `#020617` background, neon edges, glowing accents,
  monospace UI font (`JetBrains Mono`). No skeuomorphic textures, no gradients that
  fight the existing palette. Add detail through *geometry and emissive lines*, not
  through PBR materials.
- **R3F + Three.js + zustand + drei** stack stays. No new big deps unless called out.
- **Cube layout stays**: the six faces and `FACE_TRANSFORM` (`src/scene/faceTransform.ts`)
  are load-bearing; do not change face IDs, positions, or rotations.
- **Content schema stays compatible**: `FaceMeta` colors are referenced widely; when
  adding fields, add — don't rename.
- **Performance budget**: 60 fps on a mid laptop, 30 fps on a phone. Use
  `<Instances>`/`InstancedMesh` for any prop with >8 copies (rack units, pod swarms,
  flow particles).
- **Reduced-motion**: respect `prefers-reduced-motion` everywhere — animations should
  shorten or fall back to instant transitions, never silently keep moving.

---

## Phase 1 — Visual: racked servers and capsule pods

The current `NodesFace` (`src/scene/faces/NodesFace.tsx`) and `PodsFace`
(`src/scene/faces/PodsFace.tsx`) render flat boxes. Replace them with proper
3D props that read like the reference image while staying low-poly Tron.

### 1.1 RackServer prop (new component)

**File:** `src/scene/props/RackServer.tsx`

A worker node renders as a 1U-style 19-inch rack chassis seen at a slight angle
on the Nodes face.

Geometry:
- Chassis: `RoundedBox` with bevel `0.012`, dimensions roughly `0.95 × 0.18 × 0.32`
  (W × H × D in face-local space).
- Front bezel: thinner inset plane with a gridded pattern of small extruded boxes
  (drive bays / vents).
- Status LED row: 3 tiny `<mesh>`es on the right of the bezel — power (green),
  activity (cyan, blinks via `useFrame` sin), fault (red, only visible if
  `node.status !== "Ready"`).
- Mount ears: two thin extruded rectangles on the left/right, color `#1e293b`,
  emissive cyan at low intensity.

Material:
- `meshStandardMaterial` color `#0b1220`, roughness `0.35`, metalness `0.85`.
- `<Edges>` from drei at `threshold={20}` colored with face accent (`#3b82f6`)
  and emissive — this is the Tron silhouette.
- Optional: subtle `emissiveIntensity` boost when `isActive`.

Stacking:
- A node is rendered as **a stack of N RackServers** where N corresponds visually
  to "available capacity". Suggested rule: `N = max(2, podsScheduled[nodeId] + 1)`
  capped at 5. Stack vertically with `0.02` gap.
- Wrap the whole stack in an `<Interactable>` that selects the node entity.
- Spacing between nodes on the face: `0.55` horizontally, `0.05` vertical
  base offset. With three workers, lay out across the face in a single row.

Variants:
- Control-plane nodes get a **wider chassis** (`1.2 × 0.22 × 0.36`), a
  **second LED row** (etcd / api / scheduler / controller-manager), and a
  hostname plate that reads "CONTROL PLANE — N1". Use the control-plane
  accent (`#f59e0b`) for edges.

### 1.2 PodCapsule prop (new component)

**File:** `src/scene/props/PodCapsule.tsx`

A pod renders as a small capsule (cylinder + two hemispheres) standing on the
Pods face — visually a "pea pod / container pod" cue, not a server.

Geometry:
- Body: `CapsuleGeometry(radius=0.09, length=0.22, capSegments=6, radialSegments=12)`,
  oriented so the long axis is vertical on the face.
- One or more **container slots** drawn as thin bands (`TorusGeometry` rings) around
  the capsule, one band per container in the pod (default 1, support up to 3).
- A small "handle" loop on top (looks like a pill capsule attachment) — a thin
  `TorusGeometry` segment.

Material:
- Body: `meshStandardMaterial` colored from `deployment.color`, roughness `0.25`,
  metalness `0.7`, emissive same color, `emissiveIntensity` modulated by status:
  - `Pending`: 0.15 + slow pulse
  - `ContainerCreating`: 0.4 + faster pulse (also rotate body slowly on Y)
  - `Running`: 0.55 steady
  - `Failed` / `CrashLoopBackOff`: 0.2 + red flicker (use `Math.random() < 0.2`
    each frame to flip emissive to `#ef4444`)
  - `Terminating`: scale lerp toward 0 over ~0.6s, then unmount

Layout on Pods face:
- Pods are grouped by deployment. Each deployment occupies a horizontal band on
  the face. Within a band, capsules sit on a small "shelf" (a flat `RoundedBox`
  rendered behind them). The shelf has the deployment name engraved via
  `<Text>` along its front edge.
- Use `<Instances>` if any deployment exceeds 8 replicas.

### 1.3 Connector lines: pod-to-node

When a pod is selected, draw a thin glowing line from the pod (on the Pods face,
right side of the cube) curving around the corner to its scheduled node (on the
Nodes face, front side of the cube). Use a `CatmullRomCurve3` with three
control points so it bows around the cube's right-front edge. Reuse the
`<Line>` and curve sampling from `src/modes/Flow.tsx`.

### 1.4 Cube body refresh

`src/scene/Cube.tsx` currently renders a single `RoundedBox`. Add:
- Six **panel insets** — for each face, render a slightly recessed plane
  `0.005` units inboard so the existing children sit *inside* a frame, like a
  server panel cutout. Use a darker color and a brighter cyan border edge.
- Optional **island base**: a thin disc or hex platform 1.2 units below the
  cube (`PolyhedronGeometry` for hex), edge-lit cyan. Behind a feature flag
  `enableIslandBase` in `src/state/store.ts` (default off so first deploy stays
  recognisable).

### 1.5 Lighting and post

Keep current lights but add:
- A single **rim spotlight** from camera-back-right with `color="#0ea5e9"` at
  intensity `0.6` to make Tron edges pop on dark sides.
- Add `@react-three/postprocessing` (~30 KB gz) with **Bloom** (`intensity 0.4`,
  `luminanceThreshold 0.6`) so the glowing edges and pulsing pods bleed
  appropriately. Bloom is the *only* post effect — keep it cheap. Skip if it
  hurts the 60fps budget on the test laptop.

### 1.6 Acceptance for Phase 1

- The Nodes face shows three labelled racks with at least 2 chassis units
  each; LEDs blink at distinguishable rates.
- The Pods face shows pods grouped by deployment on shelves, with per-status
  visual differences clearly visible (run kubectl flows in the next phase to
  trigger them).
- Selecting a pod draws an arc line connecting it to its host rack.
- Visual change is obvious in a side-by-side screenshot vs. main; old palette
  and overall Tron mood preserved.

---

## Phase 2 — Simulation: reconcile loop and kubectl shell

This is the biggest change. The cluster store goes from "static list of objects"
to "object graph with desired vs actual state, reconciled each tick".

### 2.1 Data model rework

**File:** `src/state/clusterStore.ts` (rewrite)

Add desired-vs-actual separation and richer types:

```ts
type PodPhase =
  | "Pending"
  | "ContainerCreating"
  | "Running"
  | "Succeeded"
  | "Failed"
  | "CrashLoopBackOff"
  | "Terminating";

interface K8sPod {
  id: string;
  name: string;          // includes deployment-rs-hash + random suffix
  ownerRef: string;      // ReplicaSet id
  deploymentId: string;
  nodeId: string | null; // null while Pending
  phase: PodPhase;
  restartCount: number;
  containers: { name: string; image: string; ready: boolean }[];
  createdAt: number;     // sim ticks
  // For rolling updates:
  templateHash: string;
}

interface K8sReplicaSet {
  id: string;
  deploymentId: string;
  templateHash: string;
  desiredReplicas: number;
  // observed count is derived from pods.filter(p => p.ownerRef === id)
}

interface K8sDeployment {
  id: string;
  name: string;
  desiredReplicas: number;
  color: string;
  image: string;             // current image (mutating this triggers a rollout)
  strategy: {
    type: "RollingUpdate" | "Recreate";
    maxSurge: number;        // count, not %, for simplicity
    maxUnavailable: number;
  };
  templateHash: string;      // hash of (image, env, ...) — recomputed on update
  // History: rollouts[] with templateHash + revision number
  rollouts: { revision: number; templateHash: string; image: string; at: number }[];
}

interface K8sService {
  id: string;
  name: string;
  type: "ClusterIP" | "LoadBalancer" | "NodePort";
  selector: { deploymentId: string }; // simplified: select by deployment
  endpoints: string[];                // pod ids that are Running and ready
}

interface ClusterEvent {
  id: string;
  at: number;
  type: "Normal" | "Warning";
  reason: string;            // "Scheduled", "Pulling", "Started", "Killing", "BackOff"
  involvedObject: { kind: string; name: string; id: string };
  message: string;
}
```

State also tracks:
- `tick: number` — sim ticks since boot
- `paused: boolean`
- `speed: number` — ticks per real-second (default 2)
- `events: ClusterEvent[]` — capped at 200, newest first
- `pendingActions: Action[]` — queued mutations from kubectl that take effect on next tick

### 2.2 Sim engine

**File:** `src/sim/engine.ts` (new)

A single tick function `step(state) -> state` that runs the reconcile loop in a
fixed order. Drive it from a React effect in `src/sim/SimRunner.tsx` that uses
`setInterval(1000 / speed)` and dispatches store updates. Pause when `paused` is
true.

Reconcile order each tick:

1. **Drain `pendingActions`** — apply create/update/delete to desired state
   (deployments, services, RS counts).
2. **Deployment controller**:
   - For each deployment, ensure the *current* RS (matching `templateHash`) has
     `desiredReplicas` set per rollout strategy:
     - `Recreate`: scale old RS to 0 first; once observed pods all gone, scale
       new RS to desired.
     - `RollingUpdate`: at any time, total pods across all RS for this
       deployment ≤ `desired + maxSurge`; available pods ≥ `desired - maxUnavailable`.
       Step the new RS up by 1 and the old RS down by 1 each tick whenever
       both bounds allow.
   - Garbage collect old RS once it reaches 0 desired AND has 0 pods.
3. **ReplicaSet controller**: for each RS, count pods. If under desired, create
   new pods in `Pending`. If over, mark excess pods as `Terminating`.
4. **Scheduler**: assign each `Pending` pod with `nodeId === null` to a Ready
   worker node. Strategy = least-loaded (fewest current pods). Emit
   `Scheduled` event.
5. **Kubelet (per node)**: advance pod phases on its assigned pods:
   - `Pending → ContainerCreating` after 1 tick (emit `Pulling`, then `Pulled`).
   - `ContainerCreating → Running` after 2 ticks (emit `Started`, mark
     containers ready).
   - `Terminating`: hold for 1 tick, then remove from `pods[]`.
   - Random failure: with probability `failureRate` (default 0 — toggled by
     scenarios), flip a Running pod to `Failed`; controller will then
     recreate it. After 3 fast failures, mark `CrashLoopBackOff` with a
     backoff timer.
6. **Service controller**: rebuild `endpoints` = ids of Running+ready pods
   matching selector.
7. **Garbage collect events** older than 200 entries.

Make the engine pure-ish: `step` takes a snapshot, returns a snapshot. The
React layer wraps it. This makes the engine unit-testable without R3F.

### 2.3 kubectl shell

**File:** `src/ui/Kubectl.tsx` (new)

A bottom-docked terminal panel (collapsible). Tron-styled: black background,
cyan prompt `kubectl ▸`, history above, input at the bottom. Use a plain
controlled `<input>`. No xterm.js — keep it cheap.

**File:** `src/sim/kubectlParser.ts` (new)

Parser that turns a string like `kubectl scale deployment frontend --replicas=4`
into a typed `Action` to push onto `pendingActions`. Support:

- `kubectl get [pods|nodes|deployments|services|rs|events] [-A | -n NS] [-w]`
- `kubectl describe pod NAME`
- `kubectl delete pod NAME`
- `kubectl scale deployment NAME --replicas=N`
- `kubectl set image deployment/NAME container=IMAGE` (triggers rolling update)
- `kubectl rollout status deployment/NAME`
- `kubectl rollout undo deployment/NAME`
- `kubectl apply -f <preset>` — accepts named presets only (e.g.
  `apply -f redis.yaml`); ship a small library of preset YAMLs in
  `src/sim/presets/` parsed at build time.
- `kubectl drain node NAME` — cordons + evicts pods (they reschedule).
- `kubectl cordon` / `kubectl uncordon`.

For unsupported commands, print a friendly "not yet simulated" message that
suggests the closest supported variant.

`get -w` should stream subsequent table reprints whenever the relevant slice
changes. Implement by subscribing to the cluster store and re-running the
`get` until the user presses `Ctrl+C` (`Esc` works too).

### 2.4 Pod-flight animation

When a pod is created, animate it visually:

1. Spawn at the api-server (top face, control-plane).
2. Move to scheduler (top face, slightly offset).
3. Move to its assigned node (front face, on the chosen rack).
4. Settle into the Pods face slot (right face), shrinking from "in-flight"
   sphere into the proper PodCapsule shape.

Implement as a transient particle in `src/sim/PodFlight.tsx`, reusing
`CatmullRomCurve3`. The PodCapsule on the Pods face stays hidden until the
flight completes. This makes the abstract reconcile loop tangible.

### 2.5 Acceptance for Phase 2

- `kubectl delete pod frontend-abc1` causes the pod to disappear, the RS to
  detect under-replication on the next tick, a new pod to spawn (with a new
  random name), fly through the control plane animation, and land on a node.
  An `events` panel shows `Killing`, `Scheduled`, `Pulling`, `Started` in order.
- `kubectl set image deployment/frontend nginx=nginx:1.27` triggers a rolling
  update: a new RS appears, pods come up one by one, old pods get `Terminating`,
  and total pods never exceed `desired + maxSurge` or fall below
  `desired - maxUnavailable`. `kubectl rollout status` returns when done.
- `kubectl drain node worker-node-1` evicts its pods; they go `Pending`
  briefly then reschedule onto other nodes.
- Pause / step / speed controls work.

---

## Phase 3 — Pedagogy: scenarios, events, tour

Once the engine works, layer teaching tools on top.

### 3.1 Event log panel

**File:** `src/ui/EventLog.tsx` (new)

Right-side dockable strip showing the last ~30 cluster events, color-coded by
`reason`. Clicking an event focuses the camera on the involved object.

### 3.2 Scenario library

**File:** `src/sim/scenarios.ts` (new)

A scenario is a script: an initial cluster snapshot + a list of timed actions +
a list of "expected outcomes" used to drive an inline tutorial.

Ship 4 starter scenarios:

1. **Self-healing** — kill a pod, watch the RS bring it back. Highlights the
   reconcile loop.
2. **Rolling update** — change image, walk through surge/unavailable bounds.
3. **Node failure** — mark a node `NotReady`, watch pods reschedule after the
   eviction timer.
4. **Service discovery** — scale a deployment, watch the Service's endpoints
   list grow/shrink as pods become ready.

UI: a "Scenarios" tab in the Legend area; selecting a scenario resets the
cluster, shows a small inline narration that advances when each expected
outcome is reached (poll the store).

### 3.3 Time controls

**File:** `src/ui/TimeControls.tsx` (new)

Top-center toolbar: `⏸ ▶ ⏭` (pause / play / step-one-tick) and a speed slider
(0.25× → 4×). Wire to `paused` and `speed` in the cluster store.

### 3.4 Guided tour

A first-run overlay that walks new users through: rotating the cube, opening a
face, running `kubectl get pods`, and triggering the self-healing scenario.
Use `localStorage` to remember it's been seen. Keep it short — 5 steps max.

### 3.5 Tooltip overlay

When hovering on a rack unit or pod capsule, show a small `<Html>` overlay
(drei) with: name, status, age, restart count, host node. Anchored to the
prop, follows it through animations.

### 3.6 2D / accessibility fallback

The `idea.md` already calls this out. Implement `src/modes/Flat.tsx` — a
non-3D HTML rendering of the same cluster store as a labelled cross-unfolding
diagram. Reachable via a toggle in `ModeSwitcher`. Keyboard arrows move the
focus ring across faces; Tab cycles concepts; Enter opens the drawer. Honors
`prefers-reduced-motion` by skipping the cube unfold animation when added.

### 3.7 Acceptance for Phase 3

- Scenario picker visible; each of the 4 scenarios runs cleanly to its
  expected end state with no manual prodding.
- Event log streams reconcile events live, throttled so it stays readable.
- Pause/step/speed all visibly affect the simulation.
- Flat mode renders the current cluster state as keyboard-navigable HTML.

---

## Phase 4 — Polish and stretch

Pick from these only after phases 1–3 are landed.

- **Resource model**: per-pod CPU/memory requests; node capacity bars on each
  rack; scheduler refuses pods that don't fit (emit `FailedScheduling`).
- **Probes**: liveness/readiness probe ticks; failed liveness restarts the
  container, failed readiness drops it from Service endpoints.
- **HPA simulation**: scale a deployment based on synthetic CPU load; show a
  small load graph on the deployment's shelf.
- **Network policy demo**: render allowed / denied request flows in
  Networking face based on a tiny policy DSL.
- **Persistent volumes**: bring `StorageFace` to life — PVC binds to PV, pod
  mounts it, deleting the pod keeps the PV; deleting the PVC releases it.
- **Multi-namespace**: a namespace switcher; visually tint the cube border
  per namespace.
- **Shareable URLs**: encode current cluster snapshot + selected face into the
  URL so a tutor can send a deep link.
- **Sound (opt-in)**: subtle clicks when pods schedule / events fire. Off by
  default.

---

## File-by-file summary of new and changed paths

| Path | Status | Purpose |
|---|---|---|
| `src/scene/props/RackServer.tsx` | new | Phase 1.1 |
| `src/scene/props/PodCapsule.tsx` | new | Phase 1.2 |
| `src/scene/faces/NodesFace.tsx` | rewrite | use RackServer stacks |
| `src/scene/faces/PodsFace.tsx` | rewrite | shelves + PodCapsules grouped by deployment |
| `src/scene/faces/ControlPlaneFace.tsx` | rewrite | wider rack variant + per-component LEDs |
| `src/scene/Cube.tsx` | edit | panel insets, optional island base |
| `src/scene/Scene.tsx` | edit | rim light, optional Bloom |
| `src/state/clusterStore.ts` | rewrite | desired/actual model, events, time |
| `src/sim/engine.ts` | new | reconcile loop |
| `src/sim/SimRunner.tsx` | new | drives engine each tick |
| `src/sim/kubectlParser.ts` | new | command → Action |
| `src/sim/presets/*.yaml` | new | apply -f targets |
| `src/sim/PodFlight.tsx` | new | spawn animation |
| `src/sim/scenarios.ts` | new | scripted teaching scenarios |
| `src/ui/Kubectl.tsx` | new | terminal panel |
| `src/ui/EventLog.tsx` | new | event stream |
| `src/ui/TimeControls.tsx` | new | pause/play/step/speed |
| `src/ui/Tour.tsx` | new | first-run overlay |
| `src/modes/Flat.tsx` | new | accessibility fallback |
| `src/styles.css` | edit | terminal, event log, time controls, tour styles |

---

## Build order (recommended)

1. **Phase 2.1 + 2.2** — model rework and engine, headless. Validate by writing
   a small test harness that runs the engine and asserts pod counts after kills.
2. **Phase 2.3** — kubectl shell on top of the engine. Now the cluster is
   driveable from the keyboard, even if it still looks like the current boxes.
3. **Phase 1** — visual upgrade. Easier to iterate on geometry once you can
   trigger lifecycle events from kubectl.
4. **Phase 2.4** — pod-flight animation, now that both engine events and
   visuals exist.
5. **Phase 3** — pedagogy layer.
6. **Phase 4** — pick-and-mix.

---

## Out of scope (intentionally)

- Any real network call, real Kubernetes API, or container runtime. This is a
  *simulation*; nothing outside the browser tab is touched.
- A real YAML parser. Use a tiny hand-rolled one over the preset file format,
  or restrict `apply -f` inputs to a fixed library of named manifests.
- StatefulSets / Jobs / CronJobs. Mention them in Pods-face content text but
  do not simulate ordering / completion semantics in this round.
- Authentication / RBAC enforcement. The Foundations face can show RBAC
  *concepts* but the kubectl shell ignores them.
