import { CompiledProject } from '@/core/compiler/types';
import { GraphIR } from '@/core/graph/types';
import { ValidationResult } from '@/core/validation/types';

export type BridgeSource =
  | 'office-kit-clipboard'
  | 'office-kit-easyshare'
  | 'direct-network-http'
  | 'adb-bridge';

export interface HandoffRecord {
  id: string;
  timestamp: string;
  source: BridgeSource;
  graph: GraphIR;
  validation: ValidationResult;
  compilation?: {
    success: boolean;
    projectName: string;
    diskPath?: string;
    serviceCount: number;
    error?: string;
  };
  dockerResult?: {
    success: boolean;
    runningContainers: string[];
    error?: string;
  };
}

export interface BridgeEnvironmentStatus {
  officeKitSupported: boolean;
  capabilities: {
    superClipboard: boolean;
    easyShareFileDrop: boolean;
    screenMirroring: boolean;
  };
  networkEndpoints: {
    localhost: string;
    lanIp?: string;
    adbReverseTunnel: boolean;
  };
  lastHandoff: HandoffRecord | null;
  dockerAvailable: boolean;
}

export interface HandoffRequest {
  graph: GraphIR;
  source: BridgeSource;
  autoStartDocker?: boolean;
}

export interface HandoffResponse {
  success: boolean;
  handoffId: string;
  source: BridgeSource;
  validation: ValidationResult;
  project?: CompiledProject;
  diskPath?: string;
  dockerStarted?: boolean;
  runningContainers?: string[];
  error?: string;
}
