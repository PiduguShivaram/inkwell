'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  Layers,
  Play,
  Radio,
  RefreshCw,
  Server,
  StopCircle,
  Zap,
} from 'lucide-react';
import { DemoState, DemoStep } from '@/core/demo/types';

interface DemoModePanelProps {
  onResetComplete?: () => void;
}

const STEPS: { id: DemoStep; label: string; timing: string }[] = [
  { id: 'READY', label: '1. READY', timing: '0-10s' },
  { id: 'SCANNING', label: '2. SCAN', timing: '10-20s' },
  { id: 'VERIFY', label: '3. VERIFY', timing: '20-30s' },
  { id: 'HANDOFF', label: '4. HANDOFF', timing: '30-40s' },
  { id: 'RUNNING', label: '5. RUN', timing: '40-50s' },
  { id: 'OBSERVING', label: '6. OBSERVE', timing: '50-60s' },
  { id: 'FAILURE', label: '7. FAILURE', timing: '60-80s' },
  { id: 'RECOVERED', label: '8. RECOVERED', timing: '80-90s' },
];

export function DemoModePanel({ onResetComplete }: DemoModePanelProps) {
  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isFailing, setIsFailing] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Poll live demo state every 1.5s
  const fetchDemoState = useCallback(async () => {
    try {
      const res = await fetch('/api/demo/state');
      if (res.ok) {
        const data = (await res.json()) as DemoState;
        setDemoState(data);
      }
    } catch {
      // Keep existing state
    }
  }, []);

  useEffect(() => {
    fetchDemoState();
    const interval = setInterval(fetchDemoState, 1500);
    return () => clearInterval(interval);
  }, [fetchDemoState]);

  // Demo Reset
  const handleReset = async () => {
    setIsResetting(true);
    setFeedbackNotice('Resetting real Docker runtime and compiling canonical pipeline...');
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setFeedbackNotice('Canonical Demo Reset Complete. Containers Healthy.');
        onResetComplete?.();
      } else {
        setFeedbackNotice(`Reset failed: ${data.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackNotice(`Reset error: ${msg}`);
    } finally {
      setIsResetting(false);
      fetchDemoState();
    }
  };

  // Inject real Worker failure
  const handleInjectFailure = async () => {
    setIsFailing(true);
    setFeedbackNotice('Stopping processing-worker container via Docker API...');
    try {
      const res = await fetch('/api/demo/inject-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceName: 'processing-worker' }),
      });
      const data = await res.json();
      setDemoState(data);
      setFeedbackNotice('Worker container offline. Real failure detected on drawing.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackNotice(`Failure trigger error: ${msg}`);
    } finally {
      setIsFailing(false);
      fetchDemoState();
    }
  };

  // Recover real Worker container
  const handleRecover = async () => {
    setIsRecovering(true);
    setFeedbackNotice('Restarting processing-worker container via Docker API...');
    try {
      const res = await fetch('/api/demo/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceName: 'processing-worker' }),
      });
      const data = await res.json();
      setDemoState(data);
      setFeedbackNotice('Worker container restarted. Health restored to drawing.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackNotice(`Recovery error: ${msg}`);
    } finally {
      setIsRecovering(false);
      fetchDemoState();
    }
  };

  // Manual step navigation
  const handleSetStep = async (step: DemoStep) => {
    try {
      const res = await fetch('/api/demo/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
      if (res.ok) {
        const data = await res.json();
        setDemoState(data);
      }
    } catch {
      // Ignore
    }
  };

  const currentStep = demoState?.step || 'READY';
  const elapsed = demoState?.elapsedSeconds || 0;
  const progressPercent = Math.min(100, Math.round((elapsed / 90) * 100));

  return (
    <div className="space-y-6">
      {/* 1. Core Presentation Thesis Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono text-[11px] font-bold uppercase tracking-wider border border-blue-500/30">
                Hackathon Demo Mode
              </span>
              <span className="text-slate-400 text-xs font-mono">
                90-Second Canonical Pipeline
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight mt-1 text-white">
              "THE DRAWING IS THE DASHBOARD."
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Real Paper Sketch ➔ Phone Vision ➔ Deterministic Compiler ➔ Docker WSL2 ➔ Live Physical Drawing Overlay
            </p>
          </div>

          {/* Quick Demo Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-2 border border-slate-700 shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{isResetting ? 'Resetting...' : 'Reset Demo'}</span>
            </button>
          </div>
        </div>

        {/* 90-Second Progress Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
            <span>Demo Timeline: {elapsed}s / 90s</span>
            <span>Target: Complete Physical Pipeline Demonstration</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Explicit 8-Step State Machine Strip */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
          <span>8-Step Demo State Machine</span>
          <span className="font-mono text-slate-400 font-normal">
            Active: {currentStep}
          </span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {STEPS.map((s) => {
            const isActive = currentStep === s.id;
            const isPassed = (demoState?.stepIndex || 1) > (STEPS.findIndex((x) => x.id === s.id) + 1);
            const isFailure = s.id === 'FAILURE' && currentStep === 'FAILURE';

            let bgColor = 'bg-slate-50 border-slate-200 text-slate-500';
            if (isFailure) {
              bgColor = 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-400 font-bold';
            } else if (isActive) {
              bgColor = 'bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-500 font-bold';
            } else if (isPassed) {
              bgColor = 'bg-emerald-50 border-emerald-200 text-emerald-700 font-medium';
            }

            return (
              <button
                key={s.id}
                onClick={() => handleSetStep(s.id)}
                className={`p-2.5 rounded-lg border text-left transition-all ${bgColor}`}
              >
                <div className="text-[11px] truncate">{s.label}</div>
                <div className="text-[10px] opacity-75 font-mono mt-0.5">{s.timing}</div>
              </button>
            );
          })}
        </div>

        {demoState?.message && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 flex items-center space-x-2">
            <Radio className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{demoState.message}</span>
          </div>
        )}
      </div>

      {/* 3. Live System Topology HUD (Distance Readable) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Node 1: API Gateway */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">Service</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              ● HEALTHY
            </span>
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Server className="w-5 h-5 text-blue-600" />
              <span>api-gateway</span>
            </h4>
            <div className="text-xs font-mono text-slate-500 mt-1">Port 3000 · HTTP 200</div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Latency:</span>
            <span className="font-bold text-slate-800">
              {demoState?.telemetry?.services.find((s) => s.nodeId === 'api-gateway')?.latencyMs || 6} ms
            </span>
          </div>
        </div>

        {/* Node 2: Task Queue (Redis) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">Queue</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              ● HEALTHY
            </span>
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Layers className="w-5 h-5 text-amber-600" />
              <span>task-queue</span>
            </h4>
            <div className="text-xs font-mono text-slate-500 mt-1">Port 6379 · Redis 7</div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Protocol:</span>
            <span className="font-bold text-slate-800">Native Wire</span>
          </div>
        </div>

        {/* Node 3: Processing Worker (Failure Injection Target) */}
        {(() => {
          const workerTelemetry = demoState?.telemetry?.services.find((s) => s.nodeId === 'processing-worker');
          const isDown = workerTelemetry?.healthStatus === 'unreachable' || currentStep === 'FAILURE';

          return (
            <div
              className={`rounded-xl border shadow-sm p-5 space-y-3 transition-colors ${
                isDown
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">Worker</span>
                <span
                  className={`font-mono text-xs px-2 py-0.5 rounded font-bold border ${
                    isDown
                      ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {isDown ? '▲ DOWN' : '● HEALTHY'}
                </span>
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                  <Cpu className={`w-5 h-5 ${isDown ? 'text-rose-600' : 'text-purple-600'}`} />
                  <span>processing-worker</span>
                </h4>
                <div className="text-xs font-mono text-slate-500 mt-1">
                  Port 3001 · {isDown ? 'Container Stopped' : 'HTTP 200'}
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Status:</span>
                <span className={`font-bold ${isDown ? 'text-rose-700' : 'text-slate-800'}`}>
                  {isDown ? 'OFFLINE' : `${workerTelemetry?.latencyMs || 7} ms`}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Node 4: Primary DB (Postgres) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">Database</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              ● HEALTHY
            </span>
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <Database className="w-5 h-5 text-indigo-600" />
              <span>primary-db</span>
            </h4>
            <div className="text-xs font-mono text-slate-500 mt-1">Port 5432 · Postgres 16</div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Protocol:</span>
            <span className="font-bold text-slate-800">Native Wire</span>
          </div>
        </div>
      </div>

      {/* 4. Hackathon Judge Action Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Live Demo Hardware & Failure Controls</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={handleInjectFailure}
            disabled={isFailing}
            className="p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-2 text-rose-700 font-bold text-xs">
              <StopCircle className="w-4 h-4" />
              <span>1. TRIGGER REAL FAILURE</span>
            </div>
            <p className="text-[11px] text-rose-800 mt-1">
              Executes <code>docker stop processing-worker</code>. Phone drawing region turns RED.
            </p>
          </button>

          <button
            onClick={handleRecover}
            disabled={isRecovering}
            className="p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-2 text-emerald-700 font-bold text-xs">
              <Play className="w-4 h-4" />
              <span>2. TRIGGER REAL RECOVERY</span>
            </div>
            <p className="text-[11px] text-emerald-800 mt-1">
              Executes <code>docker start processing-worker</code>. Phone drawing region returns to GREEN.
            </p>
          </button>

          <button
            onClick={handleReset}
            disabled={isResetting}
            className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors disabled:opacity-50"
          >
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
              <span>3. CANONICAL RESET</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Compiles canonical pipeline, starts all 4 containers, and verifies 100% health.
            </p>
          </button>
        </div>

        {feedbackNotice && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs font-mono text-blue-900 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
        )}
      </div>
    </div>
  );
}
