import React, { useState } from 'react';
import { XMLNeutralNode, ValidationFinding } from '../types';
import { Tag, Copy, Check, Hash, Layers, FileText, AlertTriangle, AlertCircle } from 'lucide-react';

interface NodeInspectorProps {
  node: XMLNeutralNode | null;
  findings: ValidationFinding[];
  onSelectChildNode?: (childId: string) => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  findings,
  onSelectChildNode,
}) => {
  const [copiedPath, setCopiedPath] = useState(false);

  if (!node) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
        <Tag className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2" />
        <p className="text-sm font-medium">Ningún elemento seleccionado</p>
        <p className="text-xs text-slate-400 mt-1">
          Haz clic en cualquier nodo del árbol XML para inspeccionar sus atributos y contenido.
        </p>
      </div>
    );
  }

  const handleCopyPath = () => {
    navigator.clipboard.writeText(node.path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  // Find any errors/warnings associated with this node path
  const relatedFindings = findings.filter(
    f => f.path && (f.path === node.path || node.path.startsWith(f.path))
  );

  return (
    <div id="node_inspector_panel" className="flex-1 flex flex-col overflow-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 space-y-4">
      {/* Node Header Card */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Elemento
            </span>
            <h2 className="text-base font-bold text-indigo-700 dark:text-indigo-400 font-mono">
              &lt;{node.name}&gt;
            </h2>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            Nivel: {node.depth}
          </span>
        </div>

        {/* XPath Path Bar */}
        <div className="flex items-center justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-400 font-bold">XPath:</span>
            <span className="truncate">{node.path}</span>
          </div>
          <button
            onClick={handleCopyPath}
            title="Copiar ruta XPath"
            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0 rounded transition-colors"
          >
            {copiedPath ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Associated Findings if any */}
      {relatedFindings.length > 0 && (
        <div className="p-4 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg">
          <div className="flex items-center gap-2 mb-2 text-rose-800 dark:text-rose-300 text-xs font-bold uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Hallazgos en este elemento ({relatedFindings.length})</span>
          </div>
          <div className="space-y-2">
            {relatedFindings.map((f) => (
              <div key={f.id} className="text-xs p-2 rounded bg-white/80 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-900">
                <div className="font-bold text-rose-700 dark:text-rose-400 mb-0.5">{f.title}</div>
                <div className="text-slate-600 dark:text-slate-300">{f.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attributes Table */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-indigo-500" />
          Atributos ({node.attributes.length})
        </h3>

        {node.attributes.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No contiene atributos definidos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-400">
                  <th className="pb-2 font-medium">Nombre</th>
                  <th className="pb-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {node.attributes.map((attr) => (
                  <tr key={attr.name} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                    <td className="py-2 text-indigo-600 dark:text-indigo-400 font-semibold pr-3">
                      {attr.name}
                    </td>
                    <td className="py-2 text-emerald-700 dark:text-emerald-400 break-all">
                      "{attr.value}"
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Text Content */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          Contenido de Texto
        </h3>
        {node.text ? (
          <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all">
            {node.text}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Sin texto directo (nodo contenedor o vacío).</p>
        )}
      </div>

      {/* Direct Children */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          Hijos Directos ({node.children.length})
        </h3>
        {node.children.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Es un elemento hoja (sin hijos).</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {node.children.map((child) => (
              <button
                key={child.id}
                onClick={() => onSelectChildNode && onSelectChildNode(child.id)}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300 font-mono text-xs border border-slate-200 dark:border-slate-700 transition-colors"
              >
                &lt;{child.name}&gt;
                {child.isDuplicateSibling && (
                  <span className="text-[10px] text-slate-400 ml-1">[{child.siblingIndex}]</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
