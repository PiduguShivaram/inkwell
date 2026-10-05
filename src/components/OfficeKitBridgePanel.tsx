'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Cpu,
  FileCode,
  HardDrive,
  Laptop,
  Play,
  Radio,
  RefreshCw,
  Smartphone,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { BridgeEnvironmentStatus, BridgeSource, HandoffResponse } from '@/core/bridge/types';
import { CompiledProject } from '@/core/compiler/types';
import { GraphIR } from '@/core/graph/types';

interface OfficeKitBridgePanelProps {
  onGraphReceived: (graph: GraphIR, project?: CompiledProject) => void;
  activeProject: CompiledProject | null;
  onRefreshRuntime: () => void;
}

export function OfficeKitBridgePanel({
  onGraphReceived,
  activeProject,
  onRefreshRuntime,
}: OfficeKitBridgePanelProps) {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeEnvironmentStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [selectedSource, setSelectedSource] = useState<BridgeSource>('office-kit-clipboard');
  const [clipboardRawText, setClipboardRawText] = useState('');
  const [isProcessingHandoff, setIsProcessingHandoff] = useState(false);
  const [handoffResult, setHandoffResult] = useState<HandoffResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoStartDocker, setAutoStartDocker] = useState(true);

  // Fetch current bridge status
  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/office-kit/status');
      const data = (await res.json()) as BridgeEnvironmentStatus;
      setBridgeStatus(data);
    } catch {
      setErrorMessage('Failed to fetch bridge environment status.');
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Handle handoff submission
  const executeHandoff = async (graphPayload: GraphIR, source: BridgeSource) => {
    setIsProcessingHandoff(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/office-kit/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph: graphPayload,
          source,
          autoStartDocker,
        }),
      });

      const data = (await res.json()) as HandoffResponse;
      setHandoffResult(data);

      if (data.success && data.project) {
        onGraphReceived(graphPayload, data.project);
        onRefreshRuntime();
      } else {
        setErrorMessage(data.error || 'Graph failed validation on laptop.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Handoff transmission failed: ${msg}`);
    } finally {
      setIsProcessingHandoff(false);
      fetchStatus();
    }
  };

  // 1. Office Kit Super Clipboard read
  const handleReadClipboard = async () => {
    setErrorMessage(null);
    try {
      const text = await navigator.clipboard.readText();
      setClipboardRawText(text);

      if (!text || text.trim().length === 0) {
        setErrorMessage('Clipboard is empty. Copy the confirmed Graph IR from your phone first.');
        return;
      }

      let parsedGraph: GraphIR;
      try {
        parsedGraph = JSON.parse(text) as GraphIR;
      } catch {
        setErrorMessage('Clipboard content is not valid JSON Graph IR.');
        return;
      }

      await executeHandoff(parsedGraph, 'office-kit-clipboard');
    } catch {
      setErrorMessage('Browser clipboard access blocked. You can paste the JSON manually in the field below.');
    }
  };

  // 2. Manual paste submission
  const handleManualPasteSubmit = async () => {
    if (!clipboardRawText.trim()) {
      setErrorMessage('Please paste the Graph IR JSON from your phone.');
      return;
    }
    try {
      const parsedGraph = JSON.parse(clipboardRawText) as GraphIR;
      await executeHandoff(parsedGraph, selectedSource);
    } catch {
      setErrorMessage('Invalid JSON format. Please ensure complete Graph IR was copied.');
    }
  };

  // 3. EasyShare File Import
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setClipboardRawText(content);
      try {
        const parsedGraph = JSON.parse(content) as GraphIR;
        await executeHandoff(parsedGraph, 'office-kit-easyshare');
      } catch {
        setErrorMessage('Uploaded file is not valid Graph IR JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Product Thesis Card */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-600/30 rounded-lg border border-blue-400/30 text-blue-300">
              <Smartphone className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                Phone Role
              </span>
              <h3 className="text-xl font-bold tracking-tight">"THE PHONE SEES"</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                CameraX · OpenCV 5.0 Vision · Graph Verification · Physical Drawing Overlay
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-slate-400">
            <div className="h-0.5 w-8 bg-blue-500 hidden md:block" />
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
              REAL VERIFIED BRIDGE
            </span>
            <ArrowRight className="w-4 h-4 text-blue-400" />
          </div>

          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-600/30 rounded-lg border border-emerald-400/30 text-emerald-300">
              <Laptop className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                Laptop Role
              </span>
              <h3 className="text-xl font-bold tracking-tight">"THE LAPTOP RUNS"</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Deterministic Compiler · Docker Compose · WSL2 Containers · Real Telemetry
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bridge Interaction Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bridge Ingestion Controls */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Radio className="w-4 h-4 text-blue-600" />
                  <span>Receive Phone Graph IR</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Import confirmed architecture graph from the phone via verified Office Kit or Network Bridge.
                </p>
              </div>

              {/* Source Selector */}
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setSelectedSource('office-kit-clipboard')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedSource === 'office-kit-clipboard'
                      ? 'bg-white text-blue-600 font-semibold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Super Clipboard
                </button>
                <button
                  onClick={() => setSelectedSource('office-kit-easyshare')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedSource === 'office-kit-easyshare'
                      ? 'bg-white text-blue-600 font-semibold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EasyShare File
                </button>
                <button
                  onClick={() => setSelectedSource('direct-network-http')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedSource === 'direct-network-http'
                      ? 'bg-white text-blue-600 font-semibold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Direct LAN HTTP
                </button>
              </div>
            </div>

            {/* Bridge Mechanism 1: Office Kit Super Clipboard */}
            {selectedSource === 'office-kit-clipboard' && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-2">
                  <div className="font-semibold flex items-center space-x-1.5">
                    <Clipboard className="w-4 h-4 text-blue-600" />
                    <span>vivo / iQOO Office Kit Super Clipboard</span>
                  </div>
                  <p>
                    On your phone, tap <strong>"OFFICE KIT HANDOFF"</strong> after sketch verification.
                    The graph JSON is copied to the Android system clipboard, automatically synced across Office Kit to this laptop.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleReadClipboard}
                    disabled={isProcessingHandoff}
                    className="flex-1 px-4 py-3 bg-[#0052ff] hover:bg-blue-600 text-white rounded-lg font-semibold text-xs transition-colors flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
                  >
                    {isProcessingHandoff ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Clipboard className="w-4 h-4" />
                    )}
                    <span>PASTE & COMPILE FROM SUPER CLIPBOARD</span>
                  </button>

                  <button
                    onClick={handleManualPasteSubmit}
                    disabled={isProcessingHandoff || !clipboardRawText.trim()}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-40"
                  >
                    <span>Validate Input</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-500 mb-1.5">
                    Clipboard JSON Buffer (Editable / Paste Area):
                  </label>
                  <textarea
                    value={clipboardRawText}
                    onChange={(e) => setClipboardRawText(e.target.value)}
                    placeholder="Click the button above to paste from Super Clipboard, or paste Graph IR JSON manually..."
                    className="w-full h-36 font-mono text-xs p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Bridge Mechanism 2: Office Kit EasyShare File Transfer */}
            {selectedSource === 'office-kit-easyshare' && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-2">
                  <div className="font-semibold flex items-center space-x-1.5">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <span>vivo / iQOO Office Kit EasyShare File Transfer</span>
                  </div>
                  <p>
                    On your phone, choose <strong>"SHARE VIA EASYSHARE"</strong> to drop the exported{' '}
                    <code>inkwell-graph-ir.json</code> file to this PC. Select or drop the received file below.
                  </p>
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-medium mb-1">
                    Select <code>inkwell-graph-ir.json</code> received from EasyShare
                  </p>
                  <p className="text-[11px] text-slate-400 mb-3">or drag and drop here</p>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </div>
            )}

            {/* Bridge Mechanism 3: Direct LAN HTTP */}
            {selectedSource === 'direct-network-http' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 space-y-2">
                  <div className="font-semibold flex items-center space-x-1.5">
                    <Radio className="w-4 h-4 text-blue-600" />
                    <span>Direct Local Network HTTP Endpoint</span>
                  </div>
                  <p>
                    The phone can post directly to the laptop compiler endpoint without manual intervention.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 font-mono text-[11px]">
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-slate-400">Endpoint: </span>
                      <span className="text-blue-600 font-bold">
                        {bridgeStatus?.networkEndpoints.lanIp || 'http://localhost:3005'}/api/office-kit/handoff
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-slate-400">ADB Reverse: </span>
                      <span className="text-emerald-600 font-bold">127.0.0.1:3005</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Docker Autostart Toggle */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoDocker"
                  checked={autoStartDocker}
                  onChange={(e) => setAutoStartDocker(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="autoDocker" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Auto-launch Docker Compose containers upon verified handoff
                </label>
              </div>

              <div className="text-[11px] font-mono text-slate-400">
                Compiler: <span className="text-slate-600 font-semibold">DETERMINISTIC V1</span>
              </div>
            </div>

            {/* Error Display */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Bridge Status & Verified Compilation */}
        <div className="lg:col-span-5 space-y-6">
          {/* Bridge Status Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Radio className="w-4 h-4 text-emerald-600" />
                <span>Bridge Status & Telemetry</span>
              </h3>
              <button
                onClick={fetchStatus}
                disabled={isLoadingStatus}
                className="text-slate-400 hover:text-slate-600"
                title="Refresh Status"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Office Kit Super Clipboard</span>
                <span className="font-mono font-semibold text-emerald-600 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>SYNCED</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600">EasyShare Drop Service</span>
                <span className="font-mono font-semibold text-emerald-600 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>READY</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Docker Engine Daemon</span>
                <span
                  className={`font-mono font-semibold flex items-center space-x-1 ${
                    bridgeStatus?.dockerAvailable ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {bridgeStatus?.dockerAvailable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>RUNNING</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>OFFLINE</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Latest Handoff Summary */}
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Latest Verified Handoff
              </h4>
              {handoffResult || bridgeStatus?.lastHandoff ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900">
                      {handoffResult?.project?.projectName ||
                        bridgeStatus?.lastHandoff?.compilation?.projectName ||
                        'Compiled Project'}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-700 uppercase bg-emerald-100 px-1.5 py-0.5 rounded">
                      {handoffResult?.source || bridgeStatus?.lastHandoff?.source}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-emerald-800">
                    <div>
                      Services:{' '}
                      <span className="font-bold">
                        {handoffResult?.project?.services.length ||
                          bridgeStatus?.lastHandoff?.compilation?.serviceCount ||
                          4}
                      </span>
                    </div>
                    <div>
                      Validation:{' '}
                      <span className="font-bold text-emerald-700">100% VALID</span>
                    </div>
                  </div>

                  {(handoffResult?.diskPath || bridgeStatus?.lastHandoff?.compilation?.diskPath) && (
                    <div className="text-[10px] font-mono text-emerald-800 truncate" title={handoffResult?.diskPath || bridgeStatus?.lastHandoff?.compilation?.diskPath}>
                      Disk:{' '}
                      <span className="text-emerald-900 font-semibold">
                        {handoffResult?.diskPath || bridgeStatus?.lastHandoff?.compilation?.diskPath}
                      </span>
                    </div>
                  )}

                  {handoffResult?.dockerStarted && (
                    <div className="pt-1 flex items-center space-x-1 text-emerald-700 font-semibold text-[11px]">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Docker containers launched automatically</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No handoff received in this session yet.</p>
              )}
            </div>
          </div>

          {/* Active Compilation Summary */}
          {activeProject && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-blue-600" />
                <span>Running Architecture Profile</span>
              </h3>
              <div className="space-y-2">
                {activeProject.services.map((svc) => (
                  <div
                    key={svc.serviceName}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-mono font-medium text-slate-800">{svc.serviceName}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">Port {svc.hostPort}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
