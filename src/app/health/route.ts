import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    system: 'inkwell-core',
    version: '1.0.0-phase1',
    timestamp: new Date().toISOString(),
  });
}
