import { Flow } from "./Flow";
import { FLOWS } from "./flowDefs";
import { useApp } from "../state/store";

export function Flows() {
  const enabled = useApp((s) => s.enabledFlows);
  return (
    <group>
      {FLOWS.filter((f) => enabled[f.id] !== false).map((f) => (
        <Flow key={f.id} flow={f} />
      ))}
    </group>
  );
}
