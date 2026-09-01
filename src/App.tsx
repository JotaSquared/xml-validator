import React, { useState, useEffect, useMemo } from 'react';
import {
  GlobalValidationStatus,
  ValidationFinding,
  XMLNeutralNode,
  XMLStatistics,
  ValidationResult,
} from './types';
import { Header } from './components/Header';
import { XmlEditor } from './components/XmlEditor';
import { FindingsPanel } from './components/FindingsPanel';
import { TreeViewer } from './components/TreeViewer';
import { NodeInspector } from './components/NodeInspector';
import { ComparisonPanel } from './components/ComparisonPanel';
import { StatsPanel } from './components/StatsPanel';
import { Footer } from './components/Footer';

import { parseXML } from './utils/xmlParser';
import { formatXML } from './utils/xmlFormatter';
import { buildNeutralTree, calculateStatistics, resetNodeIdCounter, findNodeById } from './utils/xmlAnalyzer';
import { RuleEngine } from './utils/ruleEngine';
import { DEFAULT_VALIDATION_RULES } from './utils/validationRules';
import { REFERENCE_TEMPLATES } from './data/templates';

type ActiveTab = 'findings' | 'tree' | 'inspector' | 'comparison' | 'stats';

export default function App() {
  const [xmlContent, setXmlContent] = useState<string>(REFERENCE_TEMPLATES[0].content);
  const [fileName, setFileName] = useState<string | null>('coupa_standard_cxml.xml');
  const [activeTab, setActiveTab] = useState<ActiveTab>('findings');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<XMLNeutralNode | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Initialize Rule Engine
  const ruleEngine = useMemo(() => new RuleEngine(DEFAULT_VALIDATION_RULES), []);

  const [validationResult, setValidationResult] = useState<ValidationResult>({
    status: 'VALID',
    executionTimeMs: 0,
    findings: [],
    neutralTree: null,
    statistics: {
      totalElements: 0,
      totalAttributes: 0,
      maxDepth: 0,
      uniqueElementNames: 0,
      repeatedElementCount: 0,
      namespaceCount: 0,
      namespaces: [],
      totalErrors: 0,
      totalWarnings: 0,
      totalInfos: 0,
      characterCount: 0,
      lineCount: 0,
    },
    declaration: null,
  });

  // Execute Core Validation Pipeline
  const runValidation = (currentXml: string) => {
    const startTime = performance.now();
    resetNodeIdCounter();

    if (!currentXml.trim()) {
      setValidationResult({
        status: 'EMPTY',
        executionTimeMs: 0,
        findings: [],
        neutralTree: null,
        statistics: {
          totalElements: 0,
          totalAttributes: 0,
          maxDepth: 0,
          uniqueElementNames: 0,
          repeatedElementCount: 0,
          namespaceCount: 0,
          namespaces: [],
          totalErrors: 0,
          totalWarnings: 0,
          totalInfos: 0,
          characterCount: 0,
          lineCount: 0,
        },
        declaration: null,
      });
      setSelectedNode(null);
      setSelectedNodeId(null);
      return;
    }

    const parseRes = parseXML(currentXml);

    // If parsererror occurred at syntax level
    if (!parseRes.success || !parseRes.xmlDoc) {
      const endTime = performance.now();
      const findings: ValidationFinding[] = parseRes.errorFinding ? [parseRes.errorFinding] : [];
      const stats = calculateStatistics(currentXml, null);
      stats.totalErrors = findings.filter(f => f.severity === 'error').length;
      stats.totalWarnings = findings.filter(f => f.severity === 'warning').length;
      stats.totalInfos = findings.filter(f => f.severity === 'info').length;

      setValidationResult({
        status: 'INVALID',
        executionTimeMs: endTime - startTime,
        findings,
        neutralTree: null,
        statistics: stats,
        declaration: parseRes.declaration,
      });
      setSelectedNode(null);
      setSelectedNodeId(null);
      return;
    }

    // Build Neutral Tree
    const rootElement = parseRes.xmlDoc.documentElement;
    const neutralTree = buildNeutralTree(rootElement);

    // Calculate structural metrics
    const stats = calculateStatistics(currentXml, neutralTree);

    // Run Rule Engine
    const ruleFindings = ruleEngine.run({
      rawXml: currentXml,
      xmlDoc: parseRes.xmlDoc,
      neutralTree,
      statistics: stats,
    });

    const allFindings = [...ruleFindings];
    stats.totalErrors = allFindings.filter(f => f.severity === 'error').length;
    stats.totalWarnings = allFindings.filter(f => f.severity === 'warning').length;
    stats.totalInfos = allFindings.filter(f => f.severity === 'info').length;

    // Determine Global Status
    let globalStatus: GlobalValidationStatus = 'VALID';
    if (stats.totalErrors > 0) {
      globalStatus = 'INVALID';
    } else if (stats.totalWarnings > 0) {
      globalStatus = 'REVIEW_REQUIRED';
    }

    const endTime = performance.now();

    setValidationResult({
      status: globalStatus,
      executionTimeMs: endTime - startTime,
      findings: allFindings,
      neutralTree,
      statistics: stats,
      declaration: parseRes.declaration,
    });

    // If previously selected node exists in new tree, update reference; otherwise select root
    if (neutralTree) {
      if (selectedNodeId) {
        const found = findNodeById(neutralTree, selectedNodeId);
        if (found) {
          setSelectedNode(found);
        } else {
          setSelectedNode(neutralTree);
          setSelectedNodeId(neutralTree.id);
        }
      } else {
        setSelectedNode(neutralTree);
        setSelectedNodeId(neutralTree.id);
      }
    }
  };

  // Run initial validation on mount
  useEffect(() => {
    runValidation(xmlContent);
  }, []);

  const handleFormat = () => {
    const res = formatXML(xmlContent, 2);
    if (res.success && res.formatted) {
      setXmlContent(res.formatted);
      runValidation(res.formatted);
    }
  };

  const handleClear = () => {
    setXmlContent('');
    setFileName(null);
    runValidation('');
  };

  const handleFileLoaded = (name: string, content: string) => {
    setFileName(name);
    setXmlContent(content);
    runValidation(content);
  };

  const handleSelectNode = (node: XMLNeutralNode) => {
    setSelectedNode(node);
    setSelectedNodeId(node.id);
  };

  const handleSelectNodePath = (path: string) => {
    if (!validationResult.neutralTree) return;
    function findByPath(n: XMLNeutralNode): XMLNeutralNode | null {
      if (n.path === path) return n;
      for (const child of n.children) {
        const res = findByPath(child);
        if (res) return res;
      }
      return null;
    }
    const target = findByPath(validationResult.neutralTree);
    if (target) {
      handleSelectNode(target);
      setActiveTab('inspector');
    }
  };

  const handleExportReport = () => {
    const reportData = {
      tool: 'XML Invoice Validator',
      version: '1.1.0',
      timestamp: new Date().toISOString(),
      fileName: fileName || 'raw_invoice_input.xml',
      status: validationResult.status,
      executionTimeMs: validationResult.executionTimeMs,
      statistics: validationResult.statistics,
      declaration: validationResult.declaration,
      findings: validationResult.findings,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xml_validation_report_${new Date().getTime()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${darkMode ? 'dark' : ''} h-screen w-screen flex flex-col overflow-hidden bg-[#f8fafc] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100`}>
      {/* Top Header */}
      <Header
        status={validationResult.status}
        statistics={validationResult.statistics}
        executionTimeMs={validationResult.executionTimeMs}
        onValidate={() => runValidation(xmlContent)}
        onExportReport={handleExportReport}
        onLoadSample={() => {
          setFileName('coupa_standard_cxml.xml');
          setXmlContent(REFERENCE_TEMPLATES[0].content);
          runValidation(REFERENCE_TEMPLATES[0].content);
        }}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />

      {/* Main 2-Panel Work Area */}
      <main id="main_workspace" className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel: XML Source Editor (50% on desktop) */}
        <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full overflow-hidden border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800">
          <XmlEditor
            value={xmlContent}
            onChange={(newVal) => setXmlContent(newVal)}
            onValidate={() => runValidation(xmlContent)}
            onFormat={handleFormat}
            onClear={handleClear}
            fileName={fileName}
            onFileLoaded={handleFileLoaded}
          />
        </div>

        {/* Right Panel: Results & Inspection (50% on desktop) */}
        <section id="results_panel_section" className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full overflow-hidden bg-slate-50 dark:bg-slate-900">
          {/* Navigation Tab Bar */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shrink-0 select-none">
            <button
              id="tab_findings"
              onClick={() => setActiveTab('findings')}
              className={`px-5 py-3 text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'findings'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>Validation Findings</span>
              {validationResult.findings.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    validationResult.statistics.totalErrors > 0
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {validationResult.findings.length}
                </span>
              )}
            </button>

            <button
              id="tab_tree"
              onClick={() => setActiveTab('tree')}
              className={`px-5 py-3 text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'tree'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              XML Structure Tree
            </button>

            <button
              id="tab_inspector"
              onClick={() => setActiveTab('inspector')}
              className={`px-5 py-3 text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                activeTab === 'inspector'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>Node Details</span>
              {selectedNode && (
                <span className="text-[10px] font-mono text-slate-400 max-w-[90px] truncate">
                  (&lt;{selectedNode.localName}&gt;)
                </span>
              )}
            </button>

            <button
              id="tab_comparison"
              onClick={() => setActiveTab('comparison')}
              className={`px-5 py-3 text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'comparison'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Comparison
            </button>

            <button
              id="tab_stats"
              onClick={() => setActiveTab('stats')}
              className={`px-5 py-3 text-xs font-bold transition-colors whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Raw Metrics
            </button>
          </div>

          {/* Active Tab View */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeTab === 'findings' && (
              <FindingsPanel
                findings={validationResult.findings}
                status={validationResult.status}
                onSelectNodePath={handleSelectNodePath}
              />
            )}

            {activeTab === 'tree' && (
              <TreeViewer
                rootNode={validationResult.neutralTree}
                selectedNodeId={selectedNodeId}
                onSelectNode={(node) => {
                  handleSelectNode(node);
                }}
              />
            )}

            {activeTab === 'inspector' && (
              <NodeInspector
                node={selectedNode}
                findings={validationResult.findings}
                onSelectChildNode={(childId) => {
                  if (validationResult.neutralTree) {
                    const child = findNodeById(validationResult.neutralTree, childId);
                    if (child) handleSelectNode(child);
                  }
                }}
              />
            )}

            {activeTab === 'comparison' && (
              <ComparisonPanel actualTree={validationResult.neutralTree} />
            )}

            {activeTab === 'stats' && (
              <StatsPanel
                statistics={validationResult.statistics}
                declaration={validationResult.declaration}
              />
            )}
          </div>
        </section>
      </main>

      {/* Bottom Footer Bar */}
      <Footer
        status={validationResult.status}
        executionTimeMs={validationResult.executionTimeMs}
        elementCount={validationResult.statistics.totalElements}
      />
    </div>
  );
}
