/**
 * Cube slicing — the cube body is a vertical stack of slabs:
 *   top: control plane
 *   middle: one slab per worker node (driven by current cluster state)
 *   bottom: foundations base
 *
 * The same slab Y is used by:
 *   - the cube body geometry (Cube.tsx)
 *   - the rack chassis on the Nodes face
 *   - the pod arrangement on the Pods face
 *   - the pod-flight landing position
 *
 * Pod scheduled on worker-2 ⇒ rendered in slab #2 ⇒ visible at the same height
 * on both the Nodes (front) and Pods (right) faces.
 */

export interface SliceRect {
  /** Y center in cube-local coords (cube spans -1..+1). */
  y: number;
  /** vertical height. */
  h: number;
}

export interface SliceLayout {
  controlPlane: SliceRect;
  workers: SliceRect[];
  foundations: SliceRect;
}

const CUBE_HALF = 1.0;
const TOP_PADDING = 0.04;       // gap above control plane
const BOTTOM_PADDING = 0.04;    // gap below foundations base
const FOUND_HEIGHT = 0.14;
const CP_HEIGHT = 0.36;
const SLAB_GAP = 0.05;
const STACK_GAP = 0.08;         // gap between control-plane slab and worker stack
const FOUND_GAP = 0.05;         // gap between worker stack and foundations base

export function computeSliceLayout(workerCount: number): SliceLayout {
  const cpTop = CUBE_HALF - TOP_PADDING;
  const cpY = cpTop - CP_HEIGHT / 2;
  const cpBottom = cpTop - CP_HEIGHT;

  const foundBottom = -CUBE_HALF + BOTTOM_PADDING;
  const foundY = foundBottom + FOUND_HEIGHT / 2;
  const foundTop = foundBottom + FOUND_HEIGHT;

  const stackTop = cpBottom - STACK_GAP;
  const stackBottom = foundTop + FOUND_GAP;
  const span = Math.max(0.1, stackTop - stackBottom);

  const n = Math.max(1, workerCount);
  const totalGaps = (n - 1) * SLAB_GAP;
  const slabH = Math.max(0.08, (span - totalGaps) / n);

  // workers ordered top-down (index 0 = topmost, since the array order
  // typically matches node-1, node-2, node-3 — top-down feels natural).
  const workers: SliceRect[] = Array.from({ length: n }, (_, i) => {
    const top = stackTop - i * (slabH + SLAB_GAP);
    return { y: top - slabH / 2, h: slabH };
  });

  return {
    controlPlane: { y: cpY, h: CP_HEIGHT },
    workers,
    foundations: { y: foundY, h: FOUND_HEIGHT },
  };
}

/** Width/depth used for slab geometry (slightly inset from cube faces). */
export const SLAB_WIDTH = 1.94;
export const SLAB_DEPTH = 1.94;
