import React from 'react';
import { GlobalValidationStatus, XMLStatistics } from '../types';
import { Play, Download, Sparkles, RefreshCw, Sun, Moon, FileCode } from 'lucide-react';

interface HeaderProps {
  status: GlobalValidationStatus;
  statistics: XMLStatistics;
  executionTimeMs: number;
  onValidate: () => void;
  onExportReport: () => void;
  onLoadSample: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  statistics,
  executionTimeMs,
  onValidate,
  onExportReport,
  onLoadSample,
  darkMode,
  onToggleDarkMode,
}) => {
  return (
    <header
      id="app_header"
      className="flex items-center justify-between px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs select-none transition-colors"
    >
      {/* Brand / Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-xs">
          XML
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              XML Invoice Validator
            </h1>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              v1.1.0 • Coupa TSE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
            Diagnóstico local y análisis estructural de facturas para integraciones
          </p>
        </div>
      </div>

      {/* Center/Right Metrics & Actions */}
      <div className="flex items-center gap-6">
        {/* Quick Diagnostic Counters */}
        <div className="flex items-center gap-4">
          <div className="text-center px-1">
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              Errors
            </p>
            <p
              className={`text-sm font-semibold ${
                statistics.totalErrors > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {statistics.totalErrors}
            </p>
          </div>
          <div className="text-center px-1">
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              Warnings
            </p>
            <p
              className={`text-sm font-semibold ${
                statistics.totalWarnings > 0
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {statistics.totalWarnings}
            </p>
          </div>
          <div className="text-center px-1">
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
              Elements
            </p>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {statistics.totalElements}
            </p>
          </div>
        </div>

        <div className="h-7 w-px bg-slate-200 dark:bg-slate-800"></div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn_load_sample"
            onClick={onLoadSample}
            title="Cargar ejemplo estándar Coupa cXML"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Sample cXML</span>
          </button>

          <button
            id="btn_validate_header"
            onClick={onValidate}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded shadow-xs active:scale-98 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Validate Now</span>
          </button>

          <button
            id="btn_export_report"
            onClick={onExportReport}
            title="Exportar reporte de diagnóstico en formato JSON/HTML"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Report</span>
          </button>

          <button
            id="btn_toggle_theme"
            onClick={onToggleDarkMode}
            title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
