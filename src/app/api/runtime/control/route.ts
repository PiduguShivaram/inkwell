import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { DockerRuntime } from '@/core/runtime/docker-runtime';

export async function POST(req: NextRequest) {
  try {
    const { action, projectName, serviceName } = (await req.json()) as {
      action: 'start' | 'stop' | 'restart';
      projectName?: string;
      serviceName?: string;
    };

    if (!action || !['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid runtime action' }, { status: 400 });
    }

    const safeName = (projectName || 'canonical-pipeline-api-queue-worker-db').replace(/[^a-zA-Z0-9_-]/g, '');
    const projectDir = path.resolve(process.cwd(), '.inkwell', 'generated', safeName);

    const runtime = new DockerRuntime();
    let result;

    if (serviceName && serviceName.trim().length > 0) {
      if (action === 'start') {
        result = await runtime.startService(projectDir, serviceName);
      } else if (action === 'stop') {
        result = await runtime.stopService(projectDir, serviceName);
      } else {
        result = await runtime.restartService(projectDir, serviceName);
      }
    } else {
      if (action === 'start') {
        result = await runtime.startProject(projectDir);
      } else if (action === 'stop') {
        result = await runtime.stopProject(projectDir);
      } else {
        result = await runtime.restartProject(projectDir);
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
