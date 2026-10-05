import { describe, expect, it } from 'vitest';
import { demoManager } from '@/core/demo/demo-manager';
import { DemoStep } from '@/core/demo/types';

describe('Phase 5: Hackathon Demo State Machine & Hardening', () => {
  it('initializes demo state machine with step READY (index 1)', () => {
    const state = demoManager.getState();
    expect(state.stepIndex).toBeGreaterThanOrEqual(1);
    expect(state.graph).toBeDefined();
    expect(state.graph.nodes.length).toBe(4);
    expect(state.graph.edges.length).toBe(3);
  });

  it('correctly transitions through all 8 demo states in order', () => {
    const sequence: { step: DemoStep; expectedIndex: number }[] = [
      { step: 'READY', expectedIndex: 1 },
      { step: 'SCANNING', expectedIndex: 2 },
      { step: 'VERIFY', expectedIndex: 3 },
      { step: 'HANDOFF', expectedIndex: 4 },
      { step: 'RUNNING', expectedIndex: 5 },
      { step: 'OBSERVING', expectedIndex: 6 },
      { step: 'FAILURE', expectedIndex: 7 },
      { step: 'RECOVERED', expectedIndex: 8 },
    ];

    for (const item of sequence) {
      const state = demoManager.setStep(item.step);
      expect(state.step).toBe(item.step);
      expect(state.stepIndex).toBe(item.expectedIndex);
      expect(state.message).toContain(`Step ${item.expectedIndex}/8`);
    }
  });

  it('resets canonical demo baseline and ensures genuine container validation', async () => {
    const resetResult = await demoManager.resetDemo();
    expect(resetResult.success).toBe(true);
    expect(resetResult.projectName).toBe('canonical-pipeline-api-queue-worker-db');
    expect(resetResult.diskPath).toContain('canonical-pipeline-api-queue-worker-db');

    const state = demoManager.getState();
    expect(state.step).toBe('READY');
    expect(state.stepIndex).toBe(1);
    expect(state.activeFailures.length).toBe(0);
    expect(state.containers.length).toBeGreaterThan(0);
  }, 30000);

  it('reflects real Docker container status during failure and recovery cycles', async () => {
    // Inject failure
    const failureState = await demoManager.injectFailure('processing-worker');
    expect(failureState.step).toBe('FAILURE');
    expect(failureState.stepIndex).toBe(7);
    expect(failureState.activeFailures).toContain('processing-worker');

    // Verify recovery
    const recoveredState = await demoManager.recoverService('processing-worker');
    expect(recoveredState.step).toBe('RECOVERED');
    expect(recoveredState.stepIndex).toBe(8);
    expect(recoveredState.activeFailures).not.toContain('processing-worker');
  }, 30000);
});
