'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  Eye,
  FileCode,
  FolderOpen,
  Layers,
  Link2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Terminal,
  Trash2,
  Upload,
  Workflow,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  addEdgeToGraph,
  createEdge,
  createNode,
  removeEdgeFromGraph,
  removeNodeFromGraph,
  updateNodeInGraph,
} from '@/core/graph/builder';
import { GraphEdge, GraphIR, GraphNode, NodeType, SUPPORTED_NODE_TYPES } from '@/core/graph/types';
import { compileGraph } from '@/core/compiler/compiler';
import { CompiledProject } from '@/core/compiler/types';
import { ContainerState, DockerEnvironmentInfo } from '@/core/runtime/types';
import { validateGraphIR } from '@/core/validation/validator';
import { ValidationError, ValidationResult } from '@/core/validation/types';

export type LifecycleStage =
  | 'NEW'
  | 'CAPTURED'
  | 'VERIFIED'
  | 'EDITING'
  | 'VALIDATED'
  | 'SAVED'
  | 'COMPILED'
  | 'RUNNING';

interface ArchitectureWorkspaceProps {
  graph: GraphIR;
  setGraph: React.Dispatch<React.SetStateAction<GraphIR>>;
  onCompile: () => void;
  isCompiling: boolean;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  containers: ContainerState[];
  onRefreshContainers: () => void;
  compiledProject: CompiledProject | null;
  dockerInfo: DockerEnvironmentInfo | null;
}

