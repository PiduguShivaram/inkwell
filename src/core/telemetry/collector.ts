import { CompiledServiceSpec } from '../compiler/types';
import { ContainerState } from '../runtime/types';
import { HealthStatus, ServiceTelemetry, TelemetryReport } from './types';

/**
 * Performs a genuine HTTP health probe against a service endpoint.
 * Measures real latency using performance.now(). Never mocks latency.
 */
export async function probeServiceHealth(
  service: CompiledServiceSpec,
  containerState?: ContainerState,
  timeoutMs = 3000
): Promise<ServiceTelemetry> {
  const now = new Date().toISOString();

  // If service does not expose an HTTP endpoint (e.g., Redis or Postgres using native wire protocols)
  if (!service.healthEndpoint) {
    let healthStatus: HealthStatus = 'unknown';
    if (containerState) {
      if (containerState.health === 'healthy') healthStatus = 'healthy';
      else if (containerState.health === 'unhealthy') healthStatus = 'unhealthy';
      else if (containerState.state === 'running') healthStatus = 'healthy';
      else healthStatus = 'unreachable';
    }

    return {
      nodeId: service.nodeId,
      serviceName: service.serviceName,
      serviceType: service.type,
      hostPort: service.hostPort,
      healthEndpoint: 'Native Protocol / Docker Healthcheck',
      healthStatus,
      containerState: containerState?.state || 'not running',
      containerStatusText: containerState?.status || 'No container detected',
      lastChecked: now,
    };
  }

  const url = `http://localhost:${service.hostPort}${service.healthEndpoint}`;
  const startTime = performance.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    const elapsedMs = Math.round((performance.now() - startTime) * 100) / 100;
    clearTimeout(timer);

    let payload: Record<string, unknown> | undefined;
    try {
      payload = await res.json();
    } catch {
      // response might not be JSON
    }

    const isHealthy = res.status >= 200 && res.status < 300;

    return {
      nodeId: service.nodeId,
      serviceName: service.serviceName,
      serviceType: service.type,
      hostPort: service.hostPort,
      healthEndpoint: service.healthEndpoint,
      healthStatus: isHealthy ? 'healthy' : 'unhealthy',
      httpStatus: res.status,
      latencyMs: elapsedMs,
      containerState: containerState?.state || (isHealthy ? 'running' : 'unknown'),
      containerStatusText: containerState?.status || `HTTP ${res.status}`,
      lastChecked: now,
      payload,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const elapsedMs = Math.round((performance.now() - startTime) * 100) / 100;
    const errorMsg = err instanceof Error ? err.message : String(err);

    return {
      nodeId: service.nodeId,
      serviceName: service.serviceName,
      serviceType: service.type,
      hostPort: service.hostPort,
      healthEndpoint: service.healthEndpoint,
      healthStatus: 'unreachable',
      latencyMs: elapsedMs,
      containerState: containerState?.state || 'offline',
      containerStatusText: containerState?.status || 'Connection refused / service unreachable',
      lastChecked: now,
      error: errorMsg.includes('aborted') ? 'Health probe timed out (3s)' : errorMsg,
    };
  }
}

/**
 * Collects a full telemetry report for all compiled services.
 */
export async function collectSystemTelemetry(
  services: CompiledServiceSpec[],
  containerStates: ContainerState[],
  dockerAvailable: boolean,
  dockerMessage?: string
): Promise<TelemetryReport> {
  const containerMap = new Map<string, ContainerState>();
  for (const c of containerStates) {
    containerMap.set(c.service, c);
  }

  const serviceTelemetries: ServiceTelemetry[] = [];
  for (const service of services) {
    const cState = containerMap.get(service.serviceName);
    const telemetry = await probeServiceHealth(service, cState);
    serviceTelemetries.push(telemetry);
  }

  return {
    timestamp: new Date().toISOString(),
    dockerAvailable,
    dockerMessage,
    services: serviceTelemetries,
  };
}
