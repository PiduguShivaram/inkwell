import { describe, expect, it } from 'vitest';
import { Phase1VisionModelProvider } from '../src/core/vision/provider';

describe('Vision Model Architecture & Provider', () => {
  it('instantiates the Phase 1 provider and reports truthfully that no model is loaded', async () => {
    const provider = new Phase1VisionModelProvider();

    const isAvailable = await provider.isAvailable();
    expect(isAvailable).toBe(false);

    const info = await provider.getInfo();
    expect(info.isAvailable).toBe(false);
    expect(info.executionTarget).toBe('none');
    expect(info.statusDescription).toContain('No active inference provider configured');
  });

  it('validates image preprocessing and checks dimensions', async () => {
    const provider = new Phase1VisionModelProvider();

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

  it('strictly refuses to fake graph extraction when model is unavailable', async () => {
    const provider = new Phase1VisionModelProvider();

    const result = await provider.extractGraph('data:image/png;base64,fakeimagedata', {
      width: 800,
      height: 600,
      format: 'image/png',
      sizeBytes: 24000,
      aspectRatio: 4 / 3,
    });

    expect(result.success).toBe(false);
    expect(result.graph).toBeUndefined();
    expect(result.error).toContain('Phase 1 maintains strict no-mock policy');
    expect(result.stages.some((s) => s.stage === 'extraction' && s.status === 'unsupported')).toBe(true);
  });
});
