import { useEffect, useMemo, useRef, useState } from "react";
import { useCluster } from "../state/clusterStore";
import { parseKubectl } from "../sim/kubectlParser";
import { SCENARIOS, runScenario } from "../sim/scenarios";

interface HistoryEntry {
  prompt: string;
  lines: string[];
}

export function Kubectl() {
  const enqueue = useCluster((s) => s.enqueue);
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([
    { prompt: "", lines: ["k8scube ▸ kubectl shell. Type `help` for commands."] },
  ]);
  const [recall, setRecall] = useState<string[]>([]);
  const [recallIdx, setRecallIdx] = useState<number>(-1);

  // active watcher (re-renders rows when store changes)
  const [watcher, setWatcher] = useState<null | { cmd: string; render: () => string[] }>(null);
  const tick = useCluster((s) => s.tick);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, watcher, tick]);

  const watcherLines = useMemo(() => {
    if (!watcher) return null;
    return watcher.render();
  }, [watcher, tick]);

  const submit = () => {
    const cmd = input.trim();
    if (!cmd) return;
    setRecall((r) => [cmd, ...r].slice(0, 50));
    setRecallIdx(-1);

    if (cmd === "exit" || cmd === "close") { setOpen(false); setInput(""); return; }

    const snapshot = useCluster.getState();
    const out = parseKubectl(cmd, snapshot);

    // markers from parser
    if (out.lines[0] === "__CLEAR__") {
      setHistory([]);
      setInput("");
      setWatcher(null);
      return;
    }
    if (out.lines[0] === "__SCENARIO_LIST__") {
      setHistory((h) => [...h, { prompt: cmd, lines: ["scenarios:", ...SCENARIOS.map((s) => `  ${s.name}  -  ${s.description}`)] }]);
      setInput("");
      return;
    }
    if (out.lines[0]?.startsWith("__SCENARIO_RUN__")) {
      const id = out.lines[0].split(":")[1];
      const s = SCENARIOS.find((x) => x.name === id);
      if (!s) {
        setHistory((h) => [...h, { prompt: cmd, lines: [`unknown scenario: ${id}`] }]);
      } else {
        runScenario(s);
        setHistory((h) => [...h, { prompt: cmd, lines: [`scenario "${id}" started`] }]);
      }
      setInput("");
      return;
    }

    for (const a of out.actions) enqueue(a);

    if (out.watch) {
      // freeze any prior watcher; start a new one. Re-resolve render fn against latest snapshot.
      const cmdToRun = cmd;
      const freshRender = () => {
        const snap = useCluster.getState();
        return parseKubectl(cmdToRun.replace(/-w\b/, "").trim(), snap).lines;
      };
      setWatcher({ cmd: cmdToRun, render: freshRender });
      setHistory((h) => [...h, { prompt: cmd, lines: ["watching… press Esc to stop"] }]);
    } else {
      setHistory((h) => [...h, { prompt: cmd, lines: out.lines }]);
    }
    setInput("");
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "Escape") {
      if (watcher) {
        setWatcher(null);
      } else {
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(recall.length - 1, recallIdx + 1);
      if (next >= 0 && recall[next]) { setRecallIdx(next); setInput(recall[next]); }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = recallIdx - 1;
      if (next < 0) { setRecallIdx(-1); setInput(""); }
      else { setRecallIdx(next); setInput(recall[next] ?? ""); }
      return;
    }
    if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setHistory([]);
    }
  };

  return (
    <>
      {!open && (
        <button className="kubectl-toggle" onClick={() => setOpen(true)} title="Open kubectl shell">
          ▸ kubectl
        </button>
      )}
      {open && (
        <div className="kubectl">
          <div className="kubectl-header">
            <span>KUBECTL</span>
            <span className="kubectl-tick">tick {tick}</span>
            <button onClick={() => setOpen(false)} title="Close">×</button>
          </div>
          <div className="kubectl-body" ref={scrollRef}>
            {history.map((h, i) => (
              <div key={i} className="kubectl-entry">
                {h.prompt && <div className="kubectl-prompt">▸ {h.prompt}</div>}
                {h.lines.map((l, j) => (
                  <pre key={j} className="kubectl-line">{l}</pre>
                ))}
              </div>
            ))}
            {watcher && watcherLines && (
              <div className="kubectl-entry kubectl-entry-watch">
                <div className="kubectl-prompt">▸ {watcher.cmd}  <em>(watching)</em></div>
                {watcherLines.map((l, j) => (
                  <pre key={j} className="kubectl-line">{l}</pre>
                ))}
              </div>
            )}
          </div>
          <div className="kubectl-input">
            <span className="kubectl-prompt">▸</span>
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              spellCheck={false}
              placeholder="kubectl get pods -w"
            />
          </div>
        </div>
      )}
    </>
  );
}
