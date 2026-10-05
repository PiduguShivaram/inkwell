import { describe, expect, it } from 'vitest';
import { bridgeManager } from '@/core/bridge/bridge-manager';
import { HandoffRecord } from '@/core/bridge/types';
import { compileGraph } from '@/core/compiler/compiler';
import { CANONICAL_VERTICAL_SLICE_GRAPH } from '@/core/graph/fixtures';
import { GraphIR } from '@/core/graph/types';
import { validateGraphIR } from '@/core/validation/validator';

describe('Phase 4: Office Kit & Phone/Laptop Bridge Architecture', () => {
  it('preserves exact node IDs, node types, connections, and spatial coordinates across handoff', () => {
    const originalGraph = CANONICAL_VERTICAL_SLICE_GRAPH;
    const validation = validateGraphIR(originalGraph);
    expect(validation.isValid).toBe(true);

    // Simulate serialization & deserialization across Office Kit Super Clipboard
    const clipboardPayload = JSON.stringify(originalGraph);
    const receivedGraph = JSON.parse(clipboardPayload) as GraphIR;

    // Verify preservation
    expect(receivedGraph.nodes.length).toBe(originalGraph.nodes.length);
    expect(receivedGraph.edges.length).toBe(originalGraph.edges.length);

    for (let i = 0; i < originalGraph.nodes.length; i++) {
      const orig = originalGraph.nodes[i];
      const received = receivedGraph.nodes[i];
      expect(received.id).toBe(orig.id);
      expect(received.type).toBe(orig.type);
      expect(received.label).toBe(orig.label);
      expect(received.ports?.hostPort).toBe(orig.ports?.hostPort);
      expect(received.position?.x).toBe(orig.position?.x);
      expect(received.position?.y).toBe(orig.position?.y);
    }

    for (let i = 0; i < originalGraph.edges.length; i++) {
      const orig = originalGraph.edges[i];
      const received = receivedGraph.edges[i];
      expect(received.source).toBe(orig.source);
      expect(received.target).toBe(orig.target);
    }
  });

  it('rejects invalid or malformed graph payloads transmitted over the bridge', () => {
    const invalidGraph: GraphIR = {
      version: '1.0',
      metadata: {
        name: 'broken-graph',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      nodes: [
        {
          id: 'api-service',
          type: 'service',
          label: 'API Service',
          position: { x: 100, y: 100 },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'api-service',
          target: 'non-existent-target-node',
        },
      ],
    };

    const validation = validateGraphIR(invalidGraph);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.code === 'DANGLING_EDGE_TARGET')).toBe(true);
  });

  it('records handoff history and retrieves latest handoff event accurately', () => {
    const testRecord: HandoffRecord = {
      id: 'test-handoff-001',
      timestamp: new Date().toISOString(),
      source: 'office-kit-clipboard',
      graph: CANONICAL_VERTICAL_SLICE_GRAPH,
      validation: validateGraphIR(CANONICAL_VERTICAL_SLICE_GRAPH),
      compilation: {
        success: true,
        projectName: 'canonical-pipeline-api-queue-worker-db',
        serviceCount: 4,
      },
    };

    bridgeManager.recordHandoff(testRecord);
    const last = bridgeManager.getLastHandoff();
    expect(last).not.toBeNull();
    expect(last?.id).toBe('test-handoff-001');
    expect(last?.source).toBe('office-kit-clipboard');
    expect(last?.compilation?.serviceCount).toBe(4);
  });

  it('deterministically compiles handed-off graph with exact matching service specs', () => {
    const project = compileGraph(CANONICAL_VERTICAL_SLICE_GRAPH);
    expect(project.services.length).toBe(4);

    const serviceNames = project.services.map((s) => s.serviceName);
    expect(serviceNames).toContain('api-gateway');
    expect(serviceNames).toContain('task-queue');
    expect(serviceNames).toContain('processing-worker');
    expect(serviceNames).toContain('primary-db');

    // Verify Docker Compose YAML is generated deterministically
    expect(project.composeYaml).toContain('name: canonical-pipeline-api-queue-worker-db');
    expect(project.composeYaml).toContain('services:');
    expect(project.composeYaml).toContain('api-gateway:');
    expect(project.composeYaml).toContain('processing-worker:');
  });

  it('reports genuine bridge environment capabilities and endpoints', async () => {
    const status = await bridgeManager.getEnvironmentStatus();
    expect(status.officeKitSupported).toBe(true);
    expect(status.capabilities.superClipboard).toBe(true);
    expect(status.capabilities.easyShareFileDrop).toBe(true);
    expect(status.capabilities.screenMirroring).toBe(true);
    expect(status.networkEndpoints.localhost).toBe('http://localhost:3005');
  });
});
