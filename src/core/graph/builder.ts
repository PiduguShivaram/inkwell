import { GraphEdge, GraphIR, GraphNode, NodeType } from './types';

export function createEmptyGraph(name = 'New Architecture'): GraphIR {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    metadata: {
      name,
      version: '0.1.0',
      createdAt: now,
      updatedAt: now,
    },
    nodes: [],
    edges: [],
  };
}

export function createNode(params: {
  id?: string;
  type: NodeType;
  label?: string;
  position?: { x: number; y: number };
}): GraphNode {
  const fallbackLabel = `${params.type.charAt(0).toUpperCase() + params.type.slice(1)}`;
  const id = params.id || `${params.type}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  return {
    id,
    type: params.type,
    label: params.label || fallbackLabel,
    position: params.position || { x: 100, y: 100 },
  };
}

export function createEdge(source: string, target: string, label?: string): GraphEdge {
  return {
    id: `edge-${source}->${target}`,
    source,
    target,
    label,
  };
}

export function addNodeToGraph(graph: GraphIR, node: GraphNode): GraphIR {
  return {
    ...graph,
    metadata: {
      ...graph.metadata,
      updatedAt: new Date().toISOString(),
    },
    nodes: [...graph.nodes, node],
  };
}

export function removeNodeFromGraph(graph: GraphIR, nodeId: string): GraphIR {
  return {
    ...graph,
    metadata: {
      ...graph.metadata,
      updatedAt: new Date().toISOString(),
    },
    nodes: graph.nodes.filter((n) => n.id !== nodeId),
    // Remove all associated edges
    edges: graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
  };
}

export function updateNodeInGraph(graph: GraphIR, nodeId: string, patch: Partial<GraphNode>): GraphIR {
  return {
    ...graph,
    metadata: {
      ...graph.metadata,
      updatedAt: new Date().toISOString(),
    },
    nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
  };
}

export function addEdgeToGraph(graph: GraphIR, edge: GraphEdge): GraphIR {
  // Prevent duplicate edges
  const exists = graph.edges.some((e) => e.source === edge.source && e.target === edge.target);
  if (exists) {
    return graph;
  }
  return {
    ...graph,
    metadata: {
      ...graph.metadata,
      updatedAt: new Date().toISOString(),
    },
    edges: [...graph.edges, edge],
  };
}

export function removeEdgeFromGraph(graph: GraphIR, edgeId: string): GraphIR {
  return {
    ...graph,
    metadata: {
      ...graph.metadata,
      updatedAt: new Date().toISOString(),
    },
    edges: graph.edges.filter((e) => e.id !== edgeId),
  };
}
