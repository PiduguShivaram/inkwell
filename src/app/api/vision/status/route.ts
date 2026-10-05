import { NextResponse } from 'next/server';
import { Phase1VisionModelProvider } from '@/core/vision/provider';

export async function GET() {
  try {
    const provider = new Phase1VisionModelProvider();
    const info = await provider.getInfo();
    return NextResponse.json(info);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
