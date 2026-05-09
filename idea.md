# k8s cube

## Idea

The idea is to create an unique explainer for k8s concepts. We imagine k8s as an isometric cube with -
- nodes as one face
- pods as one face
- control plane as one face (top face preferable)
This way, we illustrate the different facets of k8s while also allowing the reader to understand how the different facets relate

The app itself should be an actual, navigable 3d representation of the cube. A reference picture is in reference.png

## Clarifications (resolved)

- **Tech stack:** React Three Fiber + Three.js (declarative scene graph; ecosystem: `@react-three/drei`, `@react-three/postprocessing`, `leva` for debug, `zustand` for state).
- **Interactivity:** All three modes available, switchable from a single UI:
  1. **Rotate + click-to-explain** — user orbits the cube, clicks a face to expand annotations / zoom in.
  2. **Scrollytelling walkthrough** — scroll-driven camera animates between faces with narrated steps.
  3. **Free explore + animated traffic** — orbit freely while request/control flows animate across faces.
- **Visual style:** Clean low-poly / flat-shaded 3D. Not trying to replicate the hand-drawn reference 1:1 — use the reference for *layout and metaphor*, not rendering style.
- **All 6 faces are used** for concepts (mapping below).

## Face mapping (all 6 faces)

| Face | Concept | What lives on it |
|---|---|---|
| Top | Control Plane | api-server, scheduler, controller-manager, etcd, cloud-controller-manager (as rooftop "buildings") |
| Front | Nodes | kubelet, kube-proxy, container runtime — shown as floors of a building or stacked plates |
| Right | Pods & Workloads | Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs/CronJobs |
| Left | Networking | Services (ClusterIP/NodePort/LoadBalancer), Ingress, NetworkPolicy, DNS |
| Back | Storage & Config | PVs/PVCs, StorageClasses, ConfigMaps, Secrets |
| Bottom | Foundations / Cluster Boundary | Namespaces, RBAC, ServiceAccounts, the API boundary itself |

The cube being **navigable** means the user can rotate to see any face — bottom is reachable by flipping/orbiting, not hidden.

## How to implement

### High-level architecture

```
app/
  src/
    scene/          # R3F canvas, lighting, camera rig
      Cube.tsx
      faces/
        ControlPlaneFace.tsx
        NodesFace.tsx
        PodsFace.tsx
        NetworkingFace.tsx
        StorageFace.tsx
        FoundationsFace.tsx
      flows/        # animated request/control flows (mode 3)
      annotations/  # billboarded labels, callouts
    modes/
      OrbitMode.tsx
      ScrollyMode.tsx
      ExploreMode.tsx
    state/          # zustand store (active face, mode, selected concept)
    content/        # MDX or JSON describing each concept (decoupled from scene code)
    ui/             # mode switcher, legend, concept drawer
```

Keep **content separate from geometry**. Each face reads a content manifest so concepts can be edited without touching scene code.

### Implementation approaches (pick one — ordered by recommendation)

#### Option A — Single cube, faces as `<group>`s on cube sides (recommended)

- One root `<group>` is the cube. Six child groups, one per face, each translated/rotated to sit on a face of a unit cube.
- Each face renders its own low-poly props (boxes, cylinders, extruded shapes).
- Camera uses `OrbitControls` (drei) by default; programmatic camera moves via `CameraControls` (drei) for click-to-focus and scrolly steps.
- **Pros:** simplest mental model, easy to add/remove concepts per face, faces are independently testable.
- **Cons:** if concepts get tall (e.g., control plane skyline), they'll poke out past the cube outline — desirable for the reference's silhouette.

#### Option B — "Building" cube where each face is a floor/section

- The cube is hollow; faces are exterior walls of a building. Camera can fly *inside* to show internal relationships (e.g., a pod sitting on a node sitting under the control plane).
- **Pros:** strongest at showing relationships ("a pod runs *on* a node, *managed by* control plane").
- **Cons:** interior camera work is finicky; requires culling logic so the user can see in.

#### Option C — Cube unfolds / explodes on demand

- Default state: solid cube. On a UI toggle, faces animate outward into a 2D cross layout or exploded axonometric.
- **Pros:** great pedagogical moment ("here's the whole thing flattened").
- **Cons:** extra animation rig + content has to look good in both states.

> **Recommendation:** start with **A**, keep B's "fly inside" as a stretch goal, build C only if scrollytelling needs a hero moment.

