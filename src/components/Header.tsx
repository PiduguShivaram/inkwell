'use client';

import React from 'react';
import { Box, CheckCircle2, Cpu, Eye, Layers, Radio, RefreshCw, Terminal, XCircle } from 'lucide-react';
import { DockerEnvironmentInfo } from '@/core/runtime/types';
import { VisionModelInfo } from '@/core/vision/types';

interface HeaderProps {
  dockerInfo: DockerEnvironmentInfo | null;
  visionInfo: VisionModelInfo | null;
  onRefreshDocker: () => void;
  onLoadCanonical: () => void;
  onResetCanvas: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isValid: boolean;
  errorCount: number;
}

export function Header({
  dockerInfo,
  visionInfo,
  onRefreshDocker,
  onLoadCanonical,
  onResetCanvas,
  activeTab,
  setActiveTab,
  isValid,
  errorCount,
}: HeaderProps) {
  return (
    <header className="border-b border-[#e2e8f0] bg-white sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Product Title */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#0052ff] flex items-center justify-center text-white font-bold text-lg shadow-sm">
              I
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-[#0f172a] tracking-tight">INKWELL</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-50 text-[#0052ff] font-semibold border border-blue-200">
                  Phase 1 Engine
                </span>
              </div>
              <p className="text-xs text-[#64748b]">Deterministic Architecture Compiler & Orchestrator</p>
            </div>
          </div>

          {/* Genuine Runtime Status Badges */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Docker Status */}
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-mono border ${
                dockerInfo?.isDaemonRunning
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : dockerInfo?.isInstalled
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
              title={dockerInfo?.rawOutput || dockerInfo?.guidance || ''}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>
                {dockerInfo?.isDaemonRunning
                  ? 'Docker Engine: Running'
                  : dockerInfo?.isInstalled
                  ? 'Docker CLI: Ready (Daemon Stopped)'
                  : 'Docker: Not Installed'}
              </span>
              <button
                onClick={onRefreshDocker}
                className="hover:rotate-180 transition-transform duration-300 ml-1 text-slate-500 hover:text-slate-800"
                title="Refresh Docker Status"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Vision Model Status */}
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-mono border ${
                visionInfo?.isAvailable
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
              title={visionInfo?.statusDescription || ''}
            >
              <Eye className="w-3.5 h-3.5 text-[#0052ff]" />
              <span>
                {visionInfo?.isAvailable ? 'Vision Model: Active' : 'Vision: Architecture Ready'}
              </span>
            </div>

            {/* Graph Validation Badge */}
            <div
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${
                isValid
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {isValid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Graph Valid</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>{errorCount} Graph {errorCount === 1 ? 'Error' : 'Errors'}</span>
                </>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onLoadCanonical}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-[#e2e8f0] text-[#0f172a] hover:bg-slate-50 transition-colors flex items-center space-x-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-[#0052ff]" />
              <span>Load Canonical Slice</span>
            </button>
            <button
              onClick={onResetCanvas}
              className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 -mb-px overflow-x-auto border-t border-[#f1f5f9] pt-2">
          {[
            { id: 'workspace', label: 'Architecture Workspace', icon: Box },
            { id: 'bridge', label: 'Office Kit & Bridge', icon: Radio },
            { id: 'compiler', label: 'Compiler & Output', icon: Terminal },
            { id: 'runtime', label: 'Docker Runtime', icon: Cpu },
            { id: 'telemetry', label: 'Health & Telemetry', icon: RefreshCw },
            { id: 'vision', label: 'Sketch & Camera Input', icon: Eye },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[#0052ff] text-[#0052ff] font-semibold'
                    : 'border-transparent text-[#64748b] hover:text-[#0f172a] hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-[#0052ff]' : 'text-[#94a3b8]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
