import { describe, expect, it } from 'vitest';
import { compileGraph } from '../src/core/compiler/compiler';
import { CANONICAL_VERTICAL_SLICE_GRAPH } from '../src/core/graph/fixtures';
import { GraphIR } from '../src/core/graph/types';

describe('Deterministic Compiler', () => {
  it('successfully compiles the canonical vertical slice graph (API -> Queue -> Worker -> DB)', () => {
    const project = compileGraph(CANONICAL_VERTICAL_SLICE_GRAPH);

    expect(project.projectName).toBe('canonical-pipeline-api-queue-worker-db');
    expect(project.services).toHaveLength(4);

    const serviceNames = project.services.map((s) => s.serviceName);
    expect(serviceNames).toContain('api-gateway');
    expect(serviceNames).toContain('task-queue');
    expect(serviceNames).toContain('processing-worker');
    expect(serviceNames).toContain('primary-db');

    // Check compose YAML content
    expect(project.composeYaml).toContain('services:');
    expect(project.composeYaml).toContain('api-gateway:');
    expect(project.composeYaml).toContain('task-queue:');
    expect(project.composeYaml).toContain('processing-worker:');
    expect(project.composeYaml).toContain('primary-db:');
    expect(project.composeYaml).toContain('inkwell-net:');

    // Root files check
    expect(project.rootFiles.some((f) => f.path === 'docker-compose.yml')).toBe(true);
    expect(project.rootFiles.some((f) => f.path === 'README.md')).toBe(true);
    expect(project.rootFiles.some((f) => f.path === 'graph.ir.json')).toBe(true);
  });

  it('guarantees 100% byte-for-byte deterministic compilation output', () => {
    const run1 = compileGraph(CANONICAL_VERTICAL_SLICE_GRAPH);
    const run2 = compileGraph(CANONICAL_VERTICAL_SLICE_GRAPH);

    expect(run1.composeYaml).toBe(run2.composeYaml);
    expect(run1.services.length).toBe(run2.services.length);

    for (let i = 0; i < run1.services.length; i++) {
      expect(run1.services[i].serviceName).toBe(run2.services[i].serviceName);
      expect(run1.services[i].hostPort).toBe(run2.services[i].hostPort);
      expect(run1.services[i].internalPort).toBe(run2.services[i].internalPort);
      expect(run1.services[i].dependsOn).toEqual(run2.services[i].dependsOn);
    }
  });

  it('generates executable service templates and health endpoints', () => {
    const project = compileGraph(CANONICAL_VERTICAL_SLICE_GRAPH);

    const apiGateway = project.services.find((s) => s.serviceName === 'api-gateway')!;
    expect(apiGateway.healthEndpoint).toBe('/health');
    expect(apiGateway.files.some((f) => f.path === 'server.js')).toBe(true);
    expect(apiGateway.files.some((f) => f.path === 'Dockerfile')).toBe(true);

    const serverJs = apiGateway.files.find((f) => f.path === 'server.js')!.content;
    expect(serverJs).toContain('/health');
    expect(serverJs).toContain('res.writeHead(200');

    const worker = project.services.find((s) => s.serviceName === 'processing-worker')!;
    expect(worker.healthEndpoint).toBe('/health');
    expect(worker.files.some((f) => f.path === 'worker.js')).toBe(true);

    const workerJs = worker.files.find((f) => f.path === 'worker.js')!.content;
    expect(workerJs).toContain('/health');
  });

  it('refuses to compile invalid graphs and throws structured errors', () => {
    const invalidGraph: GraphIR = {
      version: '1.0',
      metadata: { name: 'Invalid', version: '1.0', createdAt: '', updatedAt: '' },
      nodes: [],
      edges: [],
    };

    expect(() => compileGraph(invalidGraph)).toThrow(/EMPTY_GRAPH/);
  });
});
