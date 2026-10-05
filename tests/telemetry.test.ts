import * as http from 'node:http';
import { describe, expect, it } from 'vitest';
import { CompiledServiceSpec } from '../src/core/compiler/types';
import { collectSystemTelemetry, probeServiceHealth } from '../src/core/telemetry/collector';

describe('Telemetry & Health Probes', () => {
  it('probes a live HTTP service and measures genuine latency and response', async () => {
    // Spin up a temporary local HTTP server to test live probe
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'test-service' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };

    try {
      const mockServiceSpec: CompiledServiceSpec = {
        nodeId: 'test-service',
        serviceName: 'test-service',
        type: 'service',
        dirName: 'services/test',
        hostPort: address.port,
        internalPort: address.port,
        healthEndpoint: '/health',
        healthProbeUrl: `http://localhost:${address.port}/health`,
        environment: {},
        dependsOn: [],
        files: [],
      };

      const telemetry = await probeServiceHealth(mockServiceSpec);

      expect(telemetry.healthStatus).toBe('healthy');
      expect(telemetry.httpStatus).toBe(200);
      expect(typeof telemetry.latencyMs).toBe('number');
      expect(telemetry.latencyMs).toBeGreaterThanOrEqual(0);
      expect(telemetry.payload).toEqual({ status: 'ok', service: 'test-service' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('accurately identifies unreachable services without fabricating metrics', async () => {
    // Port 59999 should not be listening
    const unreachableServiceSpec: CompiledServiceSpec = {
      nodeId: 'offline-service',
      serviceName: 'offline-service',
      type: 'service',
      dirName: 'services/offline',
      hostPort: 59999,
      internalPort: 59999,
      healthEndpoint: '/health',
      healthProbeUrl: 'http://localhost:59999/health',
      environment: {},
      dependsOn: [],
      files: [],
    };

    const telemetry = await probeServiceHealth(unreachableServiceSpec);

    expect(telemetry.healthStatus).toBe('unreachable');
    expect(telemetry.httpStatus).toBeUndefined();
    expect(telemetry.error).toBeDefined();
    expect(typeof telemetry.latencyMs).toBe('number');
  });

  it('collects telemetry report for all services truthfully', async () => {
    const unreachableServiceSpec: CompiledServiceSpec = {
      nodeId: 'offline-service',
      serviceName: 'offline-service',
      type: 'service',
      dirName: 'services/offline',
      hostPort: 59998,
      internalPort: 59998,
      healthEndpoint: '/health',
      healthProbeUrl: 'http://localhost:59998/health',
      environment: {},
      dependsOn: [],
      files: [],
    };

    const report = await collectSystemTelemetry(
      [unreachableServiceSpec],
      [],
      false,
      'Docker daemon not running'
    );

    expect(report.dockerAvailable).toBe(false);
    expect(report.dockerMessage).toBe('Docker daemon not running');
    expect(report.services).toHaveLength(1);
    expect(report.services[0].healthStatus).toBe('unreachable');
  });
});
