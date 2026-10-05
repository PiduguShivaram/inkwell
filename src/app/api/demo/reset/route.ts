import { NextResponse } from 'next/server';
import { demoManager } from '@/core/demo/demo-manager';

export async function POST() {
  try {
    const result = await demoManager.resetDemo();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
