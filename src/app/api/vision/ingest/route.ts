import { NextRequest, NextResponse } from 'next/server';
import { ImageMetadata } from '@/core/vision/types';
import { Phase1VisionModelProvider } from '@/core/vision/provider';

export async function POST(req: NextRequest) {
  try {
    const { image, metadata } = (await req.json()) as {
      image: string;
      metadata: ImageMetadata;
    };

    if (!image || !metadata) {
      return NextResponse.json({ error: 'Missing image payload or metadata' }, { status: 400 });
    }

    const provider = new Phase1VisionModelProvider();
    const result = await provider.extractGraph(image, metadata);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
