import { useMemo, useState } from "react";
import { useApp } from "../state/store";
import { useCluster, DEFAULT_REQUESTS } from "../state/clusterStore";
import { faceMeta, conceptFor } from "../content/concepts";

/** Collapsible "What is this?" block driven by the concept content layer. */
function ConceptExplainer({ kind, color }: { kind: string; color: string }) {
  const [open, setOpen] = useState(true);
  const info = conceptFor(kind);
  if (!info) return null;
  return (
    <div className="concept-explainer">
      <button className="concept-explainer-toggle" onClick={() => setOpen((o) => !o)} style={{ color }}>
        {open ? "▾" : "▸"} What is a {info.title}?
      </button>
      {open && (
        <div className="concept-explainer-body">
          <p className="concept-oneliner">{info.oneLiner}</p>
          <p className="concept-why">{info.why}</p>
        </div>
      )}
    </div>
  );
}

export function ConceptDrawer() {
  const activeFace = useApp((s) => s.activeFace);
  const activeEntityId = useApp((s) => s.activeEntityId);
  const setActiveEntity = useApp((s) => s.setActiveEntity);
  const setActiveFace = useApp((s) => s.setActiveFace);
  const closeDrawer = useApp((s) => s.closeDrawer);

  const nodes = useCluster((s) => s.nodes);
  const pods = useCluster((s) => s.pods);
  const services = useCluster((s) => s.services);
  const ingresses = useCluster((s) => s.ingresses);
  const egressTargets = useCluster((s) => s.egressTargets);
  const deployments = useCluster((s) => s.deployments);
  const replicaSets = useCluster((s) => s.replicaSets);
  const daemonSets = useCluster((s) => s.daemonSets);
  const jobs = useCluster((s) => s.jobs);
  const cronJobs = useCluster((s) => s.cronJobs);
  const hpas = useCluster((s) => s.hpas);
  const pvs = useCluster((s) => s.pvs);
  const pvcs = useCluster((s) => s.pvcs);
  const configMaps = useCluster((s) => s.configMaps);
  const secrets = useCluster((s) => s.secrets);
  const namespaces = useCluster((s) => s.namespaces);
  const enqueue = useCluster((s) => s.enqueue);

  const meta = useMemo(() => activeFace ? faceMeta(activeFace) : null, [activeFace]);

  const selectedPod = useMemo(() => pods.find((p) => p.id === activeEntityId), [pods, activeEntityId]);
  const selectedNode = useMemo(() => nodes.find((n) => n.id === activeEntityId), [nodes, activeEntityId]);
  const selectedSvc = useMemo(() => services.find((s) => s.id === activeEntityId), [services, activeEntityId]);
  const selectedIngress = useMemo(() => ingresses.find((i) => i.id === activeEntityId), [ingresses, activeEntityId]);
  const selectedEgress = useMemo(() => egressTargets.find((e) => e.id === activeEntityId), [egressTargets, activeEntityId]);
  const selectedPv = useMemo(() => pvs.find((v) => v.id === activeEntityId), [pvs, activeEntityId]);
  const selectedPvc = useMemo(() => pvcs.find((c) => c.id === activeEntityId), [pvcs, activeEntityId]);
  const selectedCm = useMemo(() => configMaps.find((c) => c.id === activeEntityId), [configMaps, activeEntityId]);
  const selectedSecret = useMemo(() => secrets.find((c) => c.id === activeEntityId), [secrets, activeEntityId]);
  const selectedNs = useMemo(() => namespaces.find((n) => n.id === activeEntityId), [namespaces, activeEntityId]);
  const selectedDs = useMemo(() => daemonSets.find((d) => d.id === activeEntityId), [daemonSets, activeEntityId]);
  const selectedJob = useMemo(() => jobs.find((j) => j.id === activeEntityId), [jobs, activeEntityId]);
  const selectedCron = useMemo(() => cronJobs.find((c) => c.id === activeEntityId), [cronJobs, activeEntityId]);
  const selectedHpa = useMemo(() => hpas.find((h) => h.id === activeEntityId), [hpas, activeEntityId]);
  const selectedDeployment = useMemo(() => deployments.find((d) => d.id === activeEntityId), [deployments, activeEntityId]);

  const faceEntities = useMemo(() => {
    if (activeFace === "nodes") return nodes.filter((n) => n.role === "worker");
    if (activeFace === "control-plane") return [...nodes.filter((n) => n.role === "control-plane"), ...namespaces];
    if (activeFace === "networking") return [...services, ...ingresses];
    if (activeFace === "storage") return [...pvs, ...pvcs, ...configMaps, ...secrets];
    if (activeFace === "edge") return [...ingresses, ...egressTargets];
    return [];
  }, [activeFace, nodes, services, ingresses, egressTargets, pvs, pvcs, configMaps, secrets, namespaces]);

  const selectedEntity =
    selectedPod ?? selectedNode ?? selectedSvc ?? selectedIngress ?? selectedEgress ??
    selectedPv ?? selectedPvc ?? selectedCm ?? selectedSecret ?? selectedNs ??
    selectedDs ?? selectedJob ?? selectedCron ?? selectedHpa ?? selectedDeployment ?? null;

  const selectedKind =
    selectedPod ? "Pod" :
    selectedDeployment ? "Deployment" :
    selectedDs ? "DaemonSet" :
    selectedJob ? "Job" :
    selectedCron ? "CronJob" :
    selectedHpa ? "HPA" :
    selectedNode ? "Node" :
    selectedSvc ? "Service" :
    selectedIngress ? "Ingress" :
    selectedEgress ? "EgressTarget" :
    selectedPv ? "PersistentVolume" :
    selectedPvc ? "PVC" :
    selectedCm ? "ConfigMap" :
    selectedSecret ? "Secret" :
    selectedNs ? "Namespace" : null;

  return (
    <aside
      className="drawer"
      data-open={!!activeFace}
      aria-hidden={!activeFace}
    >
      {meta && (
        <>
          <header>
            <div>
              <div className="face-tag" style={{ color: meta.color }}>{meta.subtitle}</div>
              <h2>{meta.title}</h2>
            </div>
            <button className="close" onClick={closeDrawer} aria-label="Close">×</button>
          </header>

          <div className="body">
            {selectedEntity ? (
              <>
                <button onClick={() => setActiveEntity(null)} className="back-link">← all on this face</button>
                <h3 style={{ margin: 0, fontSize: 18, color: meta.color }}>{selectedEntity.name.toUpperCase()}</h3>
                {selectedKind && <ConceptExplainer kind={selectedKind} color={meta.color} />}
                <div className="entity-details">
                  <p><strong>ID:</strong> {selectedEntity.id}</p>

                  {selectedNode && <>
                    <p><strong>Role:</strong> {selectedNode.role}</p>
                    <p><strong>Status:</strong> <span className={`status status-${selectedNode.status}`}>{selectedNode.status}</span></p>
                    <p><strong>Pods on node:</strong> {pods.filter((p) => p.nodeId === selectedNode.id).length}</p>
                    {(() => {
                      let cpu = 0, mem = 0;
                      for (const p of pods) {
                        if (p.nodeId !== selectedNode.id || p.phase === "Terminating") continue;
                        for (const c of p.containers) { const r = c.requests ?? DEFAULT_REQUESTS; cpu += r.cpu; mem += r.mem; }
                      }
                      return <>
                        <p><strong>CPU:</strong> {cpu}m / {selectedNode.capacity.cpu}m ({Math.round((cpu / selectedNode.capacity.cpu) * 100)}%)</p>
                        <p><strong>Memory:</strong> {mem}Mi / {selectedNode.capacity.mem}Mi ({Math.round((mem / selectedNode.capacity.mem) * 100)}%)</p>
                      </>;
                    })()}
                    <div className="entity-actions">
                      {selectedNode.status !== "Cordoned" && <button onClick={() => enqueue({ type: "Cordon", node: selectedNode.name })}>Cordon</button>}
                      {selectedNode.status === "Cordoned" && <button onClick={() => enqueue({ type: "Uncordon", node: selectedNode.name })}>Uncordon</button>}
                      <button onClick={() => enqueue({ type: "DrainNode", node: selectedNode.name })}>Drain</button>
                    </div>
                  </>}

                  {selectedPod && <>
                    <p><strong>Phase:</strong> <span className={`status status-${selectedPod.phase}`}>{selectedPod.phase}</span>{selectedPod.pendingReason ? ` (${selectedPod.pendingReason})` : ""}</p>
                    <p><strong>Namespace:</strong> <button className="xref" onClick={() => { const ns = namespaces.find((n) => n.name === selectedPod.namespace); if (ns) { setActiveFace("control-plane"); setActiveEntity(ns.id); } }}>{selectedPod.namespace}</button></p>
                    <p><strong>Node:</strong> {selectedPod.nodeId ? <button className="xref" onClick={() => { setActiveFace("nodes"); setActiveEntity(selectedPod.nodeId!); }}>{nodes.find((n) => n.id === selectedPod.nodeId)?.name}</button> : "<unscheduled>"}</p>
                    <p><strong>Controller:</strong> {selectedPod.ownerKind ?? "ReplicaSet"}{selectedPod.deploymentId ? ` (deployment ${deployments.find((d) => d.id === selectedPod.deploymentId)?.name ?? "-"})` : ""}</p>
                    <p><strong>Image:</strong> {selectedPod.containers[0]?.image ?? "-"}</p>
                    <p><strong>Requests:</strong> {(() => { const r = selectedPod.containers[0]?.requests ?? DEFAULT_REQUESTS; return `${r.cpu}m cpu, ${r.mem}Mi mem`; })()}</p>
                    <p><strong>Restart count:</strong> {selectedPod.restartCount}</p>
                    <p><strong>Owner RS:</strong> {selectedPod.ownerRef ?? "-"}</p>
                    <p><strong>Created tick:</strong> {selectedPod.createdAt}</p>
                    {selectedPod.volumes.length > 0 && (
                      <>
                        <p><strong>Volumes:</strong></p>
                        <ul className="endpoint-list">
                          {selectedPod.volumes.map((v) => {
                            const pvc = pvcs.find((c) => c.name === v.claimName && c.namespace === selectedPod.namespace);
                            return (
                              <li key={v.name}>
                                <button className="xref" onClick={() => { if (pvc) { setActiveFace("storage"); setActiveEntity(pvc.id); } }}>
                                  {v.name} → PVC/{v.claimName} {pvc ? `(${pvc.status})` : "(missing)"}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                    <div className="entity-actions">
                      <button onClick={() => enqueue({ type: "DeletePod", name: selectedPod.name, namespace: selectedPod.namespace })}>Delete pod</button>
                    </div>
                  </>}

                  {selectedSvc && <>
                    <p><strong>Type:</strong> {selectedSvc.type}</p>
                    <p><strong>Namespace:</strong> {selectedSvc.namespace}</p>
                    <p><strong>Selector:</strong> deployment={deployments.find((d) => d.id === selectedSvc.selector.deploymentId)?.name}</p>
                    <p><strong>Endpoints:</strong> {selectedSvc.endpoints.length}</p>
                    <ul className="endpoint-list">
                      {selectedSvc.endpoints.map((eid) => {
                        const p = pods.find((x) => x.id === eid);
                        return (
                          <li key={eid}>
                            <button className="xref" onClick={() => { setActiveFace("pods"); setActiveEntity(eid); }}>
                              {p?.name ?? eid}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="entity-actions">
                      <button onClick={() => enqueue({ type: "DeleteService", name: selectedSvc.name, namespace: selectedSvc.namespace })}>Delete service</button>
                    </div>
                  </>}

                  {selectedEgress && <>
                    <p><strong>Host:</strong> {selectedEgress.host}</p>
                    <p><strong>Protocol:</strong> {selectedEgress.protocol}</p>
                    <p><strong>Used by:</strong></p>
                    <ul className="endpoint-list">
                      {selectedEgress.usedBy.length === 0 && <li>(no consumers)</li>}
                      {selectedEgress.usedBy.map((d) => {
                        const dep = deployments.find((x) => x.name === d);
                        return (
                          <li key={d}>
                            <button className="xref" onClick={() => { setActiveFace("pods"); if (dep) { /* deployment cards live on pods face */ } }}>
                              deployment/{d}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="entity-actions">
                      <button onClick={() => enqueue({ type: "DeleteEgressTarget", name: selectedEgress.name })}>Delete egress target</button>
                    </div>
                  </>}

                  {selectedIngress && <>
                    <p><strong>Host:</strong> {selectedIngress.host}</p>
                    <p><strong>Service:</strong> <button className="xref" onClick={() => { const sv = services.find((s) => s.name === selectedIngress.serviceName); if (sv) setActiveEntity(sv.id); }}>{selectedIngress.serviceName}</button></p>
                    <p><strong>Namespace:</strong> {selectedIngress.namespace}</p>
                    <div className="entity-actions">
                      <button onClick={() => enqueue({ type: "DeleteIngress", name: selectedIngress.name, namespace: selectedIngress.namespace })}>Delete ingress</button>
                    </div>
                  </>}

                  {selectedPv && <>
                    <p><strong>Capacity:</strong> {selectedPv.capacityGi}Gi</p>
                    <p><strong>Storage class:</strong> {selectedPv.storageClass}</p>
                    <p><strong>Status:</strong> <span className={`status status-${selectedPv.status}`}>{selectedPv.status}</span></p>
                    <p><strong>Bound claim:</strong> {selectedPv.boundClaim ? <button className="xref" onClick={() => setActiveEntity(selectedPv.boundClaim!)}>{pvcs.find((c) => c.id === selectedPv.boundClaim)?.name ?? selectedPv.boundClaim}</button> : "—"}</p>
                  </>}

                  {selectedPvc && <>
                    <p><strong>Namespace:</strong> {selectedPvc.namespace}</p>
                    <p><strong>Status:</strong> <span className={`status status-${selectedPvc.status}`}>{selectedPvc.status}</span></p>
                    <p><strong>Capacity request:</strong> {selectedPvc.capacityGi}Gi</p>
                    <p><strong>Storage class:</strong> {selectedPvc.storageClass}</p>
                    <p><strong>Bound volume:</strong> {selectedPvc.boundVolume ? <button className="xref" onClick={() => setActiveEntity(selectedPvc.boundVolume!)}>{pvs.find((v) => v.id === selectedPvc.boundVolume)?.name ?? selectedPvc.boundVolume}</button> : "—"}</p>
                    <p><strong>Mounted by:</strong></p>
                    <ul className="endpoint-list">
                      {pods.filter((p) => p.namespace === selectedPvc.namespace && p.volumes.some((v) => v.claimName === selectedPvc.name)).map((p) => (
                        <li key={p.id}>
                          <button className="xref" onClick={() => { setActiveFace("pods"); setActiveEntity(p.id); }}>{p.name}</button>
                        </li>
                      ))}
                    </ul>
                    <div className="entity-actions">
                      <button onClick={() => enqueue({ type: "DeletePVC", name: selectedPvc.name, namespace: selectedPvc.namespace })}>Delete PVC</button>
                    </div>
                  </>}

                  {selectedCm && <>
                    <p><strong>Namespace:</strong> {selectedCm.namespace}</p>
                    <p><strong>Keys:</strong> {Object.keys(selectedCm.data).length}</p>
                    <pre className="kv-block">{Object.entries(selectedCm.data).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
                  </>}

                  {selectedSecret && <>
                    <p><strong>Namespace:</strong> {selectedSecret.namespace}</p>
                    <p><strong>Keys:</strong> {Object.keys(selectedSecret.data).length} <em>(opaque)</em></p>
                    <pre className="kv-block">{Object.keys(selectedSecret.data).map((k) => `${k}: ●●●●`).join("\n")}</pre>
                  </>}

                  {selectedNs && <>
                    <p><strong>Color:</strong> <span style={{ color: selectedNs.color }}>{selectedNs.color}</span></p>
                    <p><strong>Pods:</strong> {pods.filter((p) => p.namespace === selectedNs.name).length}</p>
                    <p><strong>Deployments:</strong> {deployments.filter((d) => d.namespace === selectedNs.name).length}</p>
                    <p><strong>Services:</strong> {services.filter((s) => s.namespace === selectedNs.name).length}</p>
                    <p><strong>PVCs:</strong> {pvcs.filter((c) => c.namespace === selectedNs.name).length}</p>
                    <p><strong>ConfigMaps:</strong> {configMaps.filter((c) => c.namespace === selectedNs.name).length}</p>
                    <p><strong>Secrets:</strong> {secrets.filter((c) => c.namespace === selectedNs.name).length}</p>
                    {selectedNs.name !== "default" && selectedNs.name !== "kube-system" && (
                      <div className="entity-actions">
                        <button onClick={() => enqueue({ type: "DeleteNamespace", name: selectedNs.name })}>Delete namespace</button>
                      </div>
                    )}
                  </>}

                  {selectedDs && <>
                    <p><strong>Namespace:</strong> {selectedDs.namespace}</p>
                    <p><strong>Image:</strong> {selectedDs.image}</p>
                    <p><strong>Pods (one per worker):</strong> {pods.filter((p) => p.ownerRef === selectedDs.id && p.phase !== "Terminating").length} / {nodes.filter((n) => n.role === "worker").length}</p>
                    <ul className="endpoint-list">
                      {pods.filter((p) => p.ownerRef === selectedDs.id && p.phase !== "Terminating").map((p) => (
                        <li key={p.id}><button className="xref" onClick={() => { setActiveFace("pods"); setActiveEntity(p.id); }}>{p.name} ({p.phase})</button></li>
                      ))}
                    </ul>
                    <div className="entity-actions">
                      <button onClick={() => enqueue({ type: "DeleteDaemonSet", name: selectedDs.name, namespace: selectedDs.namespace })}>Delete daemonset</button>
                    </div>
                  </>}

                  {selectedJob && <>
                    <p><strong>Namespace:</strong> {selectedJob.namespace}</p>
                    <p><strong>Image:</strong> {selectedJob.image}</p>
                    <p><strong>Completions:</strong> {selectedJob.succeeded} / {selectedJob.completions}</p>
                    <ul className="endpoint-list">
                      {pods.filter((p) => p.ownerRef === selectedJob.id).map((p) => (
                        <li key={p.id}><button className="xref" onClick={() => { setActiveFace("pods"); setActiveEntity(p.id); }}>{p.name} <span className={`status status-${p.phase}`}>{p.phase}</span></button></li>
                      ))}
                    </ul>
                    <div className="entity-actions">
                      <button onClick={() => enqueue({ type: "DeleteJob", name: selectedJob.name, namespace: selectedJob.namespace })}>Delete job</button>
                    </div>
                  </>}

                  {selectedCron && <>
                    <p><strong>Namespace:</strong> {selectedCron.namespace}</p>
                    <p><strong>Image:</strong> {selectedCron.image}</p>
                    <p><strong>Schedule:</strong> every {selectedCron.schedule} ticks</p>
                    <p><strong>Spawned jobs:</strong> {jobs.filter((j) => j.name.startsWith(`${selectedCron.name}-`)).length}</p>
                    <div className="entity-actions">
                      <button onClick={() => enqueue({ type: "DeleteCronJob", name: selectedCron.name, namespace: selectedCron.namespace })}>Delete cronjob</button>
                    </div>
                  </>}

                  {selectedHpa && (() => {
                    const dep = deployments.find((d) => d.name === selectedHpa.targetDeployment && d.namespace === selectedHpa.namespace);
                    return <>
                      <p><strong>Namespace:</strong> {selectedHpa.namespace}</p>
                      <p><strong>Target:</strong> Deployment/{selectedHpa.targetDeployment}</p>
                      <p><strong>Replica range:</strong> {selectedHpa.minReplicas} – {selectedHpa.maxReplicas}</p>
                      <p><strong>Target CPU:</strong> {selectedHpa.targetCpuPercent}%</p>
                      <p><strong>Current CPU:</strong> {dep?.load ?? 0}%</p>
                      <p><strong>Current replicas:</strong> {dep?.desiredReplicas ?? 0}</p>
                      <div className="entity-actions">
                        <button onClick={() => enqueue({ type: "SetLoad", deployment: selectedHpa.targetDeployment, namespace: selectedHpa.namespace, load: (dep?.load ?? 0) + 40 })}>+40% load</button>
                        <button onClick={() => enqueue({ type: "SetLoad", deployment: selectedHpa.targetDeployment, namespace: selectedHpa.namespace, load: Math.max(0, (dep?.load ?? 0) - 40) })}>-40% load</button>
                        <button onClick={() => enqueue({ type: "DeleteHPA", name: selectedHpa.name, namespace: selectedHpa.namespace })}>Delete HPA</button>
                      </div>
                    </>;
                  })()}

                  {selectedDeployment && (() => {
                    const own = pods.filter((p) => p.deploymentId === selectedDeployment.id);
                    const ready = own.filter((p) => p.phase === "Running" && p.containers.every((c) => c.ready)).length;
                    const rss = replicaSets.filter((r) => r.deploymentId === selectedDeployment.id);
                    return <>
                      <p><strong>Namespace:</strong> {selectedDeployment.namespace}</p>
                      <p><strong>Image:</strong> {selectedDeployment.image}</p>
                      <p><strong>Ready:</strong> {ready} / {selectedDeployment.desiredReplicas}</p>
                      <p><strong>Strategy:</strong> {selectedDeployment.strategy.type} (surge {selectedDeployment.strategy.maxSurge}, maxUnavailable {selectedDeployment.strategy.maxUnavailable})</p>
                      <p><strong>Revisions:</strong> {selectedDeployment.rollouts.map((r) => `${r.revision}:${r.image}`).join(" → ")}</p>
                      <p><strong>ReplicaSets:</strong> {rss.length} <span className="concept-inline-note">(a Deployment manages one ReplicaSet per rollout revision; each keeps its pods at the desired count)</span></p>
                      <ul className="endpoint-list">
                        {own.map((p) => (
                          <li key={p.id}><button className="xref" onClick={() => setActiveEntity(p.id)}>{p.name} <span className={`status status-${p.phase}`}>{p.phase}</span></button></li>
                        ))}
                      </ul>
                      <div className="entity-actions">
                        <button onClick={() => enqueue({ type: "ScaleDeployment", name: selectedDeployment.name, namespace: selectedDeployment.namespace, replicas: selectedDeployment.desiredReplicas + 1 })}>Scale +1</button>
                        <button onClick={() => enqueue({ type: "ScaleDeployment", name: selectedDeployment.name, namespace: selectedDeployment.namespace, replicas: Math.max(0, selectedDeployment.desiredReplicas - 1) })}>Scale -1</button>
                        <button onClick={() => enqueue({ type: "DeleteDeployment", name: selectedDeployment.name, namespace: selectedDeployment.namespace })}>Delete</button>
                      </div>
                    </>;
                  })()}
                </div>

                {selectedPod?.deploymentId && (
                  <DeploymentInfoPanel deploymentId={selectedPod.deploymentId} />
                )}
              </>
            ) : (
              <ul className="concept-list">
                {activeFace === "pods" && deployments.map((d) => {
                  const own = pods.filter((p) => p.deploymentId === d.id);
                  const ready = own.filter((p) => p.phase === "Running").length;
                  const rss = replicaSets.filter((r) => r.deploymentId === d.id);
                  return (
                    <li key={d.id} className="concept-deployment">
                      <button className="concept-link" onClick={() => setActiveEntity(d.id)} style={{ padding: 0 }}>
                        <h3 style={{ color: d.color }}>{d.name} <span className="concept-inline-note">— what is this?</span></h3>
                      </button>
                      <p>ns:{d.namespace} · {ready}/{d.desiredReplicas} ready · image {d.image} · {rss.length} RS</p>
                      <div className="entity-actions">
                        <button onClick={() => enqueue({ type: "ScaleDeployment", name: d.name, namespace: d.namespace, replicas: d.desiredReplicas + 1 })}>+1</button>
                        <button onClick={() => enqueue({ type: "ScaleDeployment", name: d.name, namespace: d.namespace, replicas: Math.max(0, d.desiredReplicas - 1) })}>-1</button>
                      </div>
                      <ul className="pod-sublist">
                        {own.map((p) => (
                          <li key={p.id}>
                            <button onClick={() => setActiveEntity(p.id)} className="concept-link">
                              <span>{p.name}</span>
                              <span className={`status status-${p.phase}`}>{p.phase}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
                {activeFace === "pods" && (daemonSets.length > 0 || jobs.length > 0 || cronJobs.length > 0 || hpas.length > 0) && (
                  <li className="concept-deployment">
                    <h3 style={{ color: "#a855f7" }}>Other workloads</h3>
                    <ul className="pod-sublist">
                      {daemonSets.map((d) => (
                        <li key={d.id}><button onClick={() => setActiveEntity(d.id)} className="concept-link"><span>DaemonSet/{d.name}</span><span className="status">{pods.filter((p) => p.ownerRef === d.id && p.phase !== "Terminating").length} pods</span></button></li>
                      ))}
                      {jobs.map((j) => (
                        <li key={j.id}><button onClick={() => setActiveEntity(j.id)} className="concept-link"><span>Job/{j.name}</span><span className="status">{j.succeeded}/{j.completions}</span></button></li>
                      ))}
                      {cronJobs.map((c) => (
                        <li key={c.id}><button onClick={() => setActiveEntity(c.id)} className="concept-link"><span>CronJob/{c.name}</span><span className="status">every {c.schedule}t</span></button></li>
                      ))}
                      {hpas.map((h) => (
                        <li key={h.id}><button onClick={() => setActiveEntity(h.id)} className="concept-link"><span>HPA/{h.name}</span><span className="status">{h.minReplicas}-{h.maxReplicas}</span></button></li>
                      ))}
                    </ul>
                  </li>
                )}
                {(faceEntities as Array<{ id: string; name: string }>).map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => setActiveEntity(e.id)}
                      className="concept-link"
                    >
                      <h3>{e.name}</h3>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function DeploymentInfoPanel({ deploymentId }: { deploymentId: string }) {
  const deployments = useCluster((s) => s.deployments);
  const replicaSets = useCluster((s) => s.replicaSets);
  const d = deployments.find((x) => x.id === deploymentId);
  const rss = replicaSets.filter((r) => r.deploymentId === deploymentId);
  if (!d) return null;
  return (
    <div className="deployment-info">
      <h4>Deployment {d.name}</h4>
      <p>ns:{d.namespace} · desired {d.desiredReplicas} · strategy {d.strategy.type} · surge {d.strategy.maxSurge} · maxUnavailable {d.strategy.maxUnavailable}</p>
      <p>revisions: {d.rollouts.map((r) => `${r.revision}(${r.image})`).join(" → ")}</p>
      <p>RS: {rss.map((r) => `${r.templateHash}=${r.desiredReplicas}`).join(", ")}</p>
      {d.volumeClaims.length > 0 && <p>volumeClaims: {d.volumeClaims.join(", ")}</p>}
    </div>
  );
}
