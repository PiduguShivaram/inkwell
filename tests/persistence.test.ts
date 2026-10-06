import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  deleteArchitecture,
  listArchitectures,
  loadArchitecture,
  saveArchitecture,
} from '@/core/persistence';
import { CANONICAL_VERTICAL_SLICE_GRAPH } from '@/core/graph/fixtures';
import { createEmptyGraph, createNode, addNodeToGraph } from '@/core/graph/builder';

describe('Phase 6: Architecture Persistence', () => {
  const testDir = path.resolve(process.cwd(), '.inkwell', 'test-architectures');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testDir)) {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    }
  });

  it('saves an architecture to disk and returns file path', async () => {
    const result = await saveArchitecture('test-canonical', CANONICAL_VERTICAL_SLICE_GRAPH, 'Canonical Test', testDir);
    expect(result.success).toBe(true);
    expect(result.name).toBe('test-canonical');
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  it('loads a previously saved architecture by name', async () => {
    const loaded = await loadArchitecture('test-canonical', testDir);
    expect(loaded.success).toBe(true);
    expect(loaded.record).toBeDefined();
    expect(loaded.record?.name).toBe('test-canonical');
    expect(loaded.record?.graph.nodes).toHaveLength(4);
    expect(loaded.record?.graph.edges).toHaveLength(3);
  });

  it('lists saved architectures with metadata and validation flags', async () => {
    let customGraph = createEmptyGraph('Custom Microservices');
    customGraph = addNodeToGraph(customGraph, createNode({ id: 'auth-api', type: 'service' }));
    await saveArchitecture('custom-microservices', customGraph, 'Custom Test', testDir);

    const list = await listArchitectures(testDir);
    expect(list.length).toBeGreaterThanOrEqual(2);

    const canonicalItem = list.find((a) => a.name === 'test-canonical');
    expect(canonicalItem).toBeDefined();
    expect(canonicalItem?.nodeCount).toBe(4);
    expect(canonicalItem?.edgeCount).toBe(3);
    expect(canonicalItem?.isValid).toBe(true);

    const customItem = list.find((a) => a.name === 'custom-microservices');
    expect(customItem).toBeDefined();
    expect(customItem?.nodeCount).toBe(1);
  });

  it('deletes an architecture file cleanly', async () => {
    const deleteResult = await deleteArchitecture('custom-microservices', testDir);
    expect(deleteResult.success).toBe(true);

    const loadAfterDelete = await loadArchitecture('custom-microservices', testDir);
    expect(loadAfterDelete.success).toBe(false);
  });

  it('handles nonexistent or empty name gracefully', async () => {
    const notFound = await loadArchitecture('non-existent-architecture', testDir);
    expect(notFound.success).toBe(false);
    expect(notFound.error).toContain('not found');

    await expect(saveArchitecture('', CANONICAL_VERTICAL_SLICE_GRAPH, undefined, testDir)).rejects.toThrow();
  });
});
