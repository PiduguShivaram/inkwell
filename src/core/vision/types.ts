import { GraphIR } from '../graph/types';

export interface IngestionStage {
  stage: 'capture' | 'preprocess' | 'extraction';
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'unsupported';
  message: string;
  timestamp: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  aspectRatio: number;
  dataUrl?: string;
}

export interface GraphExtractionResult {
  success: boolean;
  graph?: GraphIR;
  confidence?: number;
  stages: IngestionStage[];
  error?: string;
  providerUsed: string;
}

export interface VisionModelInfo {
  providerId: string;
  providerName: string;
  isAvailable: boolean;
  version: string;
  executionTarget: 'none' | 'local-cpu' | 'local-gpu' | 'npu' | 'remote-endpoint';
  statusDescription: string;
  supportedInputFormats: string[];
}

export interface VisionModelProvider {
  getInfo(): Promise<VisionModelInfo>;
  isAvailable(): Promise<boolean>;
  preprocessImage(metadata: ImageMetadata): Promise<IngestionStage>;
  extractGraph(imageDataUrl: string, metadata: ImageMetadata): Promise<GraphExtractionResult>;
}
