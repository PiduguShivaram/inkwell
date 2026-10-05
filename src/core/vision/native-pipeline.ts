import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { GraphIR } from '../graph/types';
import { validateGraphIR } from '../validation/validator';
import { GraphExtractionResult, ImageMetadata, IngestionStage, VisionModelInfo, VisionModelProvider } from './types';

const execFileAsync = promisify(execFile);

export class NativeComputerVisionProvider implements VisionModelProvider {
  private pythonPath: string;
  private scriptPath: string;

  constructor(pythonPath = 'python') {
    this.pythonPath = pythonPath;
    this.scriptPath = path.resolve(process.cwd(), 'src', 'core', 'vision', 'pipeline.py');
  }

  async getInfo(): Promise<VisionModelInfo> {
    const available = await this.isAvailable();
    return {
      providerId: 'inkwell-native-cv-winocr-pipeline',
      providerName: 'Inkwell Native Computer Vision & WinOCR Pipeline',
      isAvailable: available,
      version: '2.0.0-native',
      executionTarget: 'local-cpu',
      statusDescription: available
        ? 'Real OpenCV 5.0 and Windows Native WinOCR engine active for constrained sketch recognition.'
        : 'OpenCV or WinOCR Python runtime unavailable.',
      supportedInputFormats: ['image/png', 'image/jpeg', 'image/webp'],
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(
        this.pythonPath,
        ['-c', 'import cv2, winocr; print("OK")'],
        { timeout: 4000 }
      );
      return stdout.trim().includes('OK');
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
        message: 'Invalid image dimensions or empty buffer.',
        timestamp: now,
      };
    }

    if (metadata.sizeBytes > 15 * 1024 * 1024) {
      return {
        stage: 'preprocess',
        name: 'Image Preprocessing & Validation',
        status: 'failed',
        message: `Image exceeds maximum permitted size of 15MB (${(metadata.sizeBytes / 1024 / 1024).toFixed(1)}MB).`,
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
    const preprocessStage = await this.preprocessImage(metadata);
    if (preprocessStage.status === 'failed') {
      return {
        success: false,
        stages: [preprocessStage],
        error: preprocessStage.message,
        providerUsed: 'inkwell-native-cv-winocr-pipeline',
      };
    }

    const available = await this.isAvailable();
    if (!available) {
      return {
        success: false,
        stages: [
          preprocessStage,
          {
            stage: 'extraction',
            name: 'Computer Vision & OCR Runtime',
            status: 'failed',
            message: 'Local Python OpenCV/WinOCR engine is not reachable.',
            timestamp: new Date().toISOString(),
          },
        ],
        error: 'Vision runtime dependency missing: OpenCV or WinOCR is not installed.',
        providerUsed: 'inkwell-native-cv-winocr-pipeline',
      };
    }

    // Write input image to a temp file to avoid Windows command line character limit
    const tempFile = path.join(os.tmpdir(), `inkwell-sketch-${Date.now()}.txt`);
    try {
      await fs.writeFile(tempFile, imageDataUrl, 'utf-8');

      const { stdout } = await execFileAsync(
        this.pythonPath,
        [this.scriptPath, `@${tempFile}`],
        {
          maxBuffer: 50 * 1024 * 1024,
          timeout: 20000,
        }
      );

      const parsed = JSON.parse(stdout.trim()) as GraphExtractionResult;

      if (!parsed.success || !parsed.graph) {
        return {
          success: false,
          stages: parsed.stages || [preprocessStage],
          error: parsed.error || 'Failed to detect architectural primitives from sketch.',
          providerUsed: 'inkwell-native-cv-winocr-pipeline',
        };
      }

      // Graph Validation Gate: Verify recognized GraphIR passes architectural validation
      const validation = validateGraphIR(parsed.graph);
      if (!validation.isValid) {
        return {
          success: false,
          graph: parsed.graph,
          confidence: parsed.confidence,
          stages: [
            ...(parsed.stages || []),
            {
              stage: 'extraction',
              name: 'Architecture Graph Validation',
              status: 'failed',
              message: `Extracted graph failed architectural validation: ${validation.errors.map((e) => e.message).join('; ')}`,
              timestamp: new Date().toISOString(),
            },
          ],
          error: `Graph validation failed: ${validation.errors.map((e) => e.message).join('; ')}`,
          providerUsed: 'inkwell-native-cv-winocr-pipeline',
        };
      }

      return {
        success: true,
        graph: parsed.graph,
        confidence: parsed.confidence,
        stages: parsed.stages || [preprocessStage],
        detectedElements: parsed.detectedElements,
        referenceFrame: parsed.referenceFrame,
        providerUsed: 'inkwell-native-cv-winocr-pipeline',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        stages: [
          preprocessStage,
          {
            stage: 'extraction',
            name: 'Architecture Graph Extraction',
            status: 'failed',
            message: `Execution failed: ${msg}`,
            timestamp: new Date().toISOString(),
          },
        ],
        error: `Vision extraction error: ${msg}`,
        providerUsed: 'inkwell-native-cv-winocr-pipeline',
      };
    } finally {
      await fs.unlink(tempFile).catch(() => {});
    }
  }
}
