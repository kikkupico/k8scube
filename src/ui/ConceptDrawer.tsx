import { useMemo } from "react";
import { useApp } from "../state/store";
import { useCluster } from "../state/clusterStore";
import { faceMeta } from "../content/concepts";

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
    selectedPv ?? selectedPvc ?? selectedCm ?? selectedSecret ?? selectedNs ?? null;

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
                <div className="entity-details">
                  <p><strong>ID:</strong> {selectedEntity.id}</p>

                  {selectedNode && <>
                    <p><strong>Role:</strong> {selectedNode.role}</p>
                    <p><strong>Status:</strong> <span className={`status status-${selectedNode.status}`}>{selectedNode.status}</span></p>
                    <p><strong>Pods on node:</strong> {pods.filter((p) => p.nodeId === selectedNode.id).length}</p>
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
                    <p><strong>Deployment:</strong> {deployments.find((d) => d.id === selectedPod.deploymentId)?.name ?? "-"}</p>
                    <p><strong>Image:</strong> {selectedPod.containers[0]?.image ?? "-"}</p>
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
                      <h3 style={{ color: d.color }}>{d.name}</h3>
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
