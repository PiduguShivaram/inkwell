import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileGraph } from '../src/core/compiler/compiler';
import { NativeComputerVisionProvider } from '../src/core/vision/native-pipeline';
import { getDefaultVisionProvider, Phase1VisionModelProvider, Phase2VisionModelProvider } from '../src/core/vision/provider';
import { validateGraphIR } from '../src/core/validation/validator';

describe('Vision Model Architecture & Providers', () => {
  it('instantiates the Phase 1 provider and reports truthfully that no remote model is loaded', async () => {
    const provider = new Phase1VisionModelProvider();

    const isAvailable = await provider.isAvailable();
    expect(isAvailable).toBe(false);

    const info = await provider.getInfo();
    expect(info.isAvailable).toBe(false);
    expect(info.executionTarget).toBe('none');
    expect(info.statusDescription).toContain('No active inference provider configured');
  });

  it('validates image preprocessing and checks dimensions', async () => {
    const provider = new Phase2VisionModelProvider();

    const validStage = await provider.preprocessImage({
      width: 1920,
      height: 1080,
      format: 'image/png',
      sizeBytes: 154000,
      aspectRatio: 16 / 9,
    });

    expect(validStage.status).toBe('completed');
    expect(validStage.message).toContain('1920x1080');

    const invalidStage = await provider.preprocessImage({
      width: 0,
      height: 0,
      format: 'image/png',
      sizeBytes: 0,
      aspectRatio: 1,
    });

    expect(invalidStage.status).toBe('failed');
  });

  it('strictly rejects oversized images (>15MB)', async () => {
    const provider = new NativeComputerVisionProvider();

    const oversizedStage = await provider.preprocessImage({
      width: 4000,
      height: 3000,
      format: 'image/png',
      sizeBytes: 20 * 1024 * 1024,
      aspectRatio: 4 / 3,
    });

    expect(oversizedStage.status).toBe('failed');
    expect(oversizedStage.message).toContain('exceeds maximum permitted size');
  });

  it('verifies that Phase 2 Native Computer Vision provider is available and ready on local-cpu', async () => {
    const provider = new Phase2VisionModelProvider();

    const isAvailable = await provider.isAvailable();
    expect(isAvailable).toBe(true);

    const info = await provider.getInfo();
    expect(info.isAvailable).toBe(true);
    expect(info.executionTarget).toBe('local-cpu');
    expect(info.providerId).toBe('inkwell-native-cv-winocr-pipeline');
    expect(info.statusDescription).toContain('OpenCV');
  });

  it(
    'genuinely processes physical sketch fixture and reconstructs validated Graph IR',
    async () => {
      const fixturePath = path.resolve('tests/fixtures/real_sketch_api_queue_worker_db.png');
      const imageBuffer = await fs.readFile(fixturePath);
      const base64Data = `data:image/png;base64,${imageBuffer.toString('base64')}`;

      const provider = getDefaultVisionProvider();
      const result = await provider.extractGraph(base64Data, {
        width: 1200,
        height: 500,
        format: 'image/png',
        sizeBytes: imageBuffer.length,
        aspectRatio: 1200 / 500,
      });

      expect(result.success).toBe(true);
      expect(result.graph).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.providerUsed).toBe('inkwell-native-cv-winocr-pipeline');

      const graph = result.graph!;

      // 1. Verify 4 recognized nodes
      expect(graph.nodes).toHaveLength(4);
      const nodeTypes = graph.nodes.map((n) => n.type);
      expect(nodeTypes).toContain('service');
      expect(nodeTypes).toContain('queue');
      expect(nodeTypes).toContain('worker');
      expect(nodeTypes).toContain('database');

      const serviceNode = graph.nodes.find((n) => n.type === 'service')!;
      expect(serviceNode.id).toBe('api-gateway');
      expect(serviceNode.ports?.internalPort).toBe(3000);

      const queueNode = graph.nodes.find((n) => n.type === 'queue')!;
      expect(queueNode.id).toBe('task-queue');
      expect(queueNode.ports?.internalPort).toBe(6379);

      const workerNode = graph.nodes.find((n) => n.type === 'worker')!;
      expect(workerNode.id).toBe('processing-worker');
      expect(workerNode.ports?.internalPort).toBe(3001);

      const dbNode = graph.nodes.find((n) => n.type === 'database')!;
      expect(dbNode.id).toBe('primary-db');
      expect(dbNode.ports?.internalPort).toBe(5432);

      // 2. Verify directed edges
      expect(graph.edges).toHaveLength(3);
      expect(graph.edges.some((e) => e.source === 'api-gateway' && e.target === 'task-queue')).toBe(true);
      expect(graph.edges.some((e) => e.source === 'task-queue' && e.target === 'processing-worker')).toBe(true);
      expect(graph.edges.some((e) => e.source === 'processing-worker' && e.target === 'primary-db')).toBe(true);

      // 3. Verify Graph Validation passes
      const validation = validateGraphIR(graph);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // 4. Verify compatibility with deterministic compiler
      const compiled = compileGraph(graph);
      expect(compiled.projectName).toBe('canonical-pipeline-api-queue-worker-db');
      expect(compiled.services).toHaveLength(4);
      expect(compiled.composeYaml).toContain('services:');
    },
    25000
  );

  it('fails gracefully on malformed or blank image input', async () => {
    const provider = getDefaultVisionProvider();

    const result = await provider.extractGraph('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', {
      width: 1,
      height: 1,
      format: 'image/png',
      sizeBytes: 68,
      aspectRatio: 1,
    });

    // 1x1 blank image has no nodes
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
