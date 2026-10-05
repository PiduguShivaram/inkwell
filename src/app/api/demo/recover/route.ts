import { NextRequest, NextResponse } from 'next/server';
import { demoManager } from '@/core/demo/demo-manager';

export async function POST(req: NextRequest) {
  try {
    let serviceName = 'processing-worker';
    try {
      const body = await req.json();
      if (body?.serviceName) {
        serviceName = body.serviceName;
      }
    } catch {
      // Use default
    }

    const state = await demoManager.recoverService(serviceName);
    return NextResponse.json(state);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
