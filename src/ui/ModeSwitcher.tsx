import { useApp, type Mode } from "../state/store";

const MODES: { id: Mode; label: string; available: boolean }[] = [
  { id: "orbit",   label: "Orbit",   available: true  },
  { id: "explore", label: "Explore", available: true  },
];

export function ModeSwitcher() {
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);

  return (
    <div className="mode-switcher" role="tablist" aria-label="Interaction mode">
      {MODES.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-pressed={mode === m.id}
          disabled={!m.available}
          title={m.available ? undefined : "Coming soon"}
          onClick={() => m.available && setMode(m.id)}
          style={{ opacity: m.available ? 1 : 0.4 }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
