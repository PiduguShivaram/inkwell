import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { DockerRuntime } from '@/core/runtime/docker-runtime';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectName = searchParams.get('projectName') || 'canonical-pipeline-api-queue-worker-db';
    const projectDir = path.resolve(process.cwd(), '.inkwell', 'generated', projectName);

    const runtime = new DockerRuntime();
    const containers = await runtime.getContainerStatuses(projectDir);

    return NextResponse.json({
      projectName,
      projectDir,
      containers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: message,
        containers: [],
      },
      { status: 500 }
    );
  }
}
