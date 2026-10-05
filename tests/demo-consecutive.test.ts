import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validateGraphIR } from '@/core/validation/validator';

const BASE_URL = 'http://127.0.0.1:3005';

describe('Phase 5: 5 Consecutive Demo Runs Validation', () => {
  const fixturePath = path.resolve('tests/fixtures/real_sketch_api_queue_worker_db.png');
  const sketchBuffer = fs.readFileSync(fixturePath);
  const base64Sketch = `data:image/png;base64,${sketchBuffer.toString('base64')}`;

  for (let run = 1; run <= 5; run++) {
    it(`Run ${run}/5: executes full 8-step demo cycle reliably`, async () => {
      const cycleStart = Date.now();

      // 1. Step 1: READY / RESET
      const resetRes = await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
      expect(resetRes.status).toBe(200);
      const resetJson = await resetRes.json();
      expect(resetJson.success).toBe(true);

      // 2. Step 2: SCANNING
      const scanRes = await fetch(`${BASE_URL}/api/vision/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Sketch,
          metadata: {
            width: 1200,
            height: 800,
            format: 'image/png',
            sizeBytes: sketchBuffer.length,
            aspectRatio: 1.5,
          },
        }),
      });
      expect(scanRes.status).toBe(200);
      const scanJson = await scanRes.json();
      expect(scanJson.success).toBe(true);
      expect(scanJson.graph?.nodes?.length).toBeGreaterThanOrEqual(4);

      // 3. Step 3: VERIFY
      const validation = validateGraphIR(scanJson.graph);
      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);

      const verifyStateRes = await fetch(`${BASE_URL}/api/demo/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'VERIFY' }),
      });
      expect(verifyStateRes.status).toBe(200);
      const verifyStateJson = await verifyStateRes.json();
      expect(verifyStateJson.step).toBe('VERIFY');

      // 4. Step 4: HANDOFF
      const handoffRes = await fetch(`${BASE_URL}/api/office-kit/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph: scanJson.graph,
          source: 'office-kit-clipboard',
          autoStartDocker: false,
        }),
      });
      expect(handoffRes.status).toBe(200);
      const handoffJson = await handoffRes.json();
      expect(handoffJson.success).toBe(true);

      // 5. Step 5: RUNNING
      const stateRes = await fetch(`${BASE_URL}/api/demo/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'RUNNING' }),
      });
      expect(stateRes.status).toBe(200);
      const stateJson = await stateRes.json();
      const runningContainers = stateJson.containers?.filter((c: any) => c.state === 'running') || [];
      expect(runningContainers.length).toBe(4);

      // 6. Step 6: OBSERVING
      const telemRes = await fetch(`${BASE_URL}/api/telemetry?projectName=canonical-pipeline-api-queue-worker-db`);
      expect(telemRes.status).toBe(200);
      const telemJson = await telemRes.json();
      const workerTelem = telemJson.services?.find((s: any) => s.nodeId === 'processing-worker');
      expect(workerTelem?.healthStatus).toBe('healthy');
      expect(workerTelem?.latencyMs).toBeGreaterThan(0);

      // 7. Step 7: FAILURE INJECTION
      const failRes = await fetch(`${BASE_URL}/api/demo/inject-failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'processing-worker' }),
      });
      expect(failRes.status).toBe(200);
      const failJson = await failRes.json();
      expect(failJson.step).toBe('FAILURE');

      const telemFailRes = await fetch(`${BASE_URL}/api/telemetry?projectName=canonical-pipeline-api-queue-worker-db`);
      expect(telemFailRes.status).toBe(200);
      const telemFailJson = await telemFailRes.json();
      const workerDown = telemFailJson.services?.find((s: any) => s.nodeId === 'processing-worker');
      expect(workerDown?.healthStatus).not.toBe('healthy');

      // 8. Step 8: RECOVERY
      const recRes = await fetch(`${BASE_URL}/api/demo/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: 'processing-worker' }),
      });
      expect(recRes.status).toBe(200);
      const recJson = await recRes.json();
      expect(recJson.step).toBe('RECOVERED');

      const telemRecRes = await fetch(`${BASE_URL}/api/telemetry?projectName=canonical-pipeline-api-queue-worker-db`);
      expect(telemRecRes.status).toBe(200);
      const telemRecJson = await telemRecRes.json();
      const workerRecovered = telemRecJson.services?.find((s: any) => s.nodeId === 'processing-worker');
      expect(workerRecovered?.healthStatus).toBe('healthy');

      const durationMs = Date.now() - cycleStart;
      console.log(`[Run ${run}/5] SUCCESS in ${(durationMs / 1000).toFixed(2)}s | Worker latency: ${workerRecovered?.latencyMs}ms`);
    }, 45000);
  }
});
