import { describe, expect, it } from 'vitest';
import {
  addEdgeToGraph,
  addNodeToGraph,
  createEdge,
  createEmptyGraph,
  createNode,
  removeEdgeFromGraph,
  removeNodeFromGraph,
  updateNodeInGraph,
} from '../src/core/graph/builder';
import { CANONICAL_VERTICAL_SLICE_GRAPH } from '../src/core/graph/fixtures';
import { isSupportedNodeType } from '../src/core/graph/types';

describe('Graph IR & Builder', () => {
  it('creates an empty Graph IR with required structure', () => {
    const graph = createEmptyGraph('Test Graph');
    expect(graph.version).toBe('1.0');
    expect(graph.metadata.name).toBe('Test Graph');
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it('validates supported node types', () => {
    expect(isSupportedNodeType('service')).toBe(true);
    expect(isSupportedNodeType('queue')).toBe(true);
    expect(isSupportedNodeType('worker')).toBe(true);
    expect(isSupportedNodeType('database')).toBe(true);
    expect(isSupportedNodeType('lambda' as unknown as string)).toBe(false);
    expect(isSupportedNodeType('invalid' as unknown as string)).toBe(false);
  });

  it('adds and updates nodes in the graph', () => {
    let graph = createEmptyGraph();
    const node = createNode({ id: 'svc-1', type: 'service', label: 'Auth Service' });
    graph = addNodeToGraph(graph, node);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].id).toBe('svc-1');
    expect(graph.nodes[0].label).toBe('Auth Service');

    graph = updateNodeInGraph(graph, 'svc-1', { label: 'Authentication API' });
    expect(graph.nodes[0].label).toBe('Authentication API');
  });

  it('adds and removes edges, preventing duplicates', () => {
    let graph = createEmptyGraph();
    const n1 = createNode({ id: 'n1', type: 'service' });
    const n2 = createNode({ id: 'n2', type: 'queue' });
    graph = addNodeToGraph(graph, n1);
    graph = addNodeToGraph(graph, n2);

    const edge = createEdge('n1', 'n2', 'publishes');
    graph = addEdgeToGraph(graph, edge);
    expect(graph.edges).toHaveLength(1);

    // Adding same edge again should be a no-op
    graph = addEdgeToGraph(graph, edge);
    expect(graph.edges).toHaveLength(1);

    graph = removeEdgeFromGraph(graph, edge.id);
    expect(graph.edges).toHaveLength(0);
  });

  it('removes associated edges when a node is removed', () => {
    let graph = createEmptyGraph();
    graph = addNodeToGraph(graph, createNode({ id: 'n1', type: 'service' }));
    graph = addNodeToGraph(graph, createNode({ id: 'n2', type: 'queue' }));
    graph = addEdgeToGraph(graph, createEdge('n1', 'n2'));

    expect(graph.edges).toHaveLength(1);
    graph = removeNodeFromGraph(graph, 'n1');
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });

  it('canonical vertical slice graph conforms to specification', () => {
    const graph = CANONICAL_VERTICAL_SLICE_GRAPH;
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toHaveLength(3);

    const types = graph.nodes.map((n) => n.type);
    expect(types).toEqual(['service', 'queue', 'worker', 'database']);

    // Check pipeline flow
    expect(graph.edges[0].source).toBe('api-gateway');
    expect(graph.edges[0].target).toBe('task-queue');
    expect(graph.edges[1].source).toBe('task-queue');
    expect(graph.edges[1].target).toBe('processing-worker');
    expect(graph.edges[2].source).toBe('processing-worker');
    expect(graph.edges[2].target).toBe('primary-db');
  });
});
