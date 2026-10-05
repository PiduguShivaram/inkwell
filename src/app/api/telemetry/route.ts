import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { CompiledServiceSpec } from '@/core/compiler/types';
import { detectDockerEnvironment } from '@/core/runtime/docker-detector';
import { DockerRuntime } from '@/core/runtime/docker-runtime';
import { collectSystemTelemetry } from '@/core/telemetry/collector';

const DEFAULT_CANONICAL_SERVICES: CompiledServiceSpec[] = [
  {
    nodeId: 'api-gateway',
    serviceName: 'api-gateway',
    type: 'service',
    dirName: 'services/api-gateway',
    hostPort: 3000,
    internalPort: 3000,
    healthEndpoint: '/health',
    healthProbeUrl: 'http://localhost:3000/health',
    environment: { PORT: '3000', SERVICE_NAME: 'API Gateway' },
    dependsOn: ['task-queue'],
    files: [],
  },
  {
    nodeId: 'task-queue',
    serviceName: 'task-queue',
    type: 'queue',
    dirName: 'services/task-queue',
    hostPort: 6379,
    internalPort: 6379,
    healthEndpoint: '',
    healthProbeUrl: '',
    environment: { QUEUE_NAME: 'task-queue' },
    dependsOn: [],
    files: [],
  },
  {
    nodeId: 'processing-worker',
    serviceName: 'processing-worker',
    type: 'worker',
    dirName: 'services/processing-worker',
    hostPort: 3001,
    internalPort: 3001,
    healthEndpoint: '/health',
    healthProbeUrl: 'http://localhost:3001/health',
    environment: { PORT: '3001', WORKER_NAME: 'Background Worker' },
    dependsOn: ['primary-db', 'task-queue'],
    files: [],
  },
  {
    nodeId: 'primary-db',
    serviceName: 'primary-db',
    type: 'database',
    dirName: 'services/primary-db',
    hostPort: 5432,
    internalPort: 5432,
    healthEndpoint: '',
    healthProbeUrl: '',
    environment: {
      POSTGRES_DB: 'inkwell_db',
      POSTGRES_USER: 'inkwell_user',
      POSTGRES_PASSWORD: 'inkwell_password',
    },
    dependsOn: [],
    files: [],
  },
];

async function handleTelemetry(services?: CompiledServiceSpec[], projectName?: string) {
  const activeServices = services && services.length > 0 ? services : DEFAULT_CANONICAL_SERVICES;
  const safeName = projectName || 'canonical-pipeline-api-queue-worker-db';
  const projectDir = path.resolve(process.cwd(), '.inkwell', 'generated', safeName);

  const dockerEnv = await detectDockerEnvironment();
  const runtime = new DockerRuntime();
  const containerStates = await runtime.getContainerStatuses(projectDir);

  const report = await collectSystemTelemetry(
    activeServices,
    containerStates,
    dockerEnv.isDaemonRunning,
    dockerEnv.isDaemonRunning ? undefined : dockerEnv.guidance || dockerEnv.error
  );

  return report;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectName = searchParams.get('projectName') || undefined;
    const report = await handleTelemetry(undefined, projectName);
    return NextResponse.json(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let services: CompiledServiceSpec[] | undefined;
    let projectName: string | undefined;

    try {
      const body = (await req.json()) as {
        services?: CompiledServiceSpec[];
        projectName?: string;
      };
      services = body.services;
      projectName = body.projectName;
    } catch {
      // Empty or non-JSON body: falls back to default canonical services
    }

    const report = await handleTelemetry(services, projectName);
    return NextResponse.json(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
