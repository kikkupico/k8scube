import { Scene } from "./scene/Scene";
import { ModeSwitcher } from "./ui/ModeSwitcher";
import { ConceptDrawer } from "./ui/ConceptDrawer";
import { Legend } from "./ui/Legend";
import { FlowToggles } from "./ui/FlowToggles";
import { ResetButton } from "./ui/ResetButton";
import { Kubectl } from "./ui/Kubectl";
import { EventLog } from "./ui/EventLog";
import { TimeControls } from "./ui/TimeControls";
import { Scenarios } from "./ui/Scenarios";
import { SimRunner } from "./sim/SimRunner";
import { useApp } from "./state/store";

export function App() {
  const mode = useApp((s) => s.mode);
  return (
    <div className="app" data-mode={mode}>
      <SimRunner />
      <Scene />
      <header className="title">
        <h1>K8SCUBE</h1>
        <p>Live Cluster Simulation</p>
      </header>
      <TimeControls />
      <ModeSwitcher />
      <ResetButton />
      <Legend />
      <Scenarios />
      <ConceptDrawer />
      {mode === "explore" && <FlowToggles />}
      <EventLog />
      <Kubectl />
    </div>
  );
}
