'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ValidationResult } from '@/core/validation/types';

interface ValidationPanelProps {
  validation: ValidationResult;
  onSelectNode?: (nodeId: string) => void;
}

export function ValidationPanel({ validation, onSelectNode }: ValidationPanelProps) {
  const { isValid, errors, warnings } = validation;

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
        <div className="flex items-center space-x-2">
          {isValid ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
          )}
          <h3 className="text-sm font-semibold text-[#0f172a]">
            {isValid ? 'Architecture Graph Valid' : 'Architectural Issues Detected'}
          </h3>
        </div>
        <span className="text-xs font-mono text-[#64748b]">
          {errors.length} {errors.length === 1 ? 'error' : 'errors'}, {warnings.length}{' '}
          {warnings.length === 1 ? 'warning' : 'warnings'}
        </span>
      </div>

      <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
        {errors.length === 0 && warnings.length === 0 && (
          <p className="text-xs text-slate-500 italic py-2">
            Topology passes all deterministic structural checks. Graph is ready for compilation.
          </p>
        )}

        {/* Errors */}
        {errors.map((err, idx) => (
          <div
            key={`err-${idx}`}
            onClick={() => err.nodeId && onSelectNode?.(err.nodeId)}
            className={`p-2.5 rounded border border-rose-200 bg-rose-50/50 flex items-start space-x-2 text-xs transition-colors ${
              err.nodeId ? 'cursor-pointer hover:bg-rose-100/60' : ''
            }`}
          >
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-rose-800 text-[10px] px-1 py-0.5 bg-rose-200/60 rounded">
                  {err.code}
                </span>
                {err.nodeId && (
                  <span className="font-mono text-rose-700 text-[11px]">
                    Node: {err.nodeId}
                  </span>
                )}
              </div>
              <p className="text-rose-900 mt-1">{err.message}</p>
            </div>
          </div>
        ))}

        {/* Warnings */}
        {warnings.map((warn, idx) => (
          <div
            key={`warn-${idx}`}
            onClick={() => warn.nodeId && onSelectNode?.(warn.nodeId)}
            className={`p-2.5 rounded border border-amber-200 bg-amber-50/50 flex items-start space-x-2 text-xs transition-colors ${
              warn.nodeId ? 'cursor-pointer hover:bg-amber-100/60' : ''
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-amber-800 text-[10px] px-1 py-0.5 bg-amber-200/60 rounded">
                  {warn.code}
                </span>
                {warn.nodeId && (
                  <span className="font-mono text-amber-700 text-[11px]">
                    Node: {warn.nodeId}
                  </span>
                )}
              </div>
              <p className="text-amber-900 mt-1">{warn.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
