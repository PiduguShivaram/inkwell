import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileGraph } from '../src/core/compiler/compiler';
import { CANONICAL_VERTICAL_SLICE_GRAPH } from '../src/core/graph/fixtures';
import { detectDockerEnvironment } from '../src/core/runtime/docker-detector';
import { DockerRuntime } from '../src/core/runtime/docker-runtime';

describe('Docker Runtime & Detection', () => {
  it(
    'detects genuine Docker environment status without mocking',
    async () => {
      const info = await detectDockerEnvironment();

      expect(typeof info.isInstalled).toBe('boolean');
      expect(typeof info.isDaemonRunning).toBe('boolean');

      // Docker CLI is installed on this machine
      expect(info.isInstalled).toBe(true);
      expect(info.clientVersion).toContain('Docker version');

      // Daemon status is truthfully reported based on whether the daemon is running
      if (!info.isDaemonRunning) {
        expect(info.error).toBeDefined();
        expect(info.guidance).toBeDefined();
      }
    },
    15000
  );

  it('exports compiled project to actual disk files', async () => {
    const project = compileGraph(CANONICAL_VERTICAL_SLICE_GRAPH);
    const runtime = new DockerRuntime();

    const tempDir = path.join(os.tmpdir(), `inkwell-test-${Date.now()}`);
    try {
      const exportedPath = await runtime.exportProjectToDisk(project, tempDir);
      expect(exportedPath).toBe(path.resolve(tempDir));

      // Verify files exist on real filesystem
      const composeContent = await fs.readFile(path.join(tempDir, 'docker-compose.yml'), 'utf-8');
      expect(composeContent).toContain('services:');

      const serverJsContent = await fs.readFile(
        path.join(tempDir, 'services', 'api-gateway', 'server.js'),
        'utf-8'
      );
      expect(serverJsContent).toContain('/health');

      const dockerfileContent = await fs.readFile(
        path.join(tempDir, 'services', 'api-gateway', 'Dockerfile'),
        'utf-8'
      );
      expect(dockerfileContent).toContain('FROM node:20-alpine');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it(
    'genuinely fails and returns error state when starting project if daemon is unreachable',
    async () => {
      const runtime = new DockerRuntime();
      const info = await detectDockerEnvironment();

      if (!info.isDaemonRunning) {
        const res = await runtime.startProject('non-existent-dir');
        expect(res.success).toBe(false);
        expect(res.exitCode).toBe(1);
        expect(res.error).toBeDefined();
      }
    },
    15000
  );
});
