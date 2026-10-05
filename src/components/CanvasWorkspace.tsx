'use client';

import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Database,
  Layers,
  Link2,
  Play,
  Plus,
  Server,
  Trash2,
  Workflow,
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
import { GraphEdge, GraphIR, GraphNode, NodeType } from '@/core/graph/types';

interface CanvasWorkspaceProps {
  graph: GraphIR;
  setGraph: React.Dispatch<React.SetStateAction<GraphIR>>;
  onCompile: () => void;
  isCompiling: boolean;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

export function CanvasWorkspace({
  graph,
  setGraph,
  onCompile,
  isCompiling,
  selectedNodeId,
  setSelectedNodeId,
}: CanvasWorkspaceProps) {
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Add new node of specified type
  const handleAddNode = (type: NodeType) => {
    const existingOfSameType = graph.nodes.filter((n) => n.type === type).length;
    const defaultLabels: Record<NodeType, string> = {
      service: `API Service ${existingOfSameType + 1}`,
      queue: `Queue ${existingOfSameType + 1}`,
      worker: `Worker ${existingOfSameType + 1}`,
      database: `Database ${existingOfSameType + 1}`,
    };

    // Stagger positions
    const offset = (graph.nodes.length * 40) % 240;
    const newNode = createNode({
      type,
      label: defaultLabels[type],
      position: { x: 100 + offset, y: 120 + offset },
    });

    setGraph((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    setSelectedNodeId(newNode.id);
  };

  // Dragging support
  const handleMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    if (connectingSourceId) {
      handleCompleteConnection(node.id);
      return;
    }

    setSelectedNodeId(node.id);
    setDraggingNodeId(node.id);
    const pos = node.position || { x: 100, y: 100 };
    setDragOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = Math.max(20, Math.min(rect.width - 220, e.clientX - dragOffset.x));
    const newY = Math.max(20, Math.min(rect.height - 120, e.clientY - dragOffset.y));

    setGraph((prev) => updateNodeInGraph(prev, draggingNodeId, { position: { x: newX, y: newY } }));
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Connection flow
  const handleStartConnection = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnectingSourceId(nodeId);
  };

  const handleCompleteConnection = (targetId: string) => {
    if (!connectingSourceId || connectingSourceId === targetId) {
      setConnectingSourceId(null);
      return;
    }

    const newEdge = createEdge(connectingSourceId, targetId);
    setGraph((prev) => addEdgeToGraph(prev, newEdge));
    setConnectingSourceId(null);
  };

  const handleRemoveEdge = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGraph((prev) => removeEdgeFromGraph(prev, edgeId));
  };

  const handleRemoveNode = (nodeId: string) => {
    setGraph((prev) => removeNodeFromGraph(prev, nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  const handleUpdateLabel = (nodeId: string, newLabel: string) => {
    setGraph((prev) => updateNodeInGraph(prev, nodeId, { label: newLabel }));
  };

  const handleUpdatePort = (nodeId: string, hostPort: number) => {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setGraph((prev) =>
      updateNodeInGraph(prev, nodeId, {
        ports: { ...(node.ports || {}), hostPort },
      })
    );
  };

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);

  // Helper for node type styling
  const getNodeTypeConfig = (type: NodeType) => {
    switch (type) {
      case 'service':
        return {
          icon: Server,
          border: 'border-blue-300 hover:border-blue-500',
          selectedBorder: 'border-[#0052ff] ring-2 ring-blue-100',
          badge: 'bg-blue-50 text-[#0052ff] border-blue-200',
          indicator: 'bg-[#0052ff]',
        };
      case 'queue':
        return {
          icon: Layers,
          border: 'border-purple-300 hover:border-purple-500',
          selectedBorder: 'border-purple-600 ring-2 ring-purple-100',
          badge: 'bg-purple-50 text-purple-700 border-purple-200',
          indicator: 'bg-purple-600',
        };
      case 'worker':
        return {
          icon: Zap,
          border: 'border-amber-300 hover:border-amber-500',
          selectedBorder: 'border-amber-500 ring-2 ring-amber-100',
          badge: 'bg-amber-50 text-amber-800 border-amber-200',
          indicator: 'bg-amber-500',
        };
      case 'database':
        return {
          icon: Database,
          border: 'border-emerald-300 hover:border-emerald-500',
          selectedBorder: 'border-emerald-600 ring-2 ring-emerald-100',
          badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          indicator: 'bg-emerald-600',
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Canvas Controls */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Node creation buttons */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-[#64748b] mr-1">Add Node:</span>
          <button
            onClick={() => handleAddNode('service')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-50 text-[#0052ff] hover:bg-blue-100 transition-colors border border-blue-200"
          >
            <Server className="w-3.5 h-3.5" />
            <span>+ Service</span>
          </button>

          <button
            onClick={() => handleAddNode('queue')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors border border-purple-200"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>+ Queue</span>
          </button>

          <button
            onClick={() => handleAddNode('worker')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors border border-amber-200"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>+ Worker</span>
          </button>

          <button
            onClick={() => handleAddNode('database')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors border border-emerald-200"
          >
            <Database className="w-3.5 h-3.5" />
            <span>+ Database</span>
          </button>
        </div>

        {/* Primary Compile Action */}
        <div className="flex items-center space-x-3">
          {connectingSourceId && (
            <div className="flex items-center space-x-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 animate-pulse">
              <Link2 className="w-3.5 h-3.5" />
              <span>Select target node to complete connection...</span>
              <button
                onClick={() => setConnectingSourceId(null)}
                className="ml-2 font-bold underline hover:text-amber-900"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            onClick={onCompile}
            disabled={isCompiling}
            className="flex items-center space-x-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-[#0052ff] hover:bg-[#0045d8] disabled:opacity-50 transition-all shadow-sm active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isCompiling ? 'Compiling Architecture...' : 'Compile Architecture'}</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={() => {
            setSelectedNodeId(null);
            setConnectingSourceId(null);
          }}
          className="lg:col-span-3 h-[560px] relative border border-[#e2e8f0] rounded-xl canvas-grid overflow-hidden bg-white select-none shadow-inner"
        >
          {/* SVG Connection Lines Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <marker
                id="arrowhead"
                viewBox="0 0 10 10"
                refX="22"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#0052ff" />
              </marker>
            </defs>

            {graph.edges.map((edge) => {
              const sourceNode = graph.nodes.find((n) => n.id === edge.source);
              const targetNode = graph.nodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const sx = (sourceNode.position?.x || 100) + 100;
              const sy = (sourceNode.position?.y || 100) + 40;
              const tx = (targetNode.position?.x || 100) + 100;
              const ty = (targetNode.position?.y || 100) + 40;

              // Curved bezier path
              const dx = tx - sx;
              const dy = ty - sy;
              const cx1 = sx + dx * 0.5;
              const cy1 = sy;
              const cx2 = sx + dx * 0.5;
              const cy2 = ty;
              const pathData = `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`;

              return (
                <g key={edge.id}>
                  <path
                    d={pathData}
                    stroke="#94a3b8"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              );
            })}
          </svg>

          {/* Interactive Edge midpoint delete buttons */}
          {graph.edges.map((edge) => {
            const sourceNode = graph.nodes.find((n) => n.id === edge.source);
            const targetNode = graph.nodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const sx = (sourceNode.position?.x || 100) + 100;
            const sy = (sourceNode.position?.y || 100) + 40;
            const tx = (targetNode.position?.x || 100) + 100;
            const ty = (targetNode.position?.y || 100) + 40;
            const midX = (sx + tx) / 2;
            const midY = (sy + ty) / 2;

            return (
              <div
                key={`btn-${edge.id}`}
                style={{ left: `${midX - 12}px`, top: `${midY - 12}px` }}
                className="absolute z-20 group"
              >
                <button
                  onClick={(e) => handleRemoveEdge(edge.id, e)}
                  title={`Delete connection (${edge.source} -> ${edge.target})`}
                  className="w-6 h-6 rounded-full bg-white border border-[#cbd5e1] hover:border-rose-400 hover:bg-rose-50 text-[#64748b] hover:text-rose-600 flex items-center justify-center text-[10px] font-bold shadow-sm transition-all"
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Render Graph Nodes */}
          {graph.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isConnectingSource = connectingSourceId === node.id;
            const style = getNodeTypeConfig(node.type);
            const Icon = style.icon;
            const pos = node.position || { x: 100, y: 100 };

            return (
              <div
                key={node.id}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                }}
                onMouseDown={(e) => handleMouseDown(e, node)}
                className={`absolute w-48 rounded-lg bg-white p-3 shadow-sm border transition-shadow cursor-grab active:cursor-grabbing z-20 ${
                  isSelected ? style.selectedBorder : style.border
                } ${isConnectingSource ? 'ring-2 ring-amber-400 bg-amber-50/20' : ''}`}
              >
                {/* Node Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2 h-2 rounded-full ${style.indicator}`} />
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${style.badge}`}>
                      {node.type}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => handleStartConnection(node.id, e)}
                      title="Connect this node to another"
                      className="p-1 rounded hover:bg-slate-100 text-[#64748b] hover:text-[#0052ff]"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveNode(node.id);
                      }}
                      title="Delete Node"
                      className="p-1 rounded hover:bg-rose-50 text-[#64748b] hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Node Label */}
                <div className="font-semibold text-xs text-[#0f172a] truncate">
                  {node.label}
                </div>

                {/* Node ID & Port */}
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-[#64748b]">
                  <span className="truncate max-w-[90px]">{node.id}</span>
                  {node.ports?.hostPort && (
                    <span className="bg-slate-100 px-1 py-0.2 rounded text-[10px]">
                      :{node.ports.hostPort}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty Canvas Guidance */}
          {graph.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
              <Workflow className="w-12 h-12 mb-2 stroke-[1.2]" />
              <p className="text-sm font-medium">Architecture canvas is empty</p>
              <p className="text-xs text-slate-400 mt-1">
                Add nodes from the toolbar above or click &quot;Load Canonical Slice&quot; to begin.
              </p>
            </div>
          )}
        </div>

        {/* Selected Node Inspector Panel */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm h-[560px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-[#0f172a] pb-2 border-b border-[#f1f5f9] flex items-center justify-between">
            <span>Node Inspector</span>
            {selectedNode && (
              <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                {selectedNode.type}
              </span>
            )}
          </h3>

          {selectedNode ? (
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#64748b] mb-1">
                  Node Identifier (id)
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedNode.id}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded font-mono text-slate-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#64748b] mb-1">
                  Display Label
                </label>
                <input
                  type="text"
                  value={selectedNode.label}
                  onChange={(e) => handleUpdateLabel(selectedNode.id, e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-[#0f172a] text-xs focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#64748b] mb-1">
                  Host Port Override
                </label>
                <input
                  type="number"
                  placeholder="Auto-assigned"
                  value={selectedNode.ports?.hostPort || ''}
                  onChange={(e) => handleUpdatePort(selectedNode.id, parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded text-[#0f172a] text-xs font-mono focus:outline-none focus:border-[#0052ff] focus:ring-1 focus:ring-blue-100"
                />
                <p className="text-[10px] text-[#94a3b8] mt-1">
                  Leave blank for deterministic port allocation.
                </p>
              </div>

              <div className="pt-2 border-t border-[#f1f5f9]">
                <h4 className="font-medium text-[#64748b] mb-2">Connected Outbound Edges</h4>
                <div className="space-y-1.5">
                  {graph.edges
                    .filter((e) => e.source === selectedNode.id)
                    .map((edge) => (
                      <div
                        key={edge.id}
                        className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-center space-x-1.5 truncate">
                          <ArrowRight className="w-3 h-3 text-[#0052ff]" />
                          <span className="font-mono text-slate-700 truncate">{edge.target}</span>
                        </div>
                        <button
                          onClick={(e) => handleRemoveEdge(edge.id, e)}
                          className="text-slate-400 hover:text-rose-600 text-xs px-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  {graph.edges.filter((e) => e.source === selectedNode.id).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">No outbound edges.</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-[#f1f5f9]">
                <button
                  onClick={() => handleRemoveNode(selectedNode.id)}
                  className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Node</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="h-4/5 flex flex-col items-center justify-center text-center text-slate-400 text-xs px-4">
              <Server className="w-8 h-8 mb-2 stroke-[1.2] text-slate-300" />
              <p>Select any node on the canvas to inspect its configuration and connections.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
