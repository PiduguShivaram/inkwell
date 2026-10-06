import { NextRequest, NextResponse } from 'next/server';
import { listArchitectures, saveArchitecture } from '@/core/persistence';
import { GraphIR } from '@/core/graph/types';

export async function GET() {
  try {
    const list = await listArchitectures();
    return NextResponse.json({ success: true, architectures: list });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, graph, description } = body as {
      name?: string;
      graph?: GraphIR;
      description?: string;
    };

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Architecture name is required.' },
        { status: 400 }
      );
    }

    if (!graph || !Array.isArray(graph.nodes)) {
      return NextResponse.json(
        { success: false, error: 'Valid Graph IR is required.' },
        { status: 400 }
      );
    }

    const result = await saveArchitecture(name, graph, description);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
