import { CameraControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import type { CameraControls as CameraControlsImpl } from "@react-three/drei";
import type { FaceId } from "../state/store";
import { useApp } from "../state/store";
import { useRig } from "../state/rigStore";

const FACE_VIEW: Record<FaceId, { eye: [number, number, number]; look: [number, number, number] }> = {
  "control-plane": { eye: [0,  4.4,  0.001], look: [0, 0, 0] },
  "nodes":         { eye: [0,  0.6,  4.2],   look: [0, 0, 0] },
  "pods":          { eye: [4.2, 0.6,  0],    look: [0, 0, 0] },
  "networking":    { eye: [-4.2, 0.6, 0],    look: [0, 0, 0] },
  "storage":       { eye: [0,  0.6, -4.2],   look: [0, 0, 0] },
  "foundations":   { eye: [0, -4.4,  0.001], look: [0, 0, 0] },
};

export const HOME_VIEW = {
  eye: [4.5, 3.8, 5.2] as [number, number, number],
  look: [0, 0, 0] as [number, number, number],
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function CameraRig() {
  const ref = useRef<CameraControlsImpl | null>(null);
  const setControls = useRig((s) => s.setControls);
  const mode = useApp((s) => s.mode);
  const activeFace = useApp((s) => s.activeFace);

  // Orbit-mode camera follows activeFace in the store.
  useEffect(() => {
    if (mode !== "orbit") return;
    const c = ref.current;
    if (!c) return;
    const target = activeFace ? FACE_VIEW[activeFace] : HOME_VIEW;
    c.setLookAt(
      target.eye[0], target.eye[1], target.eye[2],
      target.look[0], target.look[1], target.look[2],
      !prefersReducedMotion(),
    );
  }, [mode, activeFace]);

  // When entering scrolly or explore from another mode, reset to overview so
  // the user has a known starting point. ScrollyMode then drives further moves.
  useEffect(() => {
    if (mode === "orbit") return;
    const c = ref.current;
    if (!c) return;
    c.setLookAt(
      HOME_VIEW.eye[0], HOME_VIEW.eye[1], HOME_VIEW.eye[2],
      HOME_VIEW.look[0], HOME_VIEW.look[1], HOME_VIEW.look[2],
      !prefersReducedMotion(),
    );
  }, [mode]);

  return (
    <CameraControls
      ref={(c) => {
        ref.current = c;
        setControls(c);
      }}
      enabled={mode !== "scrolly"}
      minDistance={3}
      maxDistance={14}
      smoothTime={prefersReducedMotion() ? 0 : 0.35}
      draggingSmoothTime={0.12}
    />
  );
}
