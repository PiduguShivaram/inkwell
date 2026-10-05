import { NextRequest, NextResponse } from 'next/server';
import { demoManager } from '@/core/demo/demo-manager';
import { DemoStep } from '@/core/demo/types';

export async function GET() {
  try {
    const state = demoManager.getState();
    return NextResponse.json(state);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { step, message } = body as { step: DemoStep; message?: string };
    if (!step) {
      return NextResponse.json({ error: 'Missing step in request body' }, { status: 400 });
    }

    const state = demoManager.setStep(step, message);
    return NextResponse.json(state);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
