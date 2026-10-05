import { NextResponse } from 'next/server';
import { bridgeManager } from '@/core/bridge/bridge-manager';

export async function GET() {
  try {
    const status = await bridgeManager.getEnvironmentStatus();
    return NextResponse.json(status);
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
