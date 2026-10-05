import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { compileGraph } from '@/core/compiler/compiler';
import { GraphIR } from '@/core/graph/types';
import { DockerRuntime } from '@/core/runtime/docker-runtime';
import { validateGraphIR } from '@/core/validation/validator';

export async function POST(req: NextRequest) {
  try {
    const graph = (await req.json()) as GraphIR;

    // 1. Validate
    const validation = validateGraphIR(graph);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          validation,
          error: 'Graph validation failed. Correct architectural errors before compiling.',
        },
        { status: 400 }
      );
    }

    // 2. Deterministic Compile
    const project = compileGraph(graph);

    // 3. Export to disk
    const runtime = new DockerRuntime();
    const targetDir = path.resolve(process.cwd(), '.inkwell', 'generated', project.projectName);
    const diskPath = await runtime.exportProjectToDisk(project, targetDir);

    return NextResponse.json({
      success: true,
      validation,
      project,
      diskPath,
    });
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
