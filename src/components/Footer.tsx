import React from 'react';
import { GlobalValidationStatus } from '../types';
import { ShieldCheck, HardDrive } from 'lucide-react';

interface FooterProps {
  status: GlobalValidationStatus;
  executionTimeMs: number;
  elementCount: number;
}

export const Footer: React.FC<FooterProps> = ({
  status,
  executionTimeMs,
  elementCount,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'VALID':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
      case 'REVIEW_REQUIRED':
        return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
      case 'INVALID':
        return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]';
      default:
        return 'bg-slate-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'VALID':
        return 'Status: VALID (0 Errors, 0 Warnings)';
      case 'REVIEW_REQUIRED':
        return 'Status: REVIEW REQUIRED';
      case 'INVALID':
        return 'Status: INVALID (Critical Errors)';
      default:
        return 'Status: Ready (No XML Loaded)';
    }
  };

  return (
    <footer
      id="app_footer"
      className="flex items-center justify-between px-6 py-2 bg-slate-900 text-slate-300 text-[11px] font-medium uppercase tracking-wider select-none border-t border-slate-800 shrink-0"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
          <span className="text-white">{getStatusText()}</span>
        </div>
        <span className="text-slate-600 hidden sm:inline">|</span>
        <span className="hidden sm:inline">
          Execution Time: <span className="text-slate-200">{executionTimeMs.toFixed(1)}ms</span>
        </span>
        <span className="text-slate-600 hidden md:inline">|</span>
        <span className="hidden md:inline">
          Nodes: <span className="text-indigo-300">{elementCount}</span>
        </span>
      </div>

      <div className="flex items-center gap-2 text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span className="hidden sm:inline">Coupa TSE Tool • 100% Local & Offline</span>
      </div>
    </footer>
  );
};
