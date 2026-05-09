import { create } from "zustand";

export interface K8sNode {
  id: string;
  name: string;
  role: "control-plane" | "worker";
  status: "Ready" | "NotReady";
}

export interface K8sPod {
  id: string;
  name: string;
  deploymentId: string;
  nodeId: string;
  status: "Running" | "Pending" | "Failed";
}

export interface K8sDeployment {
  id: string;
  name: string;
  replicas: number;
  color: string;
}

export interface K8sService {
  id: string;
  name: string;
  type: "ClusterIP" | "LoadBalancer" | "NodePort";
  deploymentId: string;
}

interface ClusterState {
  nodes: K8sNode[];
  pods: K8sPod[];
  deployments: K8sDeployment[];
  services: K8sService[];

  // Actions
  setPods: (pods: K8sPod[]) => void;
  scaleDeployment: (id: string, replicas: number) => void;
}

export const useCluster = create<ClusterState>((set) => ({
  nodes: [
    { id: "cp-1", name: "control-plane-1", role: "control-plane", status: "Ready" },
    { id: "node-1", name: "worker-node-1", role: "worker", status: "Ready" },
    { id: "node-2", name: "worker-node-2", role: "worker", status: "Ready" },
    { id: "node-3", name: "worker-node-3", role: "worker", status: "Ready" },
  ],
  deployments: [
    { id: "deploy-fe", name: "frontend", replicas: 2, color: "#0ea5e9" },
    { id: "deploy-be", name: "backend", replicas: 2, color: "#8b5cf6" },
  ],
  services: [
    { id: "svc-fe", name: "frontend-svc", type: "LoadBalancer", deploymentId: "deploy-fe" },
    { id: "svc-be", name: "backend-svc", type: "ClusterIP", deploymentId: "deploy-be" },
  ],
  pods: [
    { id: "pod-fe-1", name: "frontend-abc1", deploymentId: "deploy-fe", nodeId: "node-1", status: "Running" },
    { id: "pod-fe-2", name: "frontend-abc2", deploymentId: "deploy-fe", nodeId: "node-2", status: "Running" },
    { id: "pod-be-1", name: "backend-xyz1", deploymentId: "deploy-be", nodeId: "node-2", status: "Running" },
    { id: "pod-be-2", name: "backend-xyz2", deploymentId: "deploy-be", nodeId: "node-3", status: "Running" },
  ],

  setPods: (pods) => set({ pods }),
  scaleDeployment: (id, replicas) => set((state) => ({
    deployments: state.deployments.map(d => d.id === id ? { ...d, replicas } : d)
  })),
}));
