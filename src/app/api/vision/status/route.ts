import { NextResponse } from 'next/server';
import { getDefaultVisionProvider } from '@/core/vision/provider';

export async function GET() {
  try {
    const provider = getDefaultVisionProvider();
    const info = await provider.getInfo();
    return NextResponse.json(info);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
