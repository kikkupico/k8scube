import { Scene } from "./scene/Scene";
import { ModeSwitcher } from "./ui/ModeSwitcher";
import { ConceptDrawer } from "./ui/ConceptDrawer";
import { Legend } from "./ui/Legend";
import { FlowToggles } from "./ui/FlowToggles";
import { ResetButton } from "./ui/ResetButton";
import { ScrollyMode } from "./modes/ScrollyMode";
import { useApp } from "./state/store";

export function App() {
  const mode = useApp((s) => s.mode);
  return (
    <div className="app" data-mode={mode}>
      <Scene />
      <ModeSwitcher />
      <ResetButton />
      <Legend />
      {mode === "orbit" && <ConceptDrawer />}
      {mode === "scrolly" && <ScrollyMode />}
      {mode === "explore" && <FlowToggles />}
      <header className="title">
        <h1>k8s cube</h1>
        <p>a navigable explainer</p>
      </header>
    </div>
  );
}
