import React from 'react';
import { XMLStatistics, XMLDeclarationInfo } from '../types';
import { BarChart3, Hash, Layers, Tag, ShieldCheck, FileText, Globe } from 'lucide-react';

interface StatsPanelProps {
  statistics: XMLStatistics;
  declaration?: {
    version?: string;
    encoding?: string;
    standalone?: string;
  } | null;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ statistics, declaration }) => {
  return (
    <div id="xml_stats_panel" className="flex-1 flex flex-col overflow-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 space-y-4">
      {/* Header Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Hash className="w-3.5 h-3.5 text-indigo-500" />
            <span>Total Elementos</span>
          </div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {statistics.totalElements.toLocaleString()}
          </p>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Tag className="w-3.5 h-3.5 text-emerald-500" />
            <span>Total Atributos</span>
          </div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {statistics.totalAttributes.toLocaleString()}
          </p>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>Profundidad Máxima</span>
          </div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {statistics.maxDepth} niveles
          </p>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <FileText className="w-3.5 h-3.5 text-purple-500" />
            <span>Tags Únicos</span>
          </div>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {statistics.uniqueElementNames}
          </p>
        </div>
      </div>

      {/* XML Declaration Card */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
          Declaración XML de Cabecera
        </h3>
        {declaration ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">Versión XML:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {declaration.version || 'No especificada'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">Encoding / Codificación:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {declaration.encoding || 'No especificado (Asume UTF-8)'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px]">Standalone:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {declaration.standalone || 'N/A'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            No se detectó directiva &lt;?xml ... ?&gt; al inicio del documento.
          </p>
        )}
      </div>

      {/* Namespaces Table */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-indigo-500" />
          Namespaces Detectados ({statistics.namespaces.length})
        </h3>
        {statistics.namespaces.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No se declararon namespaces explícitos (xmlns).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-400">
                  <th className="pb-2 font-medium">Prefijo</th>
                  <th className="pb-2 font-medium">Namespace URI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {statistics.namespaces.map((ns) => (
                  <tr key={`${ns.prefix}_${ns.uri}`} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                    <td className="py-2 text-indigo-600 dark:text-indigo-400 font-semibold pr-4">
                      {ns.prefix === 'default' ? '(default / sin prefijo)' : ns.prefix}
                    </td>
                    <td className="py-2 text-slate-600 dark:text-slate-300 break-all">
                      {ns.uri}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diagnostic Totals */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Resumen de Métricas de Archivo
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">Líneas de Código:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
              {statistics.lineCount.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Caracteres:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
              {statistics.characterCount.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Nodos Repetidos:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
              {statistics.repeatedElementCount}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Diagnósticos Activos:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
              {statistics.totalErrors + statistics.totalWarnings + statistics.totalInfos}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
