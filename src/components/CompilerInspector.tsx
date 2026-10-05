'use client';

import React, { useState } from 'react';
import { Check, Copy, FileCode, FolderGit2, Play, Terminal } from 'lucide-react';
import { CompiledProject } from '@/core/compiler/types';

interface CompilerInspectorProps {
  project: CompiledProject | null;
  diskPath?: string;
  onCompile: () => void;
  isCompiling: boolean;
}

export function CompilerInspector({
  project,
  diskPath,
  onCompile,
  isCompiling,
}: CompilerInspectorProps) {
  const [selectedFilePath, setSelectedFilePath] = useState<string>('docker-compose.yml');
  const [copied, setCopied] = useState(false);

  if (!project) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-12 text-center shadow-sm">
        <Terminal className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-[#0f172a]">No Compiled Project Yet</h3>
        <p className="text-xs text-[#64748b] max-w-md mx-auto mt-1 mb-6">
          The deterministic compiler translates your architecture Graph IR into reproducible Docker
          Compose configurations and runnable microservice templates.
        </p>
        <button
          onClick={onCompile}
          disabled={isCompiling}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-md text-xs font-semibold text-white bg-[#0052ff] hover:bg-[#0045d8] disabled:opacity-50 transition-all shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isCompiling ? 'Compiling Architecture...' : 'Compile Architecture Now'}</span>
        </button>
      </div>
    );
  }

  // Gather all generated files
  const allFiles: { path: string; content: string; label: string }[] = [];

  for (const rootFile of project.rootFiles) {
    allFiles.push({
      path: rootFile.path,
      content: rootFile.content,
      label: rootFile.path,
    });
  }

  for (const service of project.services) {
    for (const sFile of service.files) {
      allFiles.push({
        path: `${service.dirName}/${sFile.path}`,
        content: sFile.content,
        label: `${service.serviceName}/${sFile.path}`,
      });
    }
  }

  const currentFile = allFiles.find((f) => f.path === selectedFilePath) || allFiles[0];

  const handleCopy = () => {
    if (!currentFile) return;
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Overview Banner */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FolderGit2 className="w-4 h-4 text-[#0052ff]" />
            <h3 className="text-sm font-bold text-[#0f172a]">Project: {project.projectName}</h3>
            <span className="text-[10px] font-mono bg-blue-50 text-[#0052ff] border border-blue-200 px-2 py-0.5 rounded font-semibold">
              Deterministic Output
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-1 font-mono">
            {diskPath ? `Exported to disk: ${diskPath}` : 'In-memory compilation verified'}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onCompile}
            disabled={isCompiling}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#cbd5e1] text-[#0f172a] hover:bg-slate-50 transition-colors"
          >
            <Play className="w-3 h-3 text-[#0052ff] fill-current" />
            <span>Recompile</span>
          </button>
        </div>
      </div>

      {/* Services Topology Breakdown Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-[#f1f5f9] bg-[#f8f9fa]">
          <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
            Compiled Service Manifest ({project.services.length} services)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9fa] text-[#64748b] border-b border-[#e2e8f0] font-mono">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Service Name</th>
                <th className="py-2.5 px-4 font-semibold">Type</th>
                <th className="py-2.5 px-4 font-semibold">Host Port</th>
                <th className="py-2.5 px-4 font-semibold">Internal Port</th>
                <th className="py-2.5 px-4 font-semibold">Health Probe URL</th>
                <th className="py-2.5 px-4 font-semibold">Dependencies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] font-mono">
              {project.services.map((svc) => (
                <tr key={svc.nodeId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-[#0f172a]">{svc.serviceName}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] uppercase font-bold">
                      {svc.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-[#0052ff] font-semibold">:{svc.hostPort}</td>
                  <td className="py-2.5 px-4 text-slate-500">:{svc.internalPort}</td>
                  <td className="py-2.5 px-4 text-slate-600 truncate max-w-xs">
                    {svc.healthProbeUrl || (
                      <span className="text-slate-400 italic">native wire protocol</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500">
                    {svc.dependsOn.length > 0 ? svc.dependsOn.join(', ') : 'none'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generated File Tree & Content Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* File List Sidebar */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-3 shadow-sm h-[480px] overflow-y-auto">
          <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider px-2 py-1 mb-2">
            Generated Files ({allFiles.length})
          </h4>
          <div className="space-y-1">
            {allFiles.map((f) => {
              const isSelected = selectedFilePath === f.path;
              return (
                <button
                  key={f.path}
                  onClick={() => setSelectedFilePath(f.path)}
                  className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-xs font-mono text-left transition-colors truncate ${
                    isSelected
                      ? 'bg-blue-50 text-[#0052ff] font-semibold border border-blue-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FileCode className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-[#0052ff]' : 'text-slate-400'}`} />
                  <span className="truncate">{f.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Code View Area */}
        <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm h-[480px] flex flex-col">
          <div className="px-4 py-2.5 border-b border-[#e2e8f0] bg-[#f8f9fa] flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-[#0f172a]">
              {currentFile?.path}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 text-xs text-[#64748b] hover:text-[#0f172a] px-2 py-1 rounded hover:bg-slate-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="flex-1 p-4 bg-[#fbfbfd] overflow-auto font-mono text-xs text-[#0f172a] leading-relaxed">
            <pre className="whitespace-pre">{currentFile?.content}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
