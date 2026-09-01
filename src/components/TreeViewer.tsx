import React, { useState } from 'react';
import { XMLNeutralNode } from '../types';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileCode,
  Tag,
  Search,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';

interface TreeViewerProps {
  rootNode: XMLNeutralNode | null;
  selectedNodeId: string | null;
  onSelectNode: (node: XMLNeutralNode) => void;
}

interface TreeNodeItemProps {
  node: XMLNeutralNode;
  selectedNodeId: string | null;
  onSelectNode: (node: XMLNeutralNode) => void;
  searchTerm: string;
  expandedMap: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  selectedNodeId,
  onSelectNode,
  searchTerm,
  expandedMap,
  onToggleExpand,
}) => {
  const hasChildren = node.children.length > 0;
  // Default to expanded for top 2 levels if not explicitly toggled
  const isExpanded = expandedMap[node.id] !== undefined ? expandedMap[node.id] : node.depth < 3;
  const isSelected = selectedNodeId === node.id;

  const matchesSearch =
    searchTerm &&
    (node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.attributes.some(
        a =>
          a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.value.toLowerCase().includes(searchTerm.toLowerCase())
      ));

  return (
    <div className="select-none font-mono text-xs">
      <div
        onClick={() => onSelectNode(node)}
        className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors ${
          isSelected
            ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-200 font-semibold'
            : matchesSearch
            ? 'bg-amber-100/70 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
        }`}
        style={{ paddingLeft: `${Math.max(0.5, node.depth * 1.25)}rem` }}
      >
        {/* Expand / Collapse Icon */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            )}
          </button>
        ) : (
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
        )}

        {/* Node Name */}
        <span className="font-semibold text-indigo-700 dark:text-indigo-400">
          {node.prefix ? `${node.prefix}:` : ''}
          {node.localName}
        </span>

        {/* Duplicate Sibling Index Badge */}
        {node.isDuplicateSibling && (
          <span className="text-[10px] px-1 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
            [{node.siblingIndex}]
          </span>
        )}

        {/* Attributes Preview */}
        {node.attributes.length > 0 && (
          <div className="flex items-center gap-1 overflow-hidden">
            {node.attributes.slice(0, 3).map((attr) => (
              <span
                key={attr.name}
                className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[140px]"
                title={`${attr.name}="${attr.value}"`}
              >
                <span className="text-slate-400">{attr.name}=</span>
                <span className="text-emerald-600 dark:text-emerald-400">"{attr.value}"</span>
              </span>
            ))}
            {node.attributes.length > 3 && (
              <span className="text-[9px] text-slate-400">+{node.attributes.length - 3}</span>
            )}
          </div>
        )}

        {/* Leaf text preview */}
        {!hasChildren && node.text && (
          <span className="text-slate-500 dark:text-slate-400 truncate max-w-[180px] text-[11px]">
            : "{node.text}"
          </span>
        )}

        {/* Children count badge */}
        {hasChildren && (
          <span className="ml-auto text-[10px] font-sans px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
            {node.children.length} {node.children.length === 1 ? 'nodo' : 'nodos'}
          </span>
        )}
      </div>

      {/* Render Children if expanded */}
      {hasChildren && isExpanded && (
        <div className="border-l border-slate-200 dark:border-slate-800 ml-3.5">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              searchTerm={searchTerm}
              expandedMap={expandedMap}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeViewer: React.FC<TreeViewerProps> = ({
  rootNode,
  selectedNodeId,
  onSelectNode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const handleToggleExpand = (id: string) => {
    setExpandedMap(prev => ({
      ...prev,
      [id]: prev[id] !== undefined ? !prev[id] : false,
    }));
  };

  const handleExpandAll = () => {
    if (!rootNode) return;
    const newMap: Record<string, boolean> = {};
    function traverse(node: XMLNeutralNode) {
      newMap[node.id] = true;
      node.children.forEach(traverse);
    }
    traverse(rootNode);
    setExpandedMap(newMap);
  };

  const handleCollapseAll = () => {
    if (!rootNode) return;
    const newMap: Record<string, boolean> = {};
    function traverse(node: XMLNeutralNode) {
      newMap[node.id] = false;
      node.children.forEach(traverse);
    }
    traverse(rootNode);
    // Keep root expanded
    newMap[rootNode.id] = true;
    setExpandedMap(newMap);
  };

  if (!rootNode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
        <FileCode className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
        <p className="text-sm font-medium">No se ha cargado ningún árbol XML válido.</p>
        <p className="text-xs text-slate-400 mt-1">Valida un XML para explorar su jerarquía visual.</p>
      </div>
    );
  }

  return (
    <div id="xml_tree_viewer_panel" className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
      {/* Tree Toolbar & Search */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar tag, atributo, path o valor..."
            className="w-full pl-8 pr-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExpandAll}
            title="Expandir todos los nodos"
            className="flex items-center gap-1 px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-xs transition-colors"
          >
            <ChevronsDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Expand All</span>
          </button>
          <button
            onClick={handleCollapseAll}
            title="Colapsar todos los nodos"
            className="flex items-center gap-1 px-2 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-xs transition-colors"
          >
            <ChevronsUp className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Collapse All</span>
          </button>
        </div>
      </div>

      {/* Tree Container */}
      <div className="flex-1 overflow-auto p-4 space-y-1">
        <TreeNodeItem
          node={rootNode}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          searchTerm={searchTerm}
          expandedMap={expandedMap}
          onToggleExpand={handleToggleExpand}
        />
      </div>
    </div>
  );
};
