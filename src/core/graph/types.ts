/**
 * Graph IR Types for Inkwell
 * Supported node types: service, queue, worker, database
 */

export type NodeType = 'service' | 'queue' | 'worker' | 'database';

export interface Position {
  x: number;
  y: number;
}

export interface NodePortConfig {
  internalPort?: number;
  hostPort?: number;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  position?: Position;
  ports?: NodePortConfig;
  env?: Record<string, string>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GraphMetadata {
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphIR {
  version: '1.0';
  metadata: GraphMetadata;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const SUPPORTED_NODE_TYPES: readonly NodeType[] = [
  'service',
  'queue',
  'worker',
  'database',
] as const;

export function isSupportedNodeType(type: string): type is NodeType {
  return SUPPORTED_NODE_TYPES.includes(type as NodeType);
}
