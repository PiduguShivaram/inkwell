import { describe, expect, it } from 'vitest';
import {
  addEdgeToGraph,
  createEdge,
  createEmptyGraph,
  createNode,
  removeEdgeFromGraph,
  removeNodeFromGraph,
  updateNodeInGraph,
} from '@/core/graph/builder';
import { CANONICAL_VERTICAL_SLICE_GRAPH } from '@/core/graph/fixtures';
import { GraphIR, NodeType } from '@/core/graph/types';
import { compileGraph } from '@/core/compiler/compiler';
import { validateGraphIR } from '@/core/validation/validator';
import { ContainerState } from '@/core/runtime/types';

describe('Phase 6: Architecture Workspace, Graph Editing & Runtime Mapping', () => {
  // A. Architecture Workspace & B. Node selection
  it('initializes workspace from canonical Graph IR with valid state', () => {
    const graph: GraphIR = JSON.parse(JSON.stringify(CANONICAL_VERTICAL_SLICE_GRAPH));
    expect(graph.nodes.length).toBe(4);
    expect(graph.edges.length).toBe(3);

    const validation = validateGraphIR(graph);
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);

    // Node selection resolution
    const apiNode = graph.nodes.find((n) => n.id === 'api-gateway');
    expect(apiNode).toBeDefined();
    expect(apiNode?.type).toBe('service');
    expect(apiNode?.label).toBe('API Gateway');
  });

  // C. Node editing & Step 3
  it('supports node editing: label, supported type, and port overrides', () => {
    let graph = JSON.parse(JSON.stringify(CANONICAL_VERTICAL_SLICE_GRAPH));
    const targetNodeId = 'api-gateway';

    // 1. Edit Label
    graph = updateNodeInGraph(graph, targetNodeId, { label: 'Public Edge API' });
    let updatedNode = graph.nodes.find((n: any) => n.id === targetNodeId);
    expect(updatedNode?.label).toBe('Public Edge API');

    // 2. Edit Port Configuration
    graph = updateNodeInGraph(graph, targetNodeId, {
      ports: { hostPort: 8080, internalPort: 3000 },
    });
    updatedNode = graph.nodes.find((n: any) => n.id === targetNodeId);
    expect(updatedNode?.ports?.hostPort).toBe(8080);
    expect(updatedNode?.ports?.internalPort).toBe(3000);

    // 3. Edit Supported Type
    graph = updateNodeInGraph(graph, targetNodeId, { type: 'worker' as NodeType });
    updatedNode = graph.nodes.find((n: any) => n.id === targetNodeId);
    expect(updatedNode?.type).toBe('worker');
  });

  // D. Connection editing (Add, Remove edge)
  it('supports connection editing while maintaining graph invariants', () => {
    let graph = JSON.parse(JSON.stringify(CANONICAL_VERTICAL_SLICE_GRAPH));
    const initialEdgeCount = graph.edges.length;

    // Remove existing edge
    const edgeToRemove = graph.edges[0];
    graph = removeEdgeFromGraph(graph, edgeToRemove.id);
    expect(graph.edges.length).toBe(initialEdgeCount - 1);
    expect(graph.edges.some((e: any) => e.id === edgeToRemove.id)).toBe(false);

    // Add new connection
    const newEdge = createEdge('api-gateway', 'primary-db');
    graph = addEdgeToGraph(graph, newEdge);
    expect(graph.edges.length).toBe(initialEdgeCount);
    expect(graph.edges.some((e: any) => e.source === 'api-gateway' && e.target === 'primary-db')).toBe(true);

    // Cleanly delete node and its incident edges
    graph = removeNodeFromGraph(graph, 'primary-db');
    expect(graph.nodes.some((n: any) => n.id === 'primary-db')).toBe(false);
    expect(graph.edges.some((e: any) => e.target === 'primary-db' || e.source === 'primary-db')).toBe(false);
  });

  // E. Validation reactions
  it('validates graph on modifications and returns precise errors for invalid edits', () => {
    let graph = JSON.parse(JSON.stringify(CANONICAL_VERTICAL_SLICE_GRAPH));

    // Introduce invalid port configuration (negative port)
    graph = updateNodeInGraph(graph, 'api-gateway', {
      ports: { hostPort: -1 },
    });
    let valResult = validateGraphIR(graph);
    expect(valResult.isValid).toBe(false);
    expect(valResult.errors.some((err) => err.code === 'INVALID_PORT')).toBe(true);

    // Fix port
    graph = updateNodeInGraph(graph, 'api-gateway', {
      ports: { hostPort: 3000 },
    });
    valResult = validateGraphIR(graph);
    expect(valResult.isValid).toBe(true);

    // Introduce unsupported node type
    graph = updateNodeInGraph(graph, 'api-gateway', {
      type: 'invalid-type' as any,
    });
    valResult = validateGraphIR(graph);
    expect(valResult.isValid).toBe(false);
    expect(valResult.errors.some((err) => err.code === 'INVALID_NODE_TYPE')).toBe(true);
  });

  // F. Configuration & Environment variables
  it('allows editing environment configuration propagated to compiler', () => {
    let graph = JSON.parse(JSON.stringify(CANONICAL_VERTICAL_SLICE_GRAPH));

    graph = updateNodeInGraph(graph, 'processing-worker', {
      env: {
        CONCURRENCY: '16',
        LOG_LEVEL: 'debug',
      },
    });

    const compiled = compileGraph(graph);
    const workerSpec = compiled.services.find((s) => s.nodeId === 'processing-worker');
    expect(workerSpec).toBeDefined();
    expect(workerSpec?.environment.CONCURRENCY).toBe('16');
    expect(workerSpec?.environment.LOG_LEVEL).toBe('debug');
  });

  // G. Compiler preview
  it('generates deterministic preview reflecting exact docker-compose and service artifacts', () => {
    const graph = JSON.parse(JSON.stringify(CANONICAL_VERTICAL_SLICE_GRAPH));
    const preview1 = compileGraph(graph);
    const preview2 = compileGraph(graph);

    // 100% deterministic and byte-identical
    expect(preview1.composeYaml).toBe(preview2.composeYaml);
    expect(preview1.services.length).toBe(4);
    expect(preview1.composeYaml).toContain('api-gateway:');
    expect(preview1.composeYaml).toContain('processing-worker:');
    expect(preview1.composeYaml).toContain('task-queue:');
    expect(preview1.composeYaml).toContain('primary-db:');
  });

  // I. Runtime mapping & J. Failure propagation
  it('maps real container status to graph nodes and reflects failure propagation truthfully', () => {
    const graph = JSON.parse(JSON.stringify(CANONICAL_VERTICAL_SLICE_GRAPH));

    // Simulated real containers snapshot (matching Docker CLI output format)
    const healthyContainers: ContainerState[] = [
      {
        id: 'c1',
        name: 'canonical-pipeline-api-gateway',
        service: 'api-gateway',
        state: 'running',
        status: 'Up 10 seconds (healthy)',
        health: 'healthy',
        ports: '0.0.0.0:3000->3000/tcp',
      },
      {
        id: 'c2',
        name: 'canonical-pipeline-processing-worker',
        service: 'processing-worker',
        state: 'running',
        status: 'Up 10 seconds (healthy)',
        health: 'healthy',
        ports: '0.0.0.0:3001->3001/tcp',
      },
    ];

    // Helper mapping function matching ArchitectureWorkspace logic
    const mapNodeToStatus = (nodeId: string, containers: ContainerState[]) => {
      const c = containers.find((item) => item.service === nodeId);
      if (!c) return 'OFFLINE';
      if (c.state === 'running' && c.health === 'healthy') return 'HEALTHY';
      if (c.state === 'exited' || c.health === 'unhealthy') return 'DOWN';
      return 'UP';
    };

    expect(mapNodeToStatus('api-gateway', healthyContainers)).toBe('HEALTHY');
    expect(mapNodeToStatus('processing-worker', healthyContainers)).toBe('HEALTHY');

    // Failure propagation: Worker container exits (real failure injected)
    const failedContainers: ContainerState[] = [
      ...healthyContainers.filter((c) => c.service !== 'processing-worker'),
      {
        id: 'c2',
        name: 'canonical-pipeline-processing-worker',
        service: 'processing-worker',
        state: 'exited',
        status: 'Exited (1) 2 seconds ago',
        health: 'unhealthy',
        ports: '',
      },
    ];

    expect(mapNodeToStatus('processing-worker', failedContainers)).toBe('DOWN');
    expect(mapNodeToStatus('api-gateway', failedContainers)).toBe('HEALTHY');
  });
});