### Mode-by-mode implementation

#### Mode 1 — Rotate + click-to-explain
- `OrbitControls` with damping; constrain polar angle so user can't go upside-down accidentally (allow flip via UI button to see bottom face).
- Each face group has an invisible `<mesh>` plane for raycasting (cleaner than per-prop hit testing).
- On click: animate camera to face-normal viewpoint via `CameraControls.fitToBox`, dim non-active faces (lower material opacity / desaturate), open a side drawer with content for that face.
- Annotations: `<Html>` from drei for crisp text, OR billboarded sprites for performance with many labels.

#### Mode 2 — Scrollytelling
- Use `@react-three/drei`'s `ScrollControls` + `useScroll`, OR drive a `useSpring` value from window scroll.
- Define a sequence of camera "shots" (position + lookAt + face-of-interest). Interpolate between shots based on scroll progress.
- Pin narration text to scroll segments (sticky panel on the side).
- Each shot can trigger an animation on the active face (e.g., spawn pods on the Nodes face when its segment is in view).

#### Mode 3 — Free explore + animated traffic
- A `flows/` system: each flow is a typed list of waypoints in cube-space (e.g., `kubectl apply` → api-server (top) → scheduler → kubelet on a node (front) → pod (right)).
- Render flows as moving particles along Catmull-Rom curves between waypoints (`<Line>` from drei + a small custom shader or instanced spheres animating along the curve).
- A flow legend lets the user toggle which flows are active (deployment lifecycle, request path, control loop, etc.).

### Visual / rendering details

- **Materials:** `MeshToonMaterial` or flat `MeshStandardMaterial` with low roughness variation; one shared palette (~6–8 colors) for the whole scene.
- **Outlines (optional):** drei's `<Outlines>` on key meshes for a crisp low-poly silhouette without going full NPR.
- **Lighting:** one directional key light + soft ambient; bake-feeling but realtime. `ContactShadows` from drei under the cube for grounding.
- **Environment:** small island base under the cube echoing the reference (low-poly water plane, a few trees) — purely decorative, optional.
- **Post-processing:** SMAA + slight ambient occlusion via `@react-three/postprocessing`. Skip bloom — wrong vibe for low-poly diagrams.

### Content layer

Each concept is a record:

```ts
type Concept = {
  id: string;              // "api-server"
  face: FaceId;            // "control-plane"
  title: string;
  short: string;           // tooltip
  long: string | MDX;      // drawer content
  position: [number, number, number]; // local to face group
  links: ConceptId[];      // for relationship lines
};
```

Storing content as data (not JSX) means we can:
- Generate a search index.
- Render a non-3D fallback (accessibility / SEO).
- Power a "show all relationships" overlay by joining `links` across faces.

### Accessibility & fallback

- 3D-only is hostile to keyboard users and screen readers. Provide a **2D mode** that renders the same content as a labeled SVG cross-unfolding, sharing the content layer.
- Keyboard: arrow keys rotate cube, Tab cycles concepts, Enter opens drawer.
- Respect `prefers-reduced-motion`: disable scrolly camera easing, freeze animated traffic flows.

### Performance budget

- Target 60fps on a mid-tier laptop, 30fps on mobile.
- Keep total triangle count modest (low-poly helps); instance repeated props (pods, nodes) via `<Instances>` from drei.
- Lazy-load face content with `React.Suspense` so initial paint is just the cube shell.

### Suggested build order (incremental milestones)

1. **Skeleton:** R3F canvas, a plain cube, OrbitControls, one face with a placeholder label.
2. **All 6 faces** with low-poly placeholder geometry and the content-record schema wired up.
3. **Mode 1 (click-to-explain)** end-to-end on one face, then replicate.
4. **Annotations & content drawer** with real copy for at least Control Plane + Nodes + Pods.
5. **Mode 2 (scrollytelling)** with 4–5 shots covering a deployment story.
6. **Mode 3 (animated flows)** with one flow (deployment lifecycle), then add more.
7. **Polish:** outlines, contact shadows, island base, reduced-motion, 2D fallback.

### Open questions to revisit

- Is this a standalone teaching site, or embedded inside existing docs? (affects routing, framework choice — Vite SPA vs Next.js)
- Do we want shareable deep links (e.g., `/concept/api-server` opens the cube zoomed onto that prop)?
- Should concept content be authored in MDX (rich, code samples) or plain JSON (simpler, translatable)?
