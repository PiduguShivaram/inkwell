import fs from 'fs';
import path from 'path';

interface RunMetrics {
  runIndex: number;
  resetDurationMs: number;
  scanDurationMs: number;
  verifyDurationMs: number;
  handoffDurationMs: number;
  runningDurationMs: number;
  observingLatencyMs: number;
  failureDetectionMs: number;
  recoveryDetectionMs: number;
  totalCycleMs: number;
  success: boolean;
}

const BASE_URL = 'http://127.0.0.1:3005';

async function main() {
  console.log('====================================================');
  console.log('PHASE 5: 5 CONSECUTIVE DEMO HARDENING RUNS');
  console.log('====================================================\n');

  const fixturePath = path.resolve('tests/fixtures/real_sketch_api_queue_worker_db.png');
  const sketchBuffer = fs.readFileSync(fixturePath);
  const base64Sketch = `data:image/png;base64,${sketchBuffer.toString('base64')}`;

  const metrics: RunMetrics[] = [];

  for (let run = 1; run <= 5; run++) {
    console.log(`\n----------------------------------------------------`);
    console.log(`>>> STARTING DEMO RUN ${run} OF 5`);
    console.log(`----------------------------------------------------`);

    const cycleStart = Date.now();

    // 1. STEP 1: READY / RESET
    const resetStart = Date.now();
    const resetRes = await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
    const resetJson = await resetRes.json();
    const resetDurationMs = Date.now() - resetStart;
    console.log(`[Run ${run}][Step 1/8 READY] Reset completed in ${resetDurationMs}ms (success: ${resetJson.success})`);
    if (!resetJson.success) throw new Error(`Run ${run} Step 1 Failed: ${JSON.stringify(resetJson)}`);

    // 2. STEP 2: SCANNING / VISION INGEST
    const scanStart = Date.now();
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
    const scanJson = await scanRes.json();
    const scanDurationMs = Date.now() - scanStart;
    const nodeCount = scanJson.graph?.nodes?.length || 0;
    console.log(`[Run ${run}][Step 2/8 SCANNING] Vision parsed ${nodeCount} nodes in ${scanDurationMs}ms`);
    if (!scanJson.success || nodeCount < 4) throw new Error(`Run ${run} Step 2 Failed: ${JSON.stringify(scanJson)}`);

    // 3. STEP 3: VERIFY
    const verifyStart = Date.now();
    const verifyRes = await fetch(`${BASE_URL}/api/graph/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ graph: scanJson.graph }),
    });
    const verifyJson = await verifyRes.json();
    const verifyDurationMs = Date.now() - verifyStart;
    console.log(`[Run ${run}][Step 3/8 VERIFY] Graph valid=${verifyJson.valid} in ${verifyDurationMs}ms (errors: ${verifyJson.errors?.length || 0})`);
    if (!verifyJson.valid) throw new Error(`Run ${run} Step 3 Failed: ${JSON.stringify(verifyJson)}`);

    // 4. STEP 4: HANDOFF
    const handoffStart = Date.now();
    const handoffRes = await fetch(`${BASE_URL}/api/office-kit/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph: scanJson.graph,
        source: 'office-kit-clipboard',
        autoStartDocker: false,
      }),
    });
    const handoffJson = await handoffRes.json();
    const handoffDurationMs = Date.now() - handoffStart;
    console.log(`[Run ${run}][Step 4/8 HANDOFF] Handoff confirmed in ${handoffDurationMs}ms (path: ${handoffJson.diskPath})`);
    if (!handoffJson.success) throw new Error(`Run ${run} Step 4 Failed: ${JSON.stringify(handoffJson)}`);

    // 5. STEP 5: RUNNING
    const runningStart = Date.now();
    const stateRes = await fetch(`${BASE_URL}/api/demo/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'RUNNING' }),
    });
    const stateJson = await stateRes.json();
    const runningDurationMs = Date.now() - runningStart;
    const runningContainers = stateJson.containers?.filter((c: any) => c.state === 'running') || [];
    console.log(`[Run ${run}][Step 5/8 RUNNING] Containers verified in ${runningDurationMs}ms (${runningContainers.length}/4 running)`);
    if (runningContainers.length < 4) throw new Error(`Run ${run} Step 5 Failed: only ${runningContainers.length} containers running`);

    // 6. STEP 6: OBSERVING
    const telemRes = await fetch(`${BASE_URL}/api/telemetry?projectName=canonical-pipeline-api-queue-worker-db`);
    const telemJson = await telemRes.json();
    const workerTelem = telemJson.services?.find((s: any) => s.nodeId === 'processing-worker');
    const workerLatency = workerTelem?.latencyMs || 0;
    console.log(`[Run ${run}][Step 6/8 OBSERVING] Live Telemetry verified: Worker is ${workerTelem?.healthStatus} (latency: ${workerLatency}ms)`);
    if (workerTelem?.healthStatus !== 'healthy') throw new Error(`Run ${run} Step 6 Failed: Worker is not healthy`);

    // 7. STEP 7: FAILURE INJECTION
    const failStart = Date.now();
    const failRes = await fetch(`${BASE_URL}/api/demo/inject-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'processing-worker' }),
    });
    const failJson = await failRes.json();
    const failDurationMs = Date.now() - failStart;

    // Verify telemetry sees worker down
    const telemFailRes = await fetch(`${BASE_URL}/api/telemetry?projectName=canonical-pipeline-api-queue-worker-db`);
    const telemFailJson = await telemFailRes.json();
    const workerDownTelem = telemFailJson.services?.find((s: any) => s.nodeId === 'processing-worker');
    console.log(`[Run ${run}][Step 7/8 FAILURE] Worker stopped in ${failDurationMs}ms -> Telemetry reports: ${workerDownTelem?.healthStatus} (${workerDownTelem?.containerState})`);
    if (workerDownTelem?.healthStatus === 'healthy' && workerDownTelem?.containerState === 'running') {
      throw new Error(`Run ${run} Step 7 Failed: Worker was not stopped`);
    }

    // 8. STEP 8: RECOVERY
    const recStart = Date.now();
    const recRes = await fetch(`${BASE_URL}/api/demo/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: 'processing-worker' }),
    });
    const recJson = await recRes.json();
    const recDurationMs = Date.now() - recStart;

    // Verify telemetry sees worker healthy again
    const telemRecRes = await fetch(`${BASE_URL}/api/telemetry?projectName=canonical-pipeline-api-queue-worker-db`);
    const telemRecJson = await telemRecRes.json();
    const workerRecoveredTelem = telemRecJson.services?.find((s: any) => s.nodeId === 'processing-worker');
    console.log(`[Run ${run}][Step 8/8 RECOVERED] Worker restarted in ${recDurationMs}ms -> Telemetry reports: ${workerRecoveredTelem?.healthStatus} (latency: ${workerRecoveredTelem?.latencyMs}ms)`);
    if (workerRecoveredTelem?.healthStatus !== 'healthy') {
      throw new Error(`Run ${run} Step 8 Failed: Worker did not recover`);
    }

    const totalCycleMs = Date.now() - cycleStart;
    console.log(`>>> RUN ${run} SUCCESSFUL! Total cycle time: ${(totalCycleMs / 1000).toFixed(2)}s\n`);

    metrics.push({
      runIndex: run,
      resetDurationMs,
      scanDurationMs,
      verifyDurationMs,
      handoffDurationMs,
      runningDurationMs,
      observingLatencyMs: workerLatency,
      failureDetectionMs: failDurationMs,
      recoveryDetectionMs: recDurationMs,
      totalCycleMs,
      success: true,
    });
  }

  console.log('====================================================');
  console.log('ALL 5 RUNS COMPLETED WITH 100% SUCCESS');
  console.log('====================================================');
  console.table(metrics);

  const avgCycle = metrics.reduce((acc, m) => acc + m.totalCycleMs, 0) / metrics.length;
  console.log(`Average Demo Run Duration: ${(avgCycle / 1000).toFixed(2)}s`);
}

main().catch((err) => {
  console.error('Demo verification failed:', err);
  process.exit(1);
});
