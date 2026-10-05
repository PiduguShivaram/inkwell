'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Info,
  Play,
  RefreshCw,
  Square,
  Terminal,
} from 'lucide-react';
import { ContainerState, DockerEnvironmentInfo, RuntimeExecutionResult } from '@/core/runtime/types';

interface RuntimePanelProps {
  dockerInfo: DockerEnvironmentInfo | null;
  containers: ContainerState[];
  onRefreshContainers: () => void;
  onRefreshDocker: () => void;
  projectName: string;
}

export function RuntimePanel({
  dockerInfo,
  containers,
  onRefreshContainers,
  onRefreshDocker,
  projectName,
}: RuntimePanelProps) {
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [lastExecutionResult, setLastExecutionResult] = useState<RuntimeExecutionResult | null>(null);

  const handleRuntimeAction = async (action: 'start' | 'stop' | 'restart') => {
    setIsRunningAction(true);
    setLastExecutionResult(null);

    try {
      const res = await fetch('/api/runtime/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, projectName }),
      });

      const data = (await res.json()) as RuntimeExecutionResult;
      setLastExecutionResult(data);
      // Automatically refresh container table
      onRefreshContainers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastExecutionResult({
        success: false,
        command: `docker compose ${action}`,
        stdout: '',
        stderr: msg,
        exitCode: 1,
        error: msg,
      });
    } finally {
      setIsRunningAction(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Docker Engine Environment Health Card */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center space-x-2.5">
            <Cpu className="w-5 h-5 text-[#0052ff]" />
            <h3 className="text-sm font-bold text-[#0f172a]">Docker Engine Status</h3>
          </div>
          <button
            onClick={onRefreshDocker}
            className="flex items-center space-x-1.5 text-xs text-[#64748b] hover:text-[#0f172a] px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Recheck Engine</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 bg-[#f8f9fa] rounded-lg border border-slate-200">
            <span className="text-[#64748b] block text-[11px] font-sans mb-0.5">CLI Client</span>
            <span className="font-semibold text-[#0f172a] truncate block">
              {dockerInfo?.clientVersion || 'Not found'}
            </span>
          </div>

          <div className="p-3 bg-[#f8f9fa] rounded-lg border border-slate-200">
            <span className="text-[#64748b] block text-[11px] font-sans mb-0.5">Daemon Engine</span>
            <span
              className={`font-semibold block ${
                dockerInfo?.isDaemonRunning ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {dockerInfo?.isDaemonRunning ? 'Active & Reachable' : 'Unreachable / Stopped'}
            </span>
          </div>

          <div className="p-3 bg-[#f8f9fa] rounded-lg border border-slate-200">
            <span className="text-[#64748b] block text-[11px] font-sans mb-0.5">Runtime Context</span>
            <span className="font-semibold text-[#0f172a] truncate block">
              {dockerInfo?.context || 'desktop-linux'}
            </span>
          </div>
        </div>

        {/* Informative Guidance banner if Docker daemon is not active */}
        {!dockerInfo?.isDaemonRunning && (
          <div className="mt-4 p-3.5 rounded-lg border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">Docker Daemon is not running</p>
              <p className="mt-0.5 text-amber-800">
                {dockerInfo?.guidance ||
                  'Please launch Docker Desktop on your workstation to start the local container engine. Inkwell detects real engine status and never fabricates container states.'}
              </p>
              {dockerInfo?.rawOutput && (
                <pre className="mt-2 p-2 bg-amber-100/60 rounded text-[11px] font-mono text-amber-900 overflow-x-auto">
                  {dockerInfo.rawOutput}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Runtime Actions & Control */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#f1f5f9]">
          <div>
            <h4 className="text-sm font-bold text-[#0f172a]">Container Orchestration</h4>
            <p className="text-xs text-[#64748b]">
              Target Project: <span className="font-mono text-[#0f172a] font-semibold">{projectName}</span>
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleRuntimeAction('start')}
              disabled={isRunningAction}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Containers</span>
            </button>

            <button
              onClick={() => handleRuntimeAction('restart')}
              disabled={isRunningAction}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restart</span>
            </button>

            <button
              onClick={() => handleRuntimeAction('stop')}
              disabled={isRunningAction}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Containers</span>
            </button>
          </div>
        </div>

        {/* Execution Output Console (Real CLI stdout/stderr) */}
        {lastExecutionResult && (
          <div className="mt-4 border border-[#e2e8f0] rounded-lg overflow-hidden font-mono text-xs">
            <div
              className={`px-3 py-2 flex items-center justify-between ${
                lastExecutionResult.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}
            >
              <div className="flex items-center space-x-2">
                {lastExecutionResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span className="font-bold">
                  $ {lastExecutionResult.command} (exit code: {lastExecutionResult.exitCode})
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#0f172a] text-slate-100 max-h-48 overflow-y-auto leading-relaxed">
              {lastExecutionResult.stdout && (
                <pre className="text-emerald-400 whitespace-pre-wrap">{lastExecutionResult.stdout}</pre>
              )}
              {lastExecutionResult.stderr && (
                <pre className="text-rose-400 whitespace-pre-wrap mt-1">{lastExecutionResult.stderr}</pre>
              )}
              {!lastExecutionResult.stdout && !lastExecutionResult.stderr && (
                <span className="text-slate-400 italic">No console output returned.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Real Container States Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-[#f1f5f9] bg-[#f8f9fa] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-[#0052ff]" />
            <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
              Discovered Containers ({containers.length})
            </h4>
          </div>
          <button
            onClick={onRefreshContainers}
            className="flex items-center space-x-1 text-xs text-[#64748b] hover:text-[#0f172a]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        {containers.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748b]">
            <p>No active containers discovered for this project.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Containers will appear here after launching with &quot;Start Containers&quot; when Docker is running.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto font-mono text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#f8f9fa] text-[#64748b] border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Container ID</th>
                  <th className="py-2.5 px-4 font-semibold">Service</th>
                  <th className="py-2.5 px-4 font-semibold">State</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Ports</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {containers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-[#0f172a] truncate max-w-[120px]">
                      {c.id.substring(0, 12)}
                    </td>
                    <td className="py-2.5 px-4">{c.service || c.name}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          c.state === 'running'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{c.status}</td>
                    <td className="py-2.5 px-4 text-slate-500">{c.ports || 'none'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
