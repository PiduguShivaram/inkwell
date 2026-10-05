import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { CompiledServiceSpec } from '@/core/compiler/types';
import { detectDockerEnvironment } from '@/core/runtime/docker-detector';
import { DockerRuntime } from '@/core/runtime/docker-runtime';
import { collectSystemTelemetry } from '@/core/telemetry/collector';

export async function POST(req: NextRequest) {
  try {
    const { services, projectName } = (await req.json()) as {
      services: CompiledServiceSpec[];
      projectName?: string;
    };

    if (!services || !Array.isArray(services)) {
      return NextResponse.json({ error: 'Missing services array' }, { status: 400 });
    }

    const safeName = projectName || 'canonical-pipeline-api-queue-worker-db';
    const projectDir = path.resolve(process.cwd(), '.inkwell', 'generated', safeName);

    const dockerEnv = await detectDockerEnvironment();
    const runtime = new DockerRuntime();
    const containerStates = await runtime.getContainerStatuses(projectDir);

    const report = await collectSystemTelemetry(
      services,
      containerStates,
      dockerEnv.isDaemonRunning,
      dockerEnv.isDaemonRunning ? undefined : dockerEnv.guidance || dockerEnv.error
    );

    return NextResponse.json(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
