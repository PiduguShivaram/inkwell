'use client';

import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Code2,
  HelpCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { CompiledServiceSpec } from '@/core/compiler/types';
import { ServiceTelemetry, TelemetryReport } from '@/core/telemetry/types';

interface HealthTelemetryPanelProps {
  telemetryReport: TelemetryReport | null;
  services: CompiledServiceSpec[];
  onProbeNow: () => void;
  isProbing: boolean;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
}

export function HealthTelemetryPanel({
  telemetryReport,
  services,
  onProbeNow,
  isProbing,
  autoRefresh,
  setAutoRefresh,
}: HealthTelemetryPanelProps) {
  const [selectedTelemetry, setSelectedTelemetry] = useState<ServiceTelemetry | null>(null);

  const healthyCount =
    telemetryReport?.services.filter((s) => s.healthStatus === 'healthy').length || 0;
  const totalCount = telemetryReport?.services.length || services.length;

  // Real average latency calculation across successful probes
  const measuredLatencies =
    telemetryReport?.services
      .map((s) => s.latencyMs)
      .filter((lat): lat is number => typeof lat === 'number' && lat > 0) || [];

  const avgLatency =
    measuredLatencies.length > 0
      ? (measuredLatencies.reduce((a, b) => a + b, 0) / measuredLatencies.length).toFixed(2)
      : 'N/A';

  return (
    <div className="space-y-4">
      {/* Telemetry Header & Actions */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#f1f5f9]">
          <div>
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-[#0052ff]" />
              <h3 className="text-sm font-bold text-[#0f172a]">Live Runtime Health & Telemetry</h3>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              Real high-precision HTTP health probes and latency telemetry. No synthetic metrics.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-xs text-[#64748b] cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 text-[#0052ff] focus:ring-blue-100"
              />
              <span>Auto-poll (5s)</span>
            </label>

            <button
              onClick={onProbeNow}
              disabled={isProbing}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-[#0052ff] hover:bg-[#0045d8] disabled:opacity-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
              <span>{isProbing ? 'Probing Endpoints...' : 'Probe Endpoints Now'}</span>
            </button>
          </div>
        </div>

        {/* Real Summary Metrics Cards */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 bg-[#f8f9fa] rounded-lg border border-slate-200">
            <span className="text-[#64748b] font-sans block text-[11px] mb-0.5">Registered Services</span>
            <span className="text-base font-bold text-[#0f172a]">{totalCount}</span>
          </div>

          <div className="p-3 bg-[#f8f9fa] rounded-lg border border-slate-200">
            <span className="text-[#64748b] font-sans block text-[11px] mb-0.5">Healthy Endpoints</span>
            <span
              className={`text-base font-bold ${
                healthyCount === totalCount && totalCount > 0
                  ? 'text-emerald-700'
                  : healthyCount > 0
                  ? 'text-amber-700'
                  : 'text-slate-600'
              }`}
            >
              {healthyCount} / {totalCount}
            </span>
          </div>

          <div className="p-3 bg-[#f8f9fa] rounded-lg border border-slate-200">
            <span className="text-[#64748b] font-sans block text-[11px] mb-0.5">Avg Measured Latency</span>
            <span className="text-base font-bold text-[#0052ff]">
              {avgLatency !== 'N/A' ? `${avgLatency} ms` : '—'}
            </span>
          </div>

          <div className="p-3 bg-[#f8f9fa] rounded-lg border border-slate-200">
            <span className="text-[#64748b] font-sans block text-[11px] mb-0.5">Last Probe</span>
            <span className="text-xs font-medium text-slate-700 block truncate">
              {telemetryReport?.timestamp
                ? new Date(telemetryReport.timestamp).toLocaleTimeString()
                : 'Never probed'}
            </span>
          </div>
        </div>
      </div>

      {/* Services Telemetry Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-[#f1f5f9] bg-[#f8f9fa]">
          <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
            Live Service Telemetry Table
          </h4>
        </div>

        {(!telemetryReport || telemetryReport.services.length === 0) && (
          <div className="p-8 text-center text-xs text-[#64748b]">
            <p>No telemetry recorded yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Click &quot;Probe Endpoints Now&quot; above to run real network health checks against all compiled services.
            </p>
          </div>
        )}

        {telemetryReport && telemetryReport.services.length > 0 && (
          <div className="overflow-x-auto font-mono text-xs">
            <table className="w-full text-left">
              <thead className="bg-[#f8f9fa] text-[#64748b] border-b border-[#e2e8f0]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Service Name</th>
                  <th className="py-2.5 px-4 font-semibold">Type</th>
                  <th className="py-2.5 px-4 font-semibold">Health Status</th>
                  <th className="py-2.5 px-4 font-semibold">HTTP Code</th>
                  <th className="py-2.5 px-4 font-semibold">Measured Latency</th>
                  <th className="py-2.5 px-4 font-semibold">Container State</th>
                  <th className="py-2.5 px-4 font-semibold">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {telemetryReport.services.map((svc) => {
                  const isHealthy = svc.healthStatus === 'healthy';
                  const isUnreachable = svc.healthStatus === 'unreachable';

                  return (
                    <tr key={svc.nodeId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-[#0f172a]">{svc.serviceName}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] uppercase font-bold">
                          {svc.serviceType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            isHealthy
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isUnreachable
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isHealthy ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : isUnreachable ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <HelpCircle className="w-3 h-3" />
                          )}
                          <span>{svc.healthStatus}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {svc.httpStatus ? (
                          <span className="text-slate-700 font-bold">{svc.httpStatus} OK</span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        {typeof svc.latencyMs === 'number' ? (
                          <span className="text-[#0052ff] font-semibold flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{svc.latencyMs.toFixed(2)} ms</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {svc.containerStatusText || svc.containerState}
                      </td>
                      <td className="py-2.5 px-4">
                        {svc.payload ? (
                          <button
                            onClick={() => setSelectedTelemetry(svc)}
                            className="text-[#0052ff] hover:underline flex items-center space-x-1 text-[11px]"
                          >
                            <Code2 className="w-3.5 h-3.5" />
                            <span>View JSON</span>
                          </button>
                        ) : svc.error ? (
                          <span className="text-rose-500 truncate max-w-xs block" title={svc.error}>
                            {svc.error}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No payload</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Payload Modal/Drawer */}
      {selectedTelemetry && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-[#0052ff]" />
                <h4 className="text-sm font-bold text-[#0f172a]">
                  Payload: {selectedTelemetry.serviceName}
                </h4>
              </div>
              <button
                onClick={() => setSelectedTelemetry(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 p-3 bg-slate-900 rounded text-slate-100 font-mono text-xs max-h-80 overflow-y-auto">
              <pre>{JSON.stringify(selectedTelemetry.payload, null, 2)}</pre>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedTelemetry(null)}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
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
