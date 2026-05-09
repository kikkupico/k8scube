import { create } from "zustand";

export type Mode = "orbit" | "explore";

export type FaceId =
  | "control-plane"
  | "nodes"
  | "pods"
  | "networking"
  | "storage"
  | "foundations";

export interface AppState {
  mode: Mode;
  activeFace: FaceId | null;
  /** ID of a dynamic entity (Pod, Node, etc.) */
  activeEntityId: string | null;
  enabledFlows: Record<string, boolean>;
  setMode: (m: Mode) => void;
  setActiveFace: (f: FaceId | null) => void;
  setActiveEntity: (id: string | null) => void;
  closeDrawer: () => void;
  toggleFlow: (id: string) => void;
}

export const useApp = create<AppState>((set) => ({
  mode: "orbit",
  activeFace: null,
  activeEntityId: null,
  enabledFlows: { deploy: true, request: true, "control-loop": true },
  setMode: (mode) => set({ mode }),
  setActiveFace: (activeFace) => set({ activeFace, activeEntityId: null }),
  setActiveEntity: (activeEntityId) => set({ activeEntityId }),
  closeDrawer: () => set({ activeFace: null, activeEntityId: null }),
  toggleFlow: (id) =>
    set((s) => ({
      enabledFlows: { ...s.enabledFlows, [id]: !s.enabledFlows[id] },
    })),
}));
