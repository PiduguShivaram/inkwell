import { NextRequest, NextResponse } from 'next/server';
import { deleteArchitecture, loadArchitecture } from '@/core/persistence';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const result = await loadArchitecture(name);
    if (!result.success || !result.record) {
      return NextResponse.json({ success: false, error: result.error || 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, record: result.record, graph: result.record.graph });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const result = await deleteArchitecture(name);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
