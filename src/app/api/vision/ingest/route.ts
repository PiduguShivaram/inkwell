import { NextRequest, NextResponse } from 'next/server';
import { ImageMetadata } from '@/core/vision/types';
import { getDefaultVisionProvider } from '@/core/vision/provider';

const ALLOWED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, metadata } = body as {
      image?: string;
      metadata?: ImageMetadata;
    };

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid image payload' },
        { status: 400 }
      );
    }

    if (!metadata || typeof metadata !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Missing image metadata' },
        { status: 400 }
      );
    }

    // Input Validation: Check format
    if (metadata.format && !ALLOWED_FORMATS.includes(metadata.format.toLowerCase())) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported image format '${metadata.format}'. Supported formats: ${ALLOWED_FORMATS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Input Validation: Check size
    if (metadata.sizeBytes && metadata.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Image size (${(metadata.sizeBytes / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of 15MB`,
        },
        { status: 400 }
      );
    }

    // Check data URL / Base64 structure
    if (!image.startsWith('data:image/') && !image.startsWith('/')) {
      // If raw base64, ensure it's not arbitrary garbage
      if (image.length < 50) {
        return NextResponse.json(
          { success: false, error: 'Malformed or truncated image data' },
          { status: 400 }
        );
      }
    }

    const provider = getDefaultVisionProvider();
    const result = await provider.extractGraph(image, metadata);

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `Vision ingestion service error: ${message}` },
      { status: 500 }
    );
  }
}
