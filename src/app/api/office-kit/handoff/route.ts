import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { bridgeManager } from '@/core/bridge/bridge-manager';
import { BridgeSource, HandoffRequest } from '@/core/bridge/types';
import { compileGraph } from '@/core/compiler/compiler';
import { detectDockerEnvironment } from '@/core/runtime/docker-detector';
import { DockerRuntime } from '@/core/runtime/docker-runtime';
import { validateGraphIR } from '@/core/validation/validator';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as HandoffRequest;
    const { graph, source = 'direct-network-http', autoStartDocker = false } = body;

    const handoffId = `handoff-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    // 1. Validate incoming Graph IR
    const validation = validateGraphIR(graph);
    if (!validation.isValid) {
      bridgeManager.recordHandoff({
        id: handoffId,
        timestamp,
        source: source as BridgeSource,
        graph,
        validation,
        compilation: {
          success: false,
          projectName: graph?.metadata?.name || 'invalid-graph',
          serviceCount: 0,
          error: 'Graph validation failed.',
        },
      });

      return NextResponse.json(
        {
          success: false,
          handoffId,
          source,
          validation,
          error: 'Transferred Graph IR failed architectural validation.',
        },
        { status: 400 }
      );
    }

    // 2. Deterministic Compilation
    const project = compileGraph(graph);

    // 3. Export to disk
    const runtime = new DockerRuntime();
    const targetDir = path.resolve(process.cwd(), '.inkwell', 'generated', project.projectName);
    const diskPath = await runtime.exportProjectToDisk(project, targetDir);

    // 4. Optional Docker orchestration
    let dockerStarted = false;
    let runningContainers: string[] = [];
    if (autoStartDocker) {
      const dockerInfo = await detectDockerEnvironment();
      if (dockerInfo.isDaemonRunning) {
        const startResult = await runtime.startProject(targetDir);
        dockerStarted = startResult.success;
        const containerStatuses = await runtime.getContainerStatuses(targetDir);
        runningContainers = containerStatuses.map((c) => c.service);
      }
    }

    // 5. Record verified handoff
    bridgeManager.recordHandoff({
      id: handoffId,
      timestamp,
      source: source as BridgeSource,
      graph,
      validation,
      compilation: {
        success: true,
        projectName: project.projectName,
        diskPath,
        serviceCount: project.services.length,
      },
      dockerResult: {
        success: dockerStarted,
        runningContainers,
      },
    });

    return NextResponse.json({
      success: true,
      handoffId,
      source,
      validation,
      project,
      diskPath,
      dockerStarted,
      runningContainers,
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
