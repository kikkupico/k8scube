/**
 * Cube slicing — the cube body is a vertical stack of slabs:
 *   top: edge / user-app entry
 *   middle: one slab per worker node (driven by current cluster state)
 *   bottom: control plane (the brain)
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
  edge: SliceRect;
  workers: SliceRect[];
  controlPlane: SliceRect;
}

const CUBE_HALF = 1.0;
const TOP_PADDING = 0.04;
const BOTTOM_PADDING = 0.04;
const EDGE_HEIGHT = 0.36;
const CP_HEIGHT = 0.36;
const SLAB_GAP = 0.05;
const STACK_GAP = 0.08;

export function computeSliceLayout(workerCount: number): SliceLayout {
  const edgeTop = CUBE_HALF - TOP_PADDING;
  const edgeY = edgeTop - EDGE_HEIGHT / 2;
  const edgeBottom = edgeTop - EDGE_HEIGHT;

  const cpBottom = -CUBE_HALF + BOTTOM_PADDING;
  const cpY = cpBottom + CP_HEIGHT / 2;
  const cpTop = cpBottom + CP_HEIGHT;

  const stackTop = edgeBottom - STACK_GAP;
  const stackBottom = cpTop + STACK_GAP;
  const span = Math.max(0.1, stackTop - stackBottom);

  const n = Math.max(1, workerCount);
  const totalGaps = (n - 1) * SLAB_GAP;
  const slabH = Math.max(0.08, (span - totalGaps) / n);

  // workers ordered top-down (index 0 = topmost)
  const workers: SliceRect[] = Array.from({ length: n }, (_, i) => {
    const top = stackTop - i * (slabH + SLAB_GAP);
    return { y: top - slabH / 2, h: slabH };
  });

  return {
    edge: { y: edgeY, h: EDGE_HEIGHT },
    workers,
    controlPlane: { y: cpY, h: CP_HEIGHT },
  };
}

/** Width/depth used for slab geometry (slightly inset from cube faces). */
export const SLAB_WIDTH = 1.94;
export const SLAB_DEPTH = 1.94;
