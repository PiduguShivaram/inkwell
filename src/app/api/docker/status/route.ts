import { NextResponse } from 'next/server';
import { detectDockerEnvironment } from '@/core/runtime/docker-detector';

export async function GET() {
  try {
    const info = await detectDockerEnvironment();
    return NextResponse.json(info);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        isInstalled: false,
        isDaemonRunning: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
