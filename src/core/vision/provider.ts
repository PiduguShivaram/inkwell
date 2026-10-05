import {
  GraphExtractionResult,
  ImageMetadata,
  IngestionStage,
  VisionModelInfo,
  VisionModelProvider,
} from './types';

/**
 * Phase 1 Foundation Vision Model Provider.
 * Inspects real model availability and explicitly prevents mock/fake inference.
 */
export class Phase1VisionModelProvider implements VisionModelProvider {
  private customEndpointUrl?: string;

  constructor(customEndpointUrl?: string) {
    this.customEndpointUrl = customEndpointUrl || process.env.VISION_MODEL_ENDPOINT;
  }

  async getInfo(): Promise<VisionModelInfo> {
    const isAvail = await this.isAvailable();
    return {
      providerId: 'inkwell-vision-core-phase1',
      providerName: 'Inkwell Vision Model Provider (Phase 1 Ready)',
      isAvailable: isAvail,
      version: '1.0.0-phase1',
      executionTarget: isAvail ? 'remote-endpoint' : 'none',
      statusDescription: isAvail
        ? `Connected to vision endpoint: ${this.customEndpointUrl}`
        : 'Architecture ready for on-device/endpoint model. No active inference provider configured.',
      supportedInputFormats: ['image/png', 'image/jpeg', 'image/webp'],
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.customEndpointUrl) {
      return false;
    }
    try {
      const res = await fetch(`${this.customEndpointUrl}/health`, { method: 'GET' });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async preprocessImage(metadata: ImageMetadata): Promise<IngestionStage> {
    const now = new Date().toISOString();
    if (!metadata || metadata.width <= 0 || metadata.height <= 0) {
      return {
        stage: 'preprocess',
        name: 'Image Preprocessing & Validation',
        status: 'failed',
        message: 'Invalid image dimensions or corrupted image buffer.',
        timestamp: now,
      };
    }

    return {
      stage: 'preprocess',
      name: 'Image Preprocessing & Validation',
      status: 'completed',
      message: `Verified image resolution (${metadata.width}x${metadata.height}) and format (${metadata.format}). Preprocessing passed.`,
      timestamp: now,
    };
  }

  async extractGraph(
    imageDataUrl: string,
    metadata: ImageMetadata
  ): Promise<GraphExtractionResult> {
    const now = new Date().toISOString();
    const preprocessStage = await this.preprocessImage(metadata);

    const stages: IngestionStage[] = [
      {
        stage: 'capture',
        name: 'Image Acquisition',
        status: 'completed',
        message: `Captured ${metadata.format} image (${Math.round(metadata.sizeBytes / 1024)} KB).`,
        timestamp: now,
      },
      preprocessStage,
    ];

    const available = await this.isAvailable();

    if (!available) {
      stages.push({
        stage: 'extraction',
        name: 'Architecture Graph Extraction',
        status: 'unsupported',
        message:
          'No vision model runtime is active in Phase 1 environment. Image capture and preprocessing succeeded, but automatic sketch extraction requires a deployed Vision Model Provider. No fake graph was generated.',
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        stages,
        error:
          'Vision Model Provider unconfigured: Phase 1 maintains strict no-mock policy. Please use the interactive Architecture Workspace to construct and compile graphs.',
        providerUsed: 'inkwell-vision-core-phase1 (Unconfigured)',
      };
    }

    // If an actual real external endpoint was configured:
    try {
      const res = await fetch(`${this.customEndpointUrl}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl, metadata }),
      });

      if (!res.ok) {
        throw new Error(`Endpoint returned status ${res.status}`);
      }

      const data = await res.json();
      stages.push({
        stage: 'extraction',
        name: 'Architecture Graph Extraction',
        status: 'completed',
        message: 'Graph extracted successfully by configured vision provider.',
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        graph: data.graph,
        confidence: data.confidence,
        stages,
        providerUsed: this.customEndpointUrl || 'configured-endpoint',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      stages.push({
        stage: 'extraction',
        name: 'Architecture Graph Extraction',
        status: 'failed',
        message: `Vision model inference failed: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        stages,
        error: `Vision model failed: ${errorMsg}`,
        providerUsed: this.customEndpointUrl || 'configured-endpoint',
      };
    }
  }
}
