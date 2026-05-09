import { create } from "zustand";
import type { CameraControls as CameraControlsImpl } from "@react-three/drei";

interface RigStore {
  controls: CameraControlsImpl | null;
  setControls: (c: CameraControlsImpl | null) => void;
}

/**
 * Holds an imperative reference to the CameraControls instance so DOM-level
 * components (e.g. ScrollyMode) can drive the camera without going through
 * React state on every scroll tick.
 */
export const useRig = create<RigStore>((set) => ({
  controls: null,
  setControls: (controls) => set({ controls }),
}));
