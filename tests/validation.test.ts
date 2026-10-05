import { describe, expect, it } from 'vitest';
import { createEdge, createEmptyGraph, createNode } from '../src/core/graph/builder';
import { CANONICAL_VERTICAL_SLICE_GRAPH } from '../src/core/graph/fixtures';
import { GraphIR, NodeType } from '../src/core/graph/types';
import { validateGraphIR } from '../src/core/validation/validator';

describe('Graph Validation', () => {
  it('validates that the canonical vertical slice graph is valid', () => {
    const result = validateGraphIR(CANONICAL_VERTICAL_SLICE_GRAPH);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects empty graphs', () => {
    const emptyGraph = createEmptyGraph();
    const result = validateGraphIR(emptyGraph);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'EMPTY_GRAPH')).toBe(true);
  });

  it('rejects duplicate node IDs', () => {
    const graph: GraphIR = {
      version: '1.0',
      metadata: { name: 'Dup Test', version: '1.0', createdAt: '', updatedAt: '' },
      nodes: [
        { id: 'node-1', type: 'service', label: 'Service A' },
        { id: 'node-1', type: 'worker', label: 'Worker B' },
      ],
      edges: [],
    };

    const result = validateGraphIR(graph);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DUPLICATE_NODE_ID')).toBe(true);
  });

  it('rejects missing or empty node IDs', () => {
    const graph: GraphIR = {
      version: '1.0',
      metadata: { name: 'Missing ID Test', version: '1.0', createdAt: '', updatedAt: '' },
      nodes: [
        { id: '', type: 'service', label: 'Service A' },
      ],
      edges: [],
    };

    const result = validateGraphIR(graph);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_NODE_ID')).toBe(true);
  });

  it('rejects invalid node types', () => {
    const graph: GraphIR = {
      version: '1.0',
      metadata: { name: 'Invalid Type Test', version: '1.0', createdAt: '', updatedAt: '' },
      nodes: [
        { id: 'node-1', type: 'serverless-func' as unknown as NodeType, label: 'Invalid' },
      ],
      edges: [],
    };

    const result = validateGraphIR(graph);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_NODE_TYPE')).toBe(true);
  });

  it('rejects dangling edge source and target references', () => {
    const graph: GraphIR = {
      version: '1.0',
      metadata: { name: 'Dangling Edge Test', version: '1.0', createdAt: '', updatedAt: '' },
      nodes: [
        { id: 'node-1', type: 'service', label: 'Service A' },
        { id: 'node-2', type: 'queue', label: 'Queue B' },
      ],
      edges: [
        createEdge('node-1', 'non-existent-target'),
        createEdge('non-existent-source', 'node-2'),
      ],
    };

    const result = validateGraphIR(graph);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DANGLING_EDGE_TARGET')).toBe(true);
    expect(result.errors.some((e) => e.code === 'DANGLING_EDGE_SOURCE')).toBe(true);
  });

  it('flags disconnected nodes in multi-node architectures', () => {
    const graph: GraphIR = {
      version: '1.0',
      metadata: { name: 'Disconnected Test', version: '1.0', createdAt: '', updatedAt: '' },
      nodes: [
        createNode({ id: 'connected-1', type: 'service' }),
        createNode({ id: 'connected-2', type: 'queue' }),
        createNode({ id: 'isolated-node', type: 'database', label: 'Isolated DB' }),
      ],
      edges: [
        createEdge('connected-1', 'connected-2'),
      ],
    };

    const result = validateGraphIR(graph);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'DISCONNECTED_NODE' && e.nodeId === 'isolated-node')).toBe(true);
  });

  it('emits warnings for architectural smells like queue without producer or consumer', () => {
    const graph: GraphIR = {
      version: '1.0',
      metadata: { name: 'Queue Smell Test', version: '1.0', createdAt: '', updatedAt: '' },
      nodes: [
        createNode({ id: 'queue-1', type: 'queue' }),
        createNode({ id: 'worker-1', type: 'worker' }),
      ],
      edges: [
        createEdge('queue-1', 'worker-1'),
      ],
    };

    const result = validateGraphIR(graph);
    expect(result.warnings.some((w) => w.code === 'QUEUE_WITHOUT_PRODUCER')).toBe(true);
  });
});
