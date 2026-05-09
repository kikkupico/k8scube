import { create } from "zustand";

export type Mode = "orbit" | "scrolly" | "explore";

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
  activeConcept: string | null;
  enabledFlows: Record<string, boolean>;
  setMode: (m: Mode) => void;
  setActiveFace: (f: FaceId | null) => void;
  setActiveConcept: (id: string | null) => void;
  closeDrawer: () => void;
  toggleFlow: (id: string) => void;
}

export const useApp = create<AppState>((set) => ({
  mode: "orbit",
  activeFace: null,
  activeConcept: null,
  enabledFlows: { deploy: true, request: true, "control-loop": true },
  setMode: (mode) => set({ mode }),
  setActiveFace: (activeFace) => set({ activeFace, activeConcept: null }),
  setActiveConcept: (activeConcept) => set({ activeConcept }),
  closeDrawer: () => set({ activeFace: null, activeConcept: null }),
  toggleFlow: (id) =>
    set((s) => ({
      enabledFlows: { ...s.enabledFlows, [id]: !s.enabledFlows[id] },
    })),
}));
