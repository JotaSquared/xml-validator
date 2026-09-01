import React, { useState, useEffect } from 'react';
import { XMLNeutralNode, StructuralDiffItem } from '../types';
import { REFERENCE_TEMPLATES } from '../data/templates';
import { compareWithTemplate } from '../utils/templateComparator';
import { GitCompare, Upload, AlertTriangle, Info, CheckCircle2, ChevronRight, FileCode } from 'lucide-react';

interface ComparisonPanelProps {
  actualTree: XMLNeutralNode | null;
}

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({ actualTree }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(REFERENCE_TEMPLATES[0].id);
  const [customTemplateXml, setCustomTemplateXml] = useState<string | null>(null);
  const [customTemplateName, setCustomTemplateName] = useState<string | null>(null);
  const [diffResults, setDiffResults] = useState<StructuralDiffItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'MISSING' | 'EXTRA' | 'ATTR'>('ALL');

  const activeTemplate = REFERENCE_TEMPLATES.find(t => t.id === selectedTemplateId);
  const templateXmlToCompare = customTemplateXml || (activeTemplate ? activeTemplate.content : '');

  const runComparison = () => {
    if (!actualTree) {
      setErrorMsg('Debes analizar y validar primero la factura actual para poder compararla.');
      setDiffResults([]);
      return;
    }

    if (!templateXmlToCompare) {
      setErrorMsg('Selecciona o carga una plantilla XML de referencia.');
      return;
    }

    setErrorMsg(null);
    const { diffs, error } = compareWithTemplate(actualTree, templateXmlToCompare);
    if (error) {
      setErrorMsg(error);
      setDiffResults([]);
    } else {
      setDiffResults(diffs);
    }
  };

  useEffect(() => {
    runComparison();
  }, [actualTree, selectedTemplateId, customTemplateXml]);

  const handleCustomTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCustomTemplateXml(content);
      setCustomTemplateName(file.name);
      setSelectedTemplateId('custom');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const missingCount = diffResults.filter(d => d.type === 'MISSING_ELEMENT').length;
  const extraCount = diffResults.filter(d => d.type === 'EXTRA_ELEMENT').length;
  const attrMismatchCount = diffResults.filter(d => d.type === 'ATTRIBUTE_MISMATCH').length;

  const filteredDiffs = diffResults.filter(d => {
    if (filter === 'MISSING') return d.type === 'MISSING_ELEMENT';
    if (filter === 'EXTRA') return d.type === 'EXTRA_ELEMENT';
    if (filter === 'ATTR') return d.type === 'ATTRIBUTE_MISMATCH';
    return true;
  });

  return (
    <div id="structural_comparison_panel" className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/50">
      {/* Template Selector Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Plantilla XML de Referencia
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                if (e.target.value !== 'custom') {
                  setCustomTemplateXml(null);
                  setCustomTemplateName(null);
                }
              }}
              className="w-full max-w-md px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500"
            >
              {REFERENCE_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name} ({tmpl.category})
                </option>
              ))}
              {customTemplateName && (
                <option value="custom">
                  Custom: {customTemplateName}
                </option>
              )}
            </select>
            {activeTemplate?.description && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {activeTemplate.description}
              </p>
            )}
            {activeTemplate?.documentNote && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic mt-0.5">
                Document note: {activeTemplate.documentNote}
              </p>
            )}
          </div>

          <div>
            <input
              type="file"
              id="custom_template_input"
              accept=".xml,.cxml,text/xml"
              onChange={handleCustomTemplateUpload}
              className="hidden"
            />
            <label
              htmlFor="custom_template_input"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Importar Plantilla Local</span>
            </label>
          </div>
        </div>

        {/* Diff summary badges */}
        <div className="flex items-center gap-2 mt-4 select-none">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filter === 'ALL'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            Todas las Diferencias ({diffResults.length})
          </button>
          <button
            onClick={() => setFilter('MISSING')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filter === 'MISSING'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            Faltantes ({missingCount})
          </button>
          <button
            onClick={() => setFilter('EXTRA')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filter === 'EXTRA'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 hover:bg-indigo-100'
            }`}
          >
            Adicionales ({extraCount})
          </button>
          <button
            onClick={() => setFilter('ATTR')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filter === 'ATTR'
                ? 'bg-slate-600 text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            Atributos ({attrMismatchCount})
          </button>
        </div>
      </div>

      {/* Comparison Diff Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-3">
        {errorMsg ? (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
            {errorMsg}
          </div>
        ) : filteredDiffs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Estructura idéntica a la plantilla de referencia.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              No se detectaron elementos faltantes ni atributos omitidos.
            </p>
          </div>
        ) : (
          filteredDiffs.map((diff, index) => {
            const isMissing = diff.type === 'MISSING_ELEMENT';
            const isExtra = diff.type === 'EXTRA_ELEMENT';

            const borderClass = isMissing
              ? 'border-amber-500'
              : isExtra
              ? 'border-indigo-500'
              : 'border-slate-400';

            const badgeBg = isMissing
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
              : isExtra
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

            const badgeLabel = isMissing
              ? 'Elemento Faltante'
              : isExtra
              ? 'Elemento Adicional'
              : 'Diferencia en Atributo';

            return (
              <div
                key={`${diff.path}_${index}`}
                className={`p-4 bg-white dark:bg-slate-900 border-l-4 ${borderClass} rounded-md shadow-xs border-y border-r border-slate-200 dark:border-slate-800`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                      &lt;{diff.elementName}&gt;
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${badgeBg}`}>
                    {badgeLabel}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                  {diff.description}
                </p>

                <div className="text-[11px] font-mono p-2 rounded bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 font-semibold">Path:</span> {diff.path}
                </div>

                {diff.templateValue && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                    {diff.templateValue}
                  </div>
                )}
                {diff.actualValue && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                    {diff.actualValue}
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
