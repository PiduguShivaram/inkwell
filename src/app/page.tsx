'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CanvasWorkspace } from '@/components/CanvasWorkspace';
import { CompilerInspector } from '@/components/CompilerInspector';
import { Header } from '@/components/Header';
import { HealthTelemetryPanel } from '@/components/HealthTelemetryPanel';
import { OfficeKitBridgePanel } from '@/components/OfficeKitBridgePanel';
import { RuntimePanel } from '@/components/RuntimePanel';
import { SketchIngestionPanel } from '@/components/SketchIngestionModal';
import { ValidationPanel } from '@/components/ValidationPanel';
import { CompiledProject } from '@/core/compiler/types';
import { createEmptyGraph } from '@/core/graph/builder';
import { CANONICAL_VERTICAL_SLICE_GRAPH } from '@/core/graph/fixtures';
import { GraphIR } from '@/core/graph/types';
import { ContainerState, DockerEnvironmentInfo } from '@/core/runtime/types';
import { TelemetryReport } from '@/core/telemetry/types';
import { validateGraphIR } from '@/core/validation/validator';
import { VisionModelInfo } from '@/core/vision/types';

export default function InkwellWorkspacePage() {
  // Graph state: Initialized with canonical reference architecture
  const [graph, setGraph] = useState<GraphIR>(CANONICAL_VERTICAL_SLICE_GRAPH);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('workspace');

  // Environment and status states
  const [dockerInfo, setDockerInfo] = useState<DockerEnvironmentInfo | null>(null);
  const [visionInfo, setVisionInfo] = useState<VisionModelInfo | null>(null);
  const [containers, setContainers] = useState<ContainerState[]>([]);

  // Compiler state
  const [compiledProject, setCompiledProject] = useState<CompiledProject | null>(null);
  const [compiledDiskPath, setCompiledDiskPath] = useState<string | undefined>();
  const [isCompiling, setIsCompiling] = useState(false);

  // Telemetry state
  const [telemetryReport, setTelemetryReport] = useState<TelemetryReport | null>(null);
  const [isProbingTelemetry, setIsProbingTelemetry] = useState(false);
  const [autoPollTelemetry, setAutoPollTelemetry] = useState(false);

  // Real-time graph validation
  const validation = validateGraphIR(graph);

  // 1. Fetch real Docker environment status
  const fetchDockerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/docker/status');
      const data = (await res.json()) as DockerEnvironmentInfo;
      setDockerInfo(data);
    } catch {
      setDockerInfo({
        isInstalled: false,
        isDaemonRunning: false,
        error: 'Failed to probe Docker API.',
      });
    }
  }, []);

  // 2. Fetch real Vision model status
  const fetchVisionStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/vision/status');
      const data = (await res.json()) as VisionModelInfo;
      setVisionInfo(data);
    } catch {
      // Keep null or fallback
    }
  }, []);

  // 3. Fetch real container statuses for current project
  const fetchContainers = useCallback(async () => {
    const projectName = compiledProject?.projectName || 'canonical-pipeline-api-queue-worker-db';
    try {
      const res = await fetch(`/api/runtime/containers?projectName=${encodeURIComponent(projectName)}`);
      const data = await res.json();
      setContainers(data.containers || []);
    } catch {
      setContainers([]);
    }
  }, [compiledProject?.projectName]);

  // Initial load
  useEffect(() => {
    fetchDockerStatus();
    fetchVisionStatus();
  }, [fetchDockerStatus, fetchVisionStatus]);

  // Compile graph handler
  const handleCompile = async () => {
    setIsCompiling(true);
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(graph),
      });

      const data = await res.json();
      if (data.success) {
        setCompiledProject(data.project);
        setCompiledDiskPath(data.diskPath);
        setActiveTab('compiler');
      } else {
        alert(`Compilation failed: ${data.error || 'Invalid graph'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Compilation request failed: ${msg}`);
    } finally {
      setIsCompiling(false);
    }
  };

  // Telemetry probe handler
  const handleProbeTelemetry = useCallback(async () => {
    const services = compiledProject?.services;
    if (!services || services.length === 0) return;

    setIsProbingTelemetry(true);
    try {
      const res = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services,
          projectName: compiledProject.projectName,
        }),
      });

      const report = (await res.json()) as TelemetryReport;
      setTelemetryReport(report);
    } catch {
      // Probing failed
    } finally {
      setIsProbingTelemetry(false);
    }
  }, [compiledProject]);

  // Auto-polling effect for telemetry
  useEffect(() => {
    if (!autoPollTelemetry || !compiledProject) return;
    const interval = setInterval(() => {
      handleProbeTelemetry();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoPollTelemetry, compiledProject, handleProbeTelemetry]);

  // Presets
  const handleLoadCanonical = () => {
    setGraph(CANONICAL_VERTICAL_SLICE_GRAPH);
    setSelectedNodeId(null);
  };

  const handleResetCanvas = () => {
    setGraph(createEmptyGraph('Scratch Architecture'));
    setSelectedNodeId(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-[#0f172a]">
      {/* Header */}
      <Header
        dockerInfo={dockerInfo}
        visionInfo={visionInfo}
        onRefreshDocker={fetchDockerStatus}
        onLoadCanonical={handleLoadCanonical}
        onResetCanvas={handleResetCanvas}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isValid={validation.isValid}
        errorCount={validation.errors.length}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TAB 1: Architecture Canvas & Validation */}
        {activeTab === 'workspace' && (
          <div className="space-y-6">
            <CanvasWorkspace
              graph={graph}
              setGraph={setGraph}
              onCompile={handleCompile}
              isCompiling={isCompiling}
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
            />

            <ValidationPanel
              validation={validation}
              onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            />
          </div>
        )}

        {/* TAB 1.5: Phase 4 Office Kit & Phone/Laptop Bridge */}
        {activeTab === 'bridge' && (
          <OfficeKitBridgePanel
            onGraphReceived={(receivedGraph, project) => {
              setGraph(receivedGraph);
              if (project) {
                setCompiledProject(project);
                setCompiledDiskPath(`.inkwell/generated/${project.projectName}`);
              }
            }}
            activeProject={compiledProject}
            onRefreshRuntime={fetchContainers}
          />
        )}

        {/* TAB 2: Compiler Inspector */}
        {activeTab === 'compiler' && (
          <CompilerInspector
            project={compiledProject}
            diskPath={compiledDiskPath}
            onCompile={handleCompile}
            isCompiling={isCompiling}
          />
        )}

        {/* TAB 3: Docker Runtime Orchestration */}
        {activeTab === 'runtime' && (
          <RuntimePanel
            dockerInfo={dockerInfo}
            containers={containers}
            onRefreshContainers={fetchContainers}
            onRefreshDocker={fetchDockerStatus}
            projectName={compiledProject?.projectName || 'canonical-pipeline-api-queue-worker-db'}
          />
        )}

        {/* TAB 4: Health Probes & Telemetry */}
        {activeTab === 'telemetry' && (
          <HealthTelemetryPanel
            telemetryReport={telemetryReport}
            services={compiledProject?.services || []}
            onProbeNow={handleProbeTelemetry}
            isProbing={isProbingTelemetry}
            autoRefresh={autoPollTelemetry}
            setAutoRefresh={setAutoPollTelemetry}
          />
        )}

        {/* TAB 5: Vision & Camera Ingestion */}
        {activeTab === 'vision' && (
          <SketchIngestionPanel
            visionInfo={visionInfo}
            onConfirmGraph={(confirmedGraph) => {
              setGraph(confirmedGraph);
              setActiveTab('workspace');
            }}
          />
        )}
      </main>

      {/* Persistent Developer Footer */}
      <footer className="border-t border-[#e2e8f0] bg-white py-3 px-4 sm:px-6 lg:px-8 text-xs font-mono text-[#64748b] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-4">
          <span>Inkwell v1.0.0-phase1</span>
          <span>•</span>
          <span>Nodes: {graph.nodes.length}</span>
          <span>•</span>
          <span>Edges: {graph.edges.length}</span>
          <span>•</span>
          <span className={validation.isValid ? 'text-emerald-700' : 'text-rose-600 font-bold'}>
            Status: {validation.isValid ? 'VALID' : `${validation.errors.length} ERRORS`}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span>iQOO Hackathon 2026 Developer Tools</span>
        </div>
      </footer>
    </div>
  );
}
