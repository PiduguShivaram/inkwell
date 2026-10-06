import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { DockerRuntime } from '@/core/runtime/docker-runtime';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const projectName = searchParams.get('projectName') || 'canonical-pipeline-api-queue-worker-db';
    const serviceName = searchParams.get('service');
    const tailStr = searchParams.get('tail') || '100';
    const tailLines = parseInt(tailStr, 10) || 100;

    if (!serviceName) {
      return NextResponse.json(
        { success: false, error: 'service parameter is required' },
        { status: 400 }
      );
    }

    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '');
    const projectDir = path.resolve(process.cwd(), '.inkwell', 'generated', safeName);

    const runtime = new DockerRuntime();
    const result = await runtime.getServiceLogs(projectDir, serviceName, tailLines);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
