import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { DockerRuntime } from '@/core/runtime/docker-runtime';

export async function POST(req: NextRequest) {
  try {
    const { action, projectName } = (await req.json()) as {
      action: 'start' | 'stop' | 'restart';
      projectName: string;
    };

    if (!action || !['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid runtime action' }, { status: 400 });
    }

    const safeName = projectName || 'canonical-pipeline-api-queue-worker-db';
    const projectDir = path.resolve(process.cwd(), '.inkwell', 'generated', safeName);

    const runtime = new DockerRuntime();
    let result;

    if (action === 'start') {
      result = await runtime.startProject(projectDir);
    } else if (action === 'stop') {
      result = await runtime.stopProject(projectDir);
    } else {
      result = await runtime.restartProject(projectDir);
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