export function ArchitectureWorkspace({
  graph,
  setGraph,
  onCompile,
  isCompiling,
  selectedNodeId,
  setSelectedNodeId,
  containers,
  onRefreshContainers,
  compiledProject,
  dockerInfo,
}: ArchitectureWorkspaceProps) {
  // Canvas interaction states
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Persistence UI state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState(graph.metadata?.name || 'my-architecture');
  const [savedArchitectures, setSavedArchitectures] = useState<string[]>([]);
  const [openDropdownOpen, setOpenDropdownOpen] = useState(false);
  const [persistenceFeedback, setPersistenceFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Compiler preview modal / panel
  const [showCompilerPreview, setShowCompilerPreview] = useState(false);
  const [previewTab, setPreviewTab] = useState<'compose' | 'services' | 'ir'>('compose');

  // Logs modal state
  const [activeLogService, setActiveLogService] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logTail, setLogTail] = useState(100);

  // Runtime action feedback per service
  const [runtimeActionLoading, setRuntimeActionLoading] = useState<string | null>(null);

  // Environment Variable editing in Node Inspector
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  // Target node selection for inspector-based connection creation
  const [connectionTargetId, setConnectionTargetId] = useState<string>('');

  // Real-time Graph Validation
  const validation: ValidationResult = useMemo(() => validateGraphIR(graph), [graph]);

  // Derive Lifecycle State
  const lifecycleStage: LifecycleStage = useMemo(() => {
    const hasRunningContainers = containers.some((c) => c.state === 'running');
    if (hasRunningContainers) return 'RUNNING';
    if (compiledProject) return 'COMPILED';
    if (persistenceFeedback?.type === 'success') return 'SAVED';
    if (validation.isValid) return 'VALIDATED';
    return 'EDITING';
  }, [containers, compiledProject, persistenceFeedback, validation.isValid]);

  // Selected entities
  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) || null,
    [graph.nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => graph.edges.find((e) => e.id === selectedEdgeId) || null,
    [graph.edges, selectedEdgeId]
  );

  // Match node to real Docker container status
  const getNodeContainerState = useCallback(
    (nodeId: string): ContainerState | undefined => {
      const sanitized = nodeId.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
      return containers.find((c) => {
        const cService = c.service.toLowerCase();
        const cName = c.name.toLowerCase();
        return (
          cService === sanitized ||
          cName.includes(sanitized) ||
          (nodeId === 'api-gateway' && (cService.includes('api') || cName.includes('api'))) ||
          (nodeId === 'processing-worker' && (cService.includes('worker') || cName.includes('worker'))) ||
          (nodeId === 'task-queue' && (cService.includes('queue') || cService.includes('redis'))) ||
          (nodeId === 'primary-db' && (cService.includes('db') || cService.includes('postgres')))
        );
      });
    },
    [containers]
  );

  // Fetch list of saved architectures
  const refreshSavedArchitectures = useCallback(async () => {
    try {
      const res = await fetch('/api/architecture');
      const data = await res.json();
      if (data.success && Array.isArray(data.architectures)) {
        setSavedArchitectures(data.architectures);
      }
    } catch {
      // Ignore network errors on initial poll
    }
  }, []);

  useEffect(() => {
    refreshSavedArchitectures();
  }, [refreshSavedArchitectures]);

  // Save Architecture handler
  const handleSaveArchitecture = async () => {
    if (!saveName.trim()) return;
    try {
      const res = await fetch('/api/architecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName.trim(), graph }),
      });
      const data = await res.json();
      if (data.success) {
        setPersistenceFeedback({
          type: 'success',
          message: `Architecture saved successfully to ${data.filePath || saveName}`,
        });
        setSaveModalOpen(false);
        refreshSavedArchitectures();
      } else {
        setPersistenceFeedback({
          type: 'error',
          message: data.error || 'Failed to save architecture.',
        });
      }
    } catch (err: unknown) {
      setPersistenceFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Load Architecture handler
  const handleLoadArchitecture = async (name: string) => {
    try {
      const res = await fetch(`/api/architecture/${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.success && data.graph) {
        setGraph(data.graph);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setOpenDropdownOpen(false);
        setPersistenceFeedback({
          type: 'success',
          message: `Loaded architecture '${name}' successfully.`,
        });
      } else {
        setPersistenceFeedback({
          type: 'error',
          message: data.error || 'Failed to load architecture.',
        });
      }
    } catch (err: unknown) {
      setPersistenceFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Export JSON file
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(graph, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${graph.metadata?.name || 'architecture'}-${Date.now()}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON file
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const importedValidation = validateGraphIR(parsed);
        if (importedValidation.isValid) {
          setGraph(parsed);
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
          setPersistenceFeedback({
            type: 'success',
            message: `Successfully imported valid Graph IR: ${parsed.metadata?.name || file.name}`,
          });
        } else {
          setPersistenceFeedback({
            type: 'error',
            message: `Imported file failed Graph IR validation: ${importedValidation.errors
              .map((err) => err.message)
              .join(', ')}`,
          });
        }
      } catch (err) {
        setPersistenceFeedback({
          type: 'error',
          message: `Malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Node Drag and Drop
  const handleMouseDownNode = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    if (connectingSourceId) {
      handleCompleteConnection(node.id);
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setDraggingNodeId(node.id);
    const pos = node.position || { x: 100, y: 100 };
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!draggingNodeId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(20, Math.min(rect.width - 240, e.clientX - dragOffset.x));
    const newY = Math.max(20, Math.min(rect.height - 140, e.clientY - dragOffset.y));

    setGraph((prev) =>
      updateNodeInGraph(prev, draggingNodeId, { position: { x: newX, y: newY } })
    );
  };

  const handleMouseUpCanvas = () => {
    setDraggingNodeId(null);
  };

  // Connection management
  const handleStartConnection = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectingSourceId(nodeId);
  };

  const handleCompleteConnection = (targetId: string) => {
    if (!connectingSourceId || connectingSourceId === targetId) {
      setConnectingSourceId(null);
      return;
    }

    // Check if edge already exists
    const exists = graph.edges.some(
      (e) => e.source === connectingSourceId && e.target === targetId
    );
    if (!exists) {
      const newEdge = createEdge(connectingSourceId, targetId);
      setGraph((prev) => addEdgeToGraph(prev, newEdge));
    }
    setConnectingSourceId(null);
  };

  const handleAddConnectionFromInspector = () => {
    if (!selectedNode || !connectionTargetId || selectedNode.id === connectionTargetId) return;
    const exists = graph.edges.some(
      (e) => e.source === selectedNode.id && e.target === connectionTargetId
    );
    if (!exists) {
      const newEdge = createEdge(selectedNode.id, connectionTargetId);
      setGraph((prev) => addEdgeToGraph(prev, newEdge));
      setConnectionTargetId('');
    }
  };

  const handleRemoveEdge = (edgeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setGraph((prev) => removeEdgeFromGraph(prev, edgeId));
    if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
  };

  // Node Editing Handlers
  const handleAddNode = (type: NodeType) => {
    const existingOfSameType = graph.nodes.filter((n) => n.type === type).length;
    const defaultLabels: Record<NodeType, string> = {
      service: `API Service ${existingOfSameType + 1}`,
      queue: `Task Queue ${existingOfSameType + 1}`,
      worker: `Worker ${existingOfSameType + 1}`,
      database: `Primary DB ${existingOfSameType + 1}`,
    };

    const offset = (graph.nodes.length * 40) % 240;
    const newNode = createNode({
      type,
      label: defaultLabels[type],
      position: { x: 80 + offset, y: 100 + offset },
    });

    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
  };

  const handleRemoveNode = (nodeId: string) => {
    setGraph((prev) => removeNodeFromGraph(prev, nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleUpdateNodeLabel = (nodeId: string, label: string) => {
    setGraph((prev) => updateNodeInGraph(prev, nodeId, { label }));
  };

  const handleUpdateNodeType = (nodeId: string, type: NodeType) => {
    setGraph((prev) => updateNodeInGraph(prev, nodeId, { type }));
  };

  const handleUpdateNodePorts = (
    nodeId: string,
    ports: { hostPort?: number; internalPort?: number }
  ) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setGraph((prev) =>
      updateNodeInGraph(prev, nodeId, {
        ports: { ...(node.ports || {}), ...ports },
      })
    );
  };

  const handleAddEnvVar = (nodeId: string) => {
    if (!newEnvKey.trim()) return;
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const updatedEnv = { ...(node.env || {}), [newEnvKey.trim().toUpperCase()]: newEnvValue };
    setGraph((prev) => updateNodeInGraph(prev, nodeId, { env: updatedEnv }));
    setNewEnvKey('');
    setNewEnvValue('');
  };

  const handleRemoveEnvVar = (nodeId: string, key: string) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node || !node.env) return;
    const updatedEnv = { ...node.env };
    delete updatedEnv[key];
    setGraph((prev) => updateNodeInGraph(prev, nodeId, { env: updatedEnv }));
  };

  // Real Service Runtime Controls (Step 7)
  const handleServiceControl = async (
    serviceName: string,
    action: 'start' | 'stop' | 'restart'
  ) => {
    setRuntimeActionLoading(serviceName);
    try {
      const res = await fetch('/api/runtime/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          serviceName,
          projectName: compiledProject?.projectName || 'canonical-pipeline-api-queue-worker-db',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Runtime action '${action}' failed: ${data.error || 'Unknown error'}`);
      }
      onRefreshContainers();
    } catch (err: unknown) {
      alert(`Runtime control request failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRuntimeActionLoading(null);
    }
  };

  // Real Service Logs Fetcher (Step 8)
  const handleOpenLogs = async (serviceName: string) => {
    setActiveLogService(serviceName);
    setIsLoadingLogs(true);
    setLogContent('Fetching container logs...');
    try {
      const projectName = compiledProject?.projectName || 'canonical-pipeline-api-queue-worker-db';
      const res = await fetch(
        `/api/runtime/logs?projectName=${encodeURIComponent(
          projectName
        )}&service=${encodeURIComponent(serviceName)}&tail=${logTail}`
      );
      const data = await res.json();
      if (data.success) {
        setLogContent(data.logs || '(No logs returned)');
      } else {
        setLogContent(`Error retrieving logs: ${data.error || 'Container unavailable'}`);
      }
    } catch (err: unknown) {
      setLogContent(`Network error fetching logs: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Deterministic live compiler preview content
  const previewData = useMemo(() => {
    try {
      if (!validation.isValid) return null;
      return compileGraph(graph);
    } catch {
      return null;
    }
  }, [graph, validation.isValid]);

  // Visual type configuration
  const getNodeTypeConfig = (type: NodeType) => {
    switch (type) {
      case 'service':
        return {
          icon: Server,
          badge: 'bg-blue-50 text-[#0052ff] border-blue-200',
          selectedRing: 'ring-2 ring-[#0052ff] border-blue-500',
          baseBorder: 'border-blue-200 hover:border-blue-400',
          indicator: 'bg-[#0052ff]',
          name: 'API Service',
        };
      case 'queue':
        return {
          icon: Layers,
          badge: 'bg-purple-50 text-purple-700 border-purple-200',
          selectedRing: 'ring-2 ring-purple-600 border-purple-500',
          baseBorder: 'border-purple-200 hover:border-purple-400',
          indicator: 'bg-purple-600',
          name: 'Message Queue',
        };
      case 'worker':
        return {
          icon: Zap,
          badge: 'bg-amber-50 text-amber-800 border-amber-200',
          selectedRing: 'ring-2 ring-amber-500 border-amber-500',
          baseBorder: 'border-amber-200 hover:border-amber-400',
          indicator: 'bg-amber-500',
          name: 'Worker',
        };
      case 'database':
        return {
          icon: Database,
          badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          selectedRing: 'ring-2 ring-emerald-600 border-emerald-500',
          baseBorder: 'border-emerald-200 hover:border-emerald-400',
          indicator: 'bg-emerald-600',
          name: 'Database',
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. LIFECYCLE BAR & PERSISTENCE HEADER */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Project Lifecycle Indicator (Step 12) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
          <span className="text-[11px] font-semibold text-[#64748b] mr-1 uppercase tracking-wider">
            Lifecycle:
          </span>
          {(
            [
              'NEW',
              'CAPTURED',
              'VERIFIED',
              'EDITING',
              'VALIDATED',
              'SAVED',
              'COMPILED',
              'RUNNING',
            ] as LifecycleStage[]
          ).map((stage, idx) => {
            const isActive = lifecycleStage === stage;
            return (
              <div key={stage} className="flex items-center space-x-1">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                    isActive
                      ? 'bg-[#0052ff] text-white border-[#0052ff] font-bold shadow-sm ring-2 ring-blue-100'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                >
                  {stage}
                </span>
                {idx < 7 && <span className="text-[10px] text-slate-300">→</span>}
              </div>
            );
          })}
        </div>

        {/* Persistence Actions & Compiler Trigger */}
        <div className="flex items-center space-x-2">
          {/* Save Architecture (Step 11) */}
          <button
            onClick={() => setSaveModalOpen(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5 text-[#0052ff]" />
            <span>Save</span>
          </button>

          {/* Open Architecture Dropdown (Step 11) */}
          <div className="relative">
            <button
              onClick={() => {
                refreshSavedArchitectures();
                setOpenDropdownOpen(!openDropdownOpen);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#0052ff]" />
              <span>Open</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {openDropdownOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase text-slate-400 border-b border-slate-100">
                  Saved Architectures
                </div>
                {savedArchitectures.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400 italic">No saved files</div>
                ) : (
                  savedArchitectures.map((archName) => (
                    <button
                      key={archName}
                      onClick={() => handleLoadArchitecture(archName)}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-[#0052ff] flex items-center justify-between"
                    >
                      <span className="truncate">{archName}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Export JSON */}
          <button
            onClick={handleExportJson}
            title="Export Graph IR as JSON"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Import JSON */}
          <label
            title="Import Graph IR JSON"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>

          {/* Compiler Preview Toggle (Step 6) */}
          <button
            onClick={() => setShowCompilerPreview(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-200 bg-blue-50 text-[#0052ff] hover:bg-blue-100 transition-colors shadow-sm"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Compiler Preview</span>
          </button>

          {/* Compile & Run Button */}
          <button
            onClick={onCompile}
            disabled={isCompiling || !validation.isValid}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-[#0052ff] hover:bg-[#0045d8] disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isCompiling ? 'Compiling...' : 'Compile Architecture'}</span>
          </button>
        </div>
      </div>

      {/* Persistence Feedback Alert */}
      {persistenceFeedback && (
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${
            persistenceFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {persistenceFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{persistenceFeedback.message}</span>
          </div>
          <button
            onClick={() => setPersistenceFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. TOOLBAR: NODE CREATION & REAL-TIME VALIDATION BANNER */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Node creation controls (Step 3) */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-[#64748b] mr-1">Add Node:</span>
          {SUPPORTED_NODE_TYPES.map((type) => {
            const config = getNodeTypeConfig(type);
            const Icon = config.icon;
            return (
              <button
                key={type}
                onClick={() => handleAddNode(type)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${config.badge} hover:brightness-95`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>+ {config.name}</span>
              </button>
            );
          })}
        </div>

        {/* Validation Status Summary (Step 4) */}
        <div className="flex items-center space-x-2">
          {validation.isValid ? (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Valid Graph IR (Ready to Compile)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono font-medium">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>
                {validation.errors.length} {validation.errors.length === 1 ? 'Error' : 'Errors'} Found
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Connection Mode Helper Banner */}
      {connectingSourceId && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg text-xs text-amber-800 animate-pulse">
          <div className="flex items-center space-x-2">
            <Link2 className="w-4 h-4 text-amber-600" />
            <span>
              Connection in progress: Click a target node to complete connection from{' '}
              <strong>{connectingSourceId}</strong>.
            </span>
          </div>
          <button
            onClick={() => setConnectingSourceId(null)}
            className="font-bold underline text-amber-900 hover:text-amber-700"
          >
            Cancel Connection
          </button>
        </div>
      )}

      {/* 3. MAIN WORKSPACE: CANVAS (3 COLS) + INSPECTOR (1 COL) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Interactive Canvas (Step 1 & Step 3) */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMoveCanvas}
          onMouseUp={handleMouseUpCanvas}
          onClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setConnectingSourceId(null);
          }}
          className="lg:col-span-3 h-[600px] relative border border-[#e2e8f0] rounded-xl canvas-grid overflow-hidden bg-white select-none shadow-inner"
        >
          {/* SVG Connection Lines Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <marker
                id="arrowhead-phase6"
                viewBox="0 0 10 10"
                refX="22"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#0052ff" />
              </marker>
              <marker
                id="arrowhead-selected"
                viewBox="0 0 10 10"
                refX="22"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
              </marker>
            </defs>

            {graph.edges.map((edge) => {
              const sourceNode = graph.nodes.find((n) => n.id === edge.source);
              const targetNode = graph.nodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const sx = (sourceNode.position?.x || 80) + 105;
              const sy = (sourceNode.position?.y || 100) + 45;
              const tx = (targetNode.position?.x || 80) + 105;
              const ty = (targetNode.position?.y || 100) + 45;

              const dx = tx - sx;
              const dy = ty - sy;
              const cx1 = sx + dx * 0.5;
              const cy1 = sy;
              const cx2 = sx + dx * 0.5;
              const cy2 = ty;
              const pathData = `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`;
              const isSelected = selectedEdgeId === edge.id;

              return (
                <g key={edge.id}>
                  <path
                    d={pathData}
                    stroke={isSelected ? '#f43f5e' : '#94a3b8'}
                    strokeWidth={isSelected ? '3' : '2'}
                    fill="none"
                    markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead-phase6)'}
                  />
                </g>
              );
            })}
          </svg>

          {/* Interactive Edge midpoint delete / select buttons */}
          {graph.edges.map((edge) => {
            const sourceNode = graph.nodes.find((n) => n.id === edge.source);
            const targetNode = graph.nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const sx = (sourceNode.position?.x || 80) + 105;
            const sy = (sourceNode.position?.y || 100) + 45;
            const tx = (targetNode.position?.x || 80) + 105;
            const ty = (targetNode.position?.y || 100) + 45;
            const midX = (sx + tx) / 2;
            const midY = (sy + ty) / 2;
            const isSelected = selectedEdgeId === edge.id;

            return (
              <div
                key={`btn-${edge.id}`}
                style={{ left: `${midX - 12}px`, top: `${midY - 12}px` }}
                className="absolute z-20 group"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                  }}
                  title={`Connection: ${edge.source} -> ${edge.target} (Click to inspect or delete)`}
                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold shadow-sm transition-all ${
                    isSelected
                      ? 'bg-rose-500 border-rose-600 text-white'
                      : 'bg-white border-slate-300 hover:border-rose-400 hover:bg-rose-50 text-slate-500 hover:text-rose-600'
                  }`}
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Render Graph Nodes (Step 1, Step 9, Step 10) */}
          {graph.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isConnectingSource = connectingSourceId === node.id;
            const style = getNodeTypeConfig(node.type);
            const pos = node.position || { x: 80, y: 100 };
            const container = getNodeContainerState(node.id);

            // Real Docker status mapping (Step 9 & Step 10)
            const isRunning = container?.state === 'running';
            const isHealthy = container?.health === 'healthy';
            const isDown = container && (container.state === 'exited' || container.health === 'unhealthy');

            let runtimeBadge = (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                OFFLINE
              </span>
            );
            if (!dockerInfo?.isDaemonRunning) {
              runtimeBadge = (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  DOCKER UNAVAILABLE
                </span>
              );
            } else if (isRunning && isHealthy) {
              runtimeBadge = (
                <span className="flex items-center space-x-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>HEALTHY</span>
                </span>
              );
            } else if (isRunning) {
              runtimeBadge = (
                <span className="flex items-center space-x-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>UP</span>
                </span>
              );
            } else if (isDown) {
              runtimeBadge = (
                <span className="flex items-center space-x-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>DOWN</span>
                </span>
              );
            }

            return (
              <div
                key={node.id}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                }}
                onMouseDown={(e) => handleMouseDownNode(e, node)}
                className={`absolute w-52 rounded-lg bg-white p-3 shadow-sm border transition-shadow cursor-grab active:cursor-grabbing z-20 ${
                  isSelected ? style.selectedRing : isDown ? 'border-rose-400 ring-1 ring-rose-200' : style.baseBorder
                } ${isConnectingSource ? 'ring-2 ring-amber-400 bg-amber-50/20' : ''}`}
              >
                {/* Node Top: Type Badge & Action Icons */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2 h-2 rounded-full ${style.indicator}`} />
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${style.badge}`}>
                      {node.type}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => handleStartConnection(node.id, e)}
                      title="Connect this node to another"
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-[#0052ff]"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveNode(node.id);
                      }}
                      title="Delete Node"
                      className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Node Label */}
                <div className="font-semibold text-xs text-[#0f172a] truncate mb-1">
                  {node.label}
                </div>

                {/* Node ID & Host Port */}
                <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b] mb-2">
                  <span className="truncate max-w-[100px]">{node.id}</span>
                  {node.ports?.hostPort ? (
                    <span className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-700">
                      :{node.ports.hostPort}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">auto-port</span>
                  )}
                </div>

                {/* Real Docker Runtime Status (Step 9 & Step 10) */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  {runtimeBadge}
                  {container && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenLogs(node.id);
                      }}
                      title="Open Container Logs"
                      className="text-[10px] text-[#0052ff] hover:underline flex items-center space-x-0.5"
                    >
                      <Terminal className="w-2.5 h-2.5" />
                      <span>Logs</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty Canvas Placeholder */}
          {graph.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
              <Workflow className="w-12 h-12 mb-2 stroke-[1.2]" />
              <p className="text-sm font-medium">Architecture Canvas is Empty</p>
              <p className="text-xs text-slate-400 mt-1">
                Add nodes from the toolbar above or click &quot;Open&quot; to load an existing architecture.
              </p>
            </div>
          )}
        </div>

        {/* 4. NODE INSPECTOR & CONFIGURATOR (Step 2, Step 3, Step 5, Step 7) */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm h-[600px] overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-4 text-xs">
              {/* Header */}
              <div className="pb-2 border-b border-[#f1f5f9] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">Node Inspector</h3>
                  <span className="text-[10px] font-mono text-slate-500">{selectedNode.id}</span>
                </div>
                <span className="text-[10px] font-mono uppercase bg-blue-50 text-[#0052ff] border border-blue-200 px-2 py-0.5 rounded font-semibold">
                  {selectedNode.type}
                </span>
              </div>

              {/* 1. Label Editing (Step 3) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Display Label
                </label>
                <input
                  type="text"
                  value={selectedNode.label}
                  onChange={(e) => handleUpdateNodeLabel(selectedNode.id, e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-[#0f172a] text-xs focus:outline-none focus:border-[#0052ff]"
                />
              </div>

              {/* 2. Type Editing (Step 3) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Supported Node Type
                </label>
                <select
                  value={selectedNode.type}
                  onChange={(e) =>
                    handleUpdateNodeType(selectedNode.id, e.target.value as NodeType)
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-[#0f172a] text-xs focus:outline-none focus:border-[#0052ff]"
                >
                  {SUPPORTED_NODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Port Configuration (Step 5) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Host Port
                  </label>
                  <input
                    type="number"
                    placeholder="Auto"
                    value={selectedNode.ports?.hostPort || ''}
                    onChange={(e) =>
                      handleUpdateNodePorts(selectedNode.id, {
                        hostPort: parseInt(e.target.value) || undefined,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-[#0f172a] text-xs font-mono focus:outline-none focus:border-[#0052ff]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Internal Port
                  </label>
                  <input
                    type="number"
                    placeholder="Auto"
                    value={selectedNode.ports?.internalPort || ''}
                    onChange={(e) =>
                      handleUpdateNodePorts(selectedNode.id, {
                        internalPort: parseInt(e.target.value) || undefined,
                      })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-[#0f172a] text-xs font-mono focus:outline-none focus:border-[#0052ff]"
                  />
                </div>
              </div>

              {/* 4. Health Check Endpoint Display (Step 2) */}
              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">
                  Health Check
                </span>
                <span className="font-mono text-[11px] text-slate-700">
                  {selectedNode.type === 'service' || selectedNode.type === 'worker'
                    ? 'HTTP GET /health'
                    : selectedNode.type === 'queue'
                    ? 'Redis Protocol (PING)'
                    : 'PostgreSQL Protocol (pg_isready)'}
                </span>
              </div>

              {/* 5. Environment Variables Editor (Step 5) */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                  Environment Configuration
                </label>
                <div className="space-y-1 mb-2 max-h-28 overflow-y-auto">
                  {selectedNode.env && Object.keys(selectedNode.env).length > 0 ? (
                    Object.entries(selectedNode.env).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px]"
                      >
                        <span className="text-slate-800 font-semibold truncate max-w-[80px]">
                          {k}
                        </span>
                        <span className="text-slate-500 truncate max-w-[80px]">={v}</span>
                        <button
                          onClick={() => handleRemoveEnvVar(selectedNode.id, k)}
                          className="text-slate-400 hover:text-rose-600 text-xs px-1"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No custom env vars set.</span>
                  )}
                </div>

                {/* Add new env var row */}
                <div className="flex space-x-1">
                  <input
                    type="text"
                    placeholder="KEY"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                    className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-mono"
                  />
                  <input
                    type="text"
                    placeholder="VALUE"
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                    className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-mono"
                  />
                  <button
                    onClick={() => handleAddEnvVar(selectedNode.id)}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 6. Connection Management (Step 3) */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Connections & Outbound Edges
                </label>
                <div className="space-y-1 mb-2">
                  {graph.edges
                    .filter((e) => e.source === selectedNode.id)
                    .map((edge) => (
                      <div
                        key={edge.id}
                        className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-200 font-mono text-[11px]"
                      >
                        <div className="flex items-center space-x-1.5 truncate">
                          <ArrowRight className="w-3 h-3 text-[#0052ff]" />
                          <span className="text-slate-700 truncate">{edge.target}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveEdge(edge.id)}
                          className="text-slate-400 hover:text-rose-600 text-xs px-1 font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  {graph.edges.filter((e) => e.source === selectedNode.id).length === 0 && (
                    <span className="text-[10px] text-slate-400 italic">No outbound edges.</span>
                  )}
                </div>

                {/* Add Connection Dropdown */}
                <div className="flex space-x-1">
                  <select
                    value={connectionTargetId}
                    onChange={(e) => setConnectionTargetId(e.target.value)}
                    className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-[11px]"
                  >
                    <option value="">Select target...</option>
                    {graph.nodes
                      .filter((n) => n.id !== selectedNode.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.id})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={handleAddConnectionFromInspector}
                    disabled={!connectionTargetId}
                    className="px-2.5 py-1 bg-blue-50 text-[#0052ff] hover:bg-blue-100 disabled:opacity-50 border border-blue-200 rounded text-[10px] font-semibold"
                  >
                    Connect
                  </button>
                </div>
              </div>

              {/* 7. Per-Service Real Runtime Control (Step 7) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Real Runtime Control
                  </span>
                  {runtimeActionLoading === selectedNode.id && (
                    <RefreshCw className="w-3 h-3 text-[#0052ff] animate-spin" />
                  )}
                </div>

                {dockerInfo?.isDaemonRunning ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleServiceControl(selectedNode.id, 'start')}
                      disabled={runtimeActionLoading === selectedNode.id}
                      className="px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded text-[10px] font-bold disabled:opacity-50"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => handleServiceControl(selectedNode.id, 'stop')}
                      disabled={runtimeActionLoading === selectedNode.id}
                      className="px-2 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[10px] font-bold disabled:opacity-50"
                    >
                      Stop
                    </button>
                    <button
                      onClick={() => handleServiceControl(selectedNode.id, 'restart')}
                      disabled={runtimeActionLoading === selectedNode.id}
                      className="px-2 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded text-[10px] font-bold disabled:opacity-50"
                    >
                      Restart
                    </button>
                  </div>
                ) : (
                  <div className="p-2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px]">
                    DOCKER UNAVAILABLE (Start Docker Desktop to enable control)
                  </div>
                )}

                {/* View Real Logs Button (Step 8) */}
                <button
                  onClick={() => handleOpenLogs(selectedNode.id)}
                  className="w-full mt-2 flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-semibold"
                >
                  <Terminal className="w-3 h-3 text-slate-500" />
                  <span>View Container Logs</span>
                </button>
              </div>

              {/* 8. Delete Node */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleRemoveNode(selectedNode.id)}
                  className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Node</span>
                </button>
              </div>
            </div>
          ) : selectedEdge ? (
            /* Selected Connection Inspector */
            <div className="space-y-4 text-xs">
              <div className="pb-2 border-b border-[#f1f5f9] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0f172a]">Connection Inspector</h3>
                <span className="text-[10px] font-mono text-slate-400">{selectedEdge.id}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Source:</span>
                  <span className="font-mono text-slate-800 font-bold">{selectedEdge.source}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Target:</span>
                  <span className="font-mono text-slate-800 font-bold">{selectedEdge.target}</span>
                </div>
              </div>
              <button
                onClick={() => handleRemoveEdge(selectedEdge.id)}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Connection</span>
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs px-4">
              <Server className="w-8 h-8 mb-2 stroke-[1.2] text-slate-300" />
              <p className="font-medium text-slate-600 mb-1">Architecture Inspector</p>
              <p>Select any node or connection on the canvas to configure properties or inspect runtime status.</p>
            </div>
          )}
        </div>
      </div>

      {/* 5. VALIDATION REPORT PANEL (Step 4 & Step 13) */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-[#0f172a]">Architecture Validation</span>
            {validation.isValid ? (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                STATUS: VALID
              </span>
            ) : (
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                STATUS: {validation.errors.length} VIOLATIONS
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">
            {graph.nodes.length} Nodes • {graph.edges.length} Edges
          </span>
        </div>

        <div className="mt-3">
          {validation.isValid ? (
            <div className="flex items-center space-x-2 text-xs text-emerald-700 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                All topology constraints, ports, and unique identifiers verified. The architecture is fully ready for deterministic compilation.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {validation.errors.map((err, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs flex items-start justify-between"
                >
                  <div className="flex items-start space-x-2">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-rose-800">[{err.code}]</span>
                        <span className="text-rose-900">{err.message}</span>
                      </div>
                      {err.nodeId && (
                        <button
                          onClick={() => setSelectedNodeId(err.nodeId!)}
                          className="mt-1 text-[11px] font-mono text-[#0052ff] underline hover:text-blue-800"
                        >
                          Focus Node: {err.nodeId}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. SAVE ARCHITECTURE MODAL (Step 11) */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Save className="w-4 h-4 text-[#0052ff]" />
                <span>Save Architecture</span>
              </h3>
              <button
                onClick={() => setSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Architecture Name
              </label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. distributed-order-pipeline"
                className="w-full px-3 py-2 border border-slate-300 rounded text-xs font-mono focus:outline-none focus:border-[#0052ff]"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Will be persisted locally to .inkwell/architectures/{saveName}.json
              </p>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveArchitecture}
                className="px-4 py-1.5 rounded text-xs font-semibold text-white bg-[#0052ff] hover:bg-blue-700 shadow-sm"
              >
                Save Architecture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. COMPILER PREVIEW DRAWER / MODAL (Step 6) */}
      {showCompilerPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full h-[620px] flex flex-col p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileCode className="w-5 h-5 text-[#0052ff]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Deterministic Compiler Output Preview
                </h3>
              </div>
              <button
                onClick={() => setShowCompilerPreview(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Tabs */}
            <div className="flex space-x-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setPreviewTab('compose')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  previewTab === 'compose'
                    ? 'bg-blue-50 text-[#0052ff] font-bold border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                docker-compose.yml
              </button>
              <button
                onClick={() => setPreviewTab('services')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  previewTab === 'services'
                    ? 'bg-blue-50 text-[#0052ff] font-bold border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Compiled Services ({previewData?.services.length || 0})
              </button>
              <button
                onClick={() => setPreviewTab('ir')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  previewTab === 'ir'
                    ? 'bg-blue-50 text-[#0052ff] font-bold border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Graph IR (Canonical JSON)
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-auto bg-slate-900 text-slate-200 rounded-lg p-4 font-mono text-xs shadow-inner">
              {previewData ? (
                previewTab === 'compose' ? (
                  <pre>{previewData.composeYaml}</pre>
                ) : previewTab === 'services' ? (
                  <pre>{JSON.stringify(previewData.services, null, 2)}</pre>
                ) : (
                  <pre>{JSON.stringify(graph, null, 2)}</pre>
                )
              ) : (
                <div className="h-full flex items-center justify-center text-rose-400">
                  Cannot preview compiler output: Graph has validation errors. Fix errors in inspector first.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Deterministic hash reproducible byte-for-byte.</span>
              <button
                onClick={() => setShowCompilerPreview(false)}
                className="px-4 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. REAL CONTAINER LOGS MODAL (Step 8) */}
      {activeLogService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full h-[540px] flex flex-col p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-[#0052ff]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Real Docker Container Logs: {activeLogService}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">
                    docker compose logs --tail={logTail}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleOpenLogs(activeLogService)}
                  disabled={isLoadingLogs}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => setActiveLogService(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Log Terminal Screen */}
            <div className="flex-1 overflow-auto bg-slate-950 text-emerald-400 rounded-lg p-4 font-mono text-xs shadow-inner whitespace-pre-wrap">
              {isLoadingLogs ? 'Retrieving container output from Docker daemon...' : logContent}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>Bounded log stream. Sourced from real Docker engine.</span>
              <button
                onClick={() => setActiveLogService(null)}
                className="px-4 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
