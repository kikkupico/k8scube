import { Scene } from "./scene/Scene";
import { ModeSwitcher } from "./ui/ModeSwitcher";
import { ConceptDrawer } from "./ui/ConceptDrawer";
import { Legend } from "./ui/Legend";
import { FlowToggles } from "./ui/FlowToggles";
import { ResetButton } from "./ui/ResetButton";
import { useApp } from "./state/store";

export function App() {
  const mode = useApp((s) => s.mode);
  return (
    <div className="app" data-mode={mode}>
      <Scene />
      <ModeSwitcher />
      <ResetButton />
      <Legend />
      <ConceptDrawer />
      {mode === "explore" && <FlowToggles />}
      <header className="title">
        <h1>K8SCUBE</h1>
        <p>Dynamic Cluster Simulation</p>
      </header>
    </div>
  );
}
