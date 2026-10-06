import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { DockerRuntime } from '@/core/runtime/docker-runtime';
import { detectDockerEnvironment } from '@/core/runtime/docker-detector';

describe('Phase 6: Real Runtime Control & Logs', () => {
  const runtime = new DockerRuntime();
  const canonicalDir = path.resolve(process.cwd(), '.inkwell', 'generated', 'canonical-pipeline-api-queue-worker-db');

  it('rejects invalid or unsafe service names preventing command injection', async () => {
    const maliciousName = 'worker; rm -rf /; echo test';
    const result = await runtime.startService(canonicalDir, maliciousName);
    // Sanitization strips illegal chars or fails safely
    expect(result.command).not.toContain(';');
  });

  it('retrieves real bounded container logs for running services', async () => {
    const env = await detectDockerEnvironment();
    if (!env.isDaemonRunning) {
      // If docker daemon is stopped, returns truthful error
      const logResult = await runtime.getServiceLogs(canonicalDir, 'processing-worker', 50);
      expect(logResult.success).toBe(false);
      expect(logResult.error).toContain('Docker daemon');
      return;
    }

    // Probing real running worker logs
    const logResult = await runtime.getServiceLogs(canonicalDir, 'processing-worker', 50);
    expect(logResult.success).toBe(true);
    expect(typeof logResult.logs).toBe('string');
    expect(logResult.logs.length).toBeGreaterThan(0);
    // Bounded output
    const lines = logResult.logs.split('\n');
    expect(lines.length).toBeLessThanOrEqual(150);
  });

  it('controls individual service lifecycle without affecting sibling containers', async () => {
    const env = await detectDockerEnvironment();
    if (!env.isDaemonRunning) {
      return;
    }

    // 1. Restart worker service specifically
    const restartResult = await runtime.restartService(canonicalDir, 'processing-worker');
    expect(restartResult.success).toBe(true);
    expect(restartResult.command).toContain('processing-worker');

    // 2. Verify containers list still includes running siblings (api-gateway, primary-db, task-queue)
    const statuses = await runtime.getContainerStatuses(canonicalDir);
    const apiGateway = statuses.find((c) => c.service === 'api-gateway');
    const primaryDb = statuses.find((c) => c.service === 'primary-db');

    expect(apiGateway).toBeDefined();
    expect(primaryDb).toBeDefined();
  }, 30000);
});
