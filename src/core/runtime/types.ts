export interface DockerEnvironmentInfo {
  isInstalled: boolean;
  isDaemonRunning: boolean;
  clientVersion?: string;
  serverVersion?: string;
  context?: string;
  rawOutput?: string;
  error?: string;
  guidance?: string;
}

export interface ContainerState {
  id: string;
  name: string;
  service: string;
  state: string; // e.g., 'running', 'exited', 'starting'
  status: string; // e.g., 'Up 2 hours', 'Exited (0)'
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
  ports?: string;
}

export interface RuntimeExecutionResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}
