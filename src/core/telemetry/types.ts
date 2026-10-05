export type HealthStatus = 'healthy' | 'unhealthy' | 'unreachable' | 'unknown';

export interface ServiceTelemetry {
  nodeId: string;
  serviceName: string;
  serviceType: string;
  hostPort: number;
  healthEndpoint: string;
  healthStatus: HealthStatus;
  httpStatus?: number;
  latencyMs?: number; // Real measured HTTP response time in milliseconds
  containerState?: string; // from Docker Compose
  containerStatusText?: string;
  lastChecked: string;
  error?: string;
  payload?: Record<string, unknown>;
}

export interface TelemetryReport {
  timestamp: string;
  dockerAvailable: boolean;
  dockerMessage?: string;
  services: ServiceTelemetry[];
}
