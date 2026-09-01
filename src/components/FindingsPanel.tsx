import React, { useState } from 'react';
import { ValidationFinding, GlobalValidationStatus } from '../types';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Terminal,
  Lightbulb,
  ExternalLink,
} from 'lucide-react';

interface FindingsPanelProps {
  findings: ValidationFinding[];
  status: GlobalValidationStatus;
  onSelectNodePath?: (path: string) => void;
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({
  findings,
  status,
  onSelectNodePath,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'error' | 'warning' | 'info'>('ALL');
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const toggleDetails = (id: string) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const errorCount = findings.filter(f => f.severity === 'error').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const infoCount = findings.filter(f => f.severity === 'info').length;

  const filteredFindings = findings.filter(f => {
    if (filter === 'ALL') return true;
    return f.severity === filter;
  });

  return (
    <div id="findings_panel_container" className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/50">
      {/* Top Status Banner */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {status === 'VALID' && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Estado: VALID
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  El XML es sintácticamente válido y no presenta advertencias estructurales.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
              0 Errores
            </span>
          </div>
        )}

        {status === 'REVIEW_REQUIRED' && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Estado: REVIEW REQUIRED
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Sintaxis válida, pero se detectaron {warningCount} observaciones que requieren revisión técnica.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
              {warningCount} Warnings
            </span>
          </div>
        )}

        {status === 'INVALID' && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Estado: INVALID
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-400">
                  Se encontraron errores críticos que impiden el procesamiento de la factura.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
              {errorCount} Errores
            </span>
          </div>
        )}

        {/* Severity Filter Chips */}
        <div className="flex items-center gap-2 mt-3 select-none">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filter === 'ALL'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            Todos ({findings.length})
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 transition-colors ${
              filter === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 hover:bg-rose-100'
            }`}
          >
            Errores ({errorCount})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 transition-colors ${
              filter === 'warning'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            Warnings ({warningCount})
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 transition-colors ${
              filter === 'info'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 hover:bg-indigo-100'
            }`}
          >
            Informativos ({infoCount})
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-3.5">
        {filteredFindings.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium">No hay hallazgos en esta categoría.</p>
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const isError = finding.severity === 'error';
            const isWarning = finding.severity === 'warning';
            const isInfo = finding.severity === 'info';

            const borderColor = isError
              ? 'border-rose-500'
              : isWarning
              ? 'border-amber-500'
              : 'border-indigo-500';

            const badgeBg = isError
              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
              : isWarning
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
              : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400';

            const isExpanded = !!expandedDetails[finding.id];

            return (
              <div
                key={finding.id}
                className={`p-4 bg-white dark:bg-slate-900 border-l-4 ${borderColor} rounded-md shadow-xs border-y border-r border-slate-200 dark:border-slate-800 transition-all`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {finding.code}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {finding.title}
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${badgeBg}`}>
                    {finding.severity}
                  </span>
                </div>

                {/* Message */}
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-2.5 leading-relaxed">
                  {finding.message}
                </p>

                {/* Path and Location info */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {finding.path && (
                    <div
                      onClick={() => onSelectNodePath && onSelectNodePath(finding.path!)}
                      className={`text-[11px] font-mono px-2.5 py-1 rounded bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 ${
                        onSelectNodePath ? 'cursor-pointer hover:border-indigo-400 hover:text-indigo-600 transition-colors' : ''
                      }`}
                      title={onSelectNodePath ? 'Ver nodo en árbol' : undefined}
                    >
                      <span className="text-slate-400 font-semibold">Path:</span>
                      <span>{finding.path}</span>
                      {onSelectNodePath && <ExternalLink className="w-3 h-3 text-slate-400" />}
                    </div>
                  )}

                  {(finding.line !== null && finding.line !== undefined) && (
                    <div className="text-[11px] font-mono px-2 py-1 rounded bg-slate-50 dark:bg-slate-850 text-slate-500 border border-slate-200 dark:border-slate-800">
                      Línea: {finding.line} {finding.column ? `| Col: ${finding.column}` : ''}
                    </div>
                  )}
                </div>

                {/* Snippet preview if available */}
                {finding.snippet && (
                  <div className="mb-2.5 p-2 bg-slate-900 text-slate-200 rounded font-mono text-[11px] overflow-x-auto whitespace-pre leading-5">
                    {finding.snippet}
                  </div>
                )}

                {/* Actionable Suggestion */}
                <div className="flex items-start gap-2 p-2.5 rounded bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200 text-xs">
                  <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold text-indigo-950 dark:text-indigo-100 mr-1">
                      Recomendación TSE:
                    </span>
                    {finding.suggestion}
                  </div>
                </div>

                {/* Technical Details Accordion */}
                {finding.technicalDetails && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => toggleDetails(finding.id)}
                      className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      <Terminal className="w-3 h-3 text-slate-400" />
                      <span>Detalles técnicos del parser</span>
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>

                    {isExpanded && (
                      <div className="mt-1.5 p-2 rounded bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-mono text-[10px] whitespace-pre-wrap break-all">
                        {finding.technicalDetails}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
