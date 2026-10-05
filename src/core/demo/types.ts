import { CompiledProject } from '@/core/compiler/types';
import { GraphIR } from '@/core/graph/types';
import { ContainerState } from '@/core/runtime/types';
import { TelemetryReport } from '@/core/telemetry/types';

export type DemoStep =
  | 'READY'
  | 'SCANNING'
  | 'VERIFY'
  | 'HANDOFF'
  | 'RUNNING'
  | 'OBSERVING'
  | 'FAILURE'
  | 'RECOVERED';

export interface DemoState {
  step: DemoStep;
  stepIndex: number; // 1..8
  message: string;
  graph: GraphIR;
  project: CompiledProject | null;
  containers: ContainerState[];
  telemetry: TelemetryReport | null;
  activeFailures: string[];
  elapsedSeconds: number;
  lastUpdated: string;
}

export interface DemoResetResult {
  success: boolean;
  message: string;
  projectName: string;
  diskPath: string;
  containers: ContainerState[];
  telemetry: TelemetryReport | null;
  error?: string;
}
