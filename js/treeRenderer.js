/**
 * XML Invoice Validator - Interactive Tree Renderer Module
 * 
 * Renders neutral XML AST into a responsive, performant interactive tree viewer.
 * - Single-pass HTML generation with safe text escaping (No HTML injection)
 * - Event delegation for high performance on large documents (500+ nodes)
 * - Expand / Collapse by node
 * - Global Expand All / Collapse All
 * - Node selection with visual highlight and detail synchronization
 * 
 * 100% standalone, zero external dependencies, file:// compatible.
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.TreeRenderer = (function () {
  'use strict';

  var currentSelectedId = null;
  var onSelectCallback = null;

  /**
   * Recursive HTML generator for a tree node
   * @param {Object} node Neutral node object from XMLValidator.Analyzer
   * @returns {string}
   */
  function renderNodeHtml(node) {
    var escapeHtml = XMLValidator.Utils.escapeHtml;

    var hasChildren = node.hasElementChildren;
    // Initial expansion rule: Expand Root (depth 0) and first level (depth 1), collapse deeper levels
    var isInitiallyCollapsed = node.depth > 1 && hasChildren;
    var nodeClass = 'tree-node' + (isInitiallyCollapsed ? ' tree-node-collapsed' : '') + (hasChildren ? ' has-children' : ' is-leaf');
    
    var toggleBtn = '';
    if (hasChildren) {
      toggleBtn = '<button type="button" class="tree-toggle-btn" aria-label="Toggle expand" title="Expand / Collapse">' +
                  '<span class="toggle-icon">' + (isInitiallyCollapsed ? '▶' : '▼') + '</span>' +
                  '</button>';
    } else {
      toggleBtn = '<span class="tree-leaf-spacer" aria-hidden="true">•</span>';
    }

    var indexBadge = '';
    if (node.isRepeatedSibling) {
      indexBadge = '<span class="tree-index-badge">[' + node.siblingIndex + ']</span>';
    }

    var childBadge = '';
    if (hasChildren) {
      var childCountLabel = node.childCount === 1 ? '1 child' : node.childCount + ' children';
      childBadge = '<span class="tree-child-count-badge">' + childCountLabel + '</span>';
    }

    // Direct text preview (if leaf and non-empty, show short snippet)
    var textPreview = '';
    if (!hasChildren && node.directText) {
      var snippet = node.directText.length > 25 ? node.directText.substring(0, 25) + '…' : node.directText;
      textPreview = '<span class="tree-text-preview">"' + escapeHtml(snippet) + '"</span>';
    }

    var rowHtml = [
      '<div class="tree-node-row" data-node-id="' + escapeHtml(node.id) + '" role="treeitem" tabindex="0">',
      '  ' + toggleBtn,
      '  <span class="tree-tag-name">&lt;' + escapeHtml(node.name) + '&gt;</span>',
      '  ' + indexBadge,
      '  ' + childBadge,
      '  ' + textPreview,
      '</div>'
    ].join('\n');

    var childrenHtml = '';
    if (hasChildren && node.children.length > 0) {
      var childrenParts = [];
      for (var i = 0; i < node.children.length; i++) {
        childrenParts.push(renderNodeHtml(node.children[i]));
      }
      childrenHtml = '<div class="tree-node-children" role="group">' + childrenParts.join('\n') + '</div>';
    }

    return [
      '<div class="' + nodeClass + '" id="tree_el_' + escapeHtml(node.id) + '" data-node-id="' + escapeHtml(node.id) + '">',
      rowHtml,
      childrenHtml,
      '</div>'
    ].join('\n');
  }

  /**
   * Render the complete tree into the target container
   * 
   * @param {HTMLElement} container Container element (e.g. tab_pane_tree)
   * @param {Object} treeRoot Neutral tree root node
   * @param {Object} statistics Document statistics
   * @param {Function} selectCallback Callback when a node is selected (nodeId)
   */
  function render(container, treeRoot, statistics, selectCallback) {
    if (!container) return;

    onSelectCallback = selectCallback;
    currentSelectedId = treeRoot ? treeRoot.id : null;

    if (!treeRoot) {
      container.innerHTML = [
        '<div class="empty-state">',
        '  <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">',
        '    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16m-7 6h7" />',
        '  </svg>',
        '  <div class="empty-state-title">No Tree Available</div>',
        '  <p class="empty-state-text">Validate an XML document to render its interactive hierarchy.</p>',
        '</div>'
      ].join('\n');
      return;
    }

    var totalElements = (statistics && statistics.totalElements) ? statistics.totalElements : 1;
    var maxDepth = (statistics && statistics.maxDepth !== undefined) ? statistics.maxDepth : 0;

    var toolbarHtml = [
      '<div class="tree-toolbar">',
      '  <div class="tree-toolbar-meta">',
      '    <span class="tree-meta-item"><strong>' + totalElements.toLocaleString() + '</strong> elements</span>',
      '    <span class="tree-meta-divider">•</span>',
      '    <span class="tree-meta-item">Max Depth: <strong>' + maxDepth + '</strong></span>',
      '  </div>',
      '  <div class="tree-toolbar-actions">',
      '    <button type="button" id="btn_tree_expand_all" class="tree-btn-action" title="Expand all nodes in the tree">',
      '      <span class="btn-icon">⊞</span> Expand All',
      '    </button>',
      '    <button type="button" id="btn_tree_collapse_all" class="tree-btn-action" title="Collapse all inner child nodes">',
      '      <span class="btn-icon">⊟</span> Collapse All',
      '    </button>',
      '  </div>',
      '</div>'
    ].join('\n');

    var treeBodyHtml = '<div class="tree-body-scroll" id="tree_body_scroll" role="tree">' + renderNodeHtml(treeRoot) + '</div>';

    container.innerHTML = toolbarHtml + treeBodyHtml;

    // Attach event delegation
    bindTreeEvents(container);

    // Initial select root node
    if (treeRoot && treeRoot.id) {
      selectNode(treeRoot.id, false);
    }
  }

  /**
   * Set selection highlight on a node
   * @param {string} nodeId 
   * @param {boolean} notifyCallback Whether to trigger onSelectCallback
   */
  function selectNode(nodeId, notifyCallback) {
    if (!nodeId) return;

    var oldSelected = document.querySelector('.tree-node-row.selected-node');
    if (oldSelected) {
      oldSelected.classList.remove('selected-node');
      oldSelected.setAttribute('aria-selected', 'false');
    }

    var newRow = document.querySelector('.tree-node-row[data-node-id="' + nodeId + '"]');
    if (newRow) {
      newRow.classList.add('selected-node');
      newRow.setAttribute('aria-selected', 'true');
      currentSelectedId = nodeId;
    }

    if (notifyCallback && typeof onSelectCallback === 'function') {
      onSelectCallback(nodeId);
    }
  }

  /**
   * Toggle node expanded/collapsed state
   * @param {HTMLElement} nodeEl The .tree-node wrapper
   */
  function toggleNode(nodeEl) {
    if (!nodeEl || !nodeEl.classList.contains('has-children')) return;

    var isCollapsed = nodeEl.classList.contains('tree-node-collapsed');
    var iconEl = nodeEl.querySelector(':scope > .tree-node-row .toggle-icon');

    if (isCollapsed) {
      nodeEl.classList.remove('tree-node-collapsed');
      if (iconEl) iconEl.textContent = '▼';
    } else {
      nodeEl.classList.add('tree-node-collapsed');
      if (iconEl) iconEl.textContent = '▶';
    }
  }

  /**
   * Expand all nodes
   */
  function expandAll() {
    var allNodes = document.querySelectorAll('.tree-node.has-children');
    for (var i = 0; i < allNodes.length; i++) {
      allNodes[i].classList.remove('tree-node-collapsed');
      var icon = allNodes[i].querySelector(':scope > .tree-node-row .toggle-icon');
      if (icon) icon.textContent = '▼';
    }
  }

  /**
   * Collapse all nodes except root
   */
  function collapseAll() {
    var allNodes = document.querySelectorAll('.tree-node.has-children');
    for (var i = 0; i < allNodes.length; i++) {
      // Don't collapse the root element, only inner children
      if (i > 0) {
        allNodes[i].classList.add('tree-node-collapsed');
        var icon = allNodes[i].querySelector(':scope > .tree-node-row .toggle-icon');
        if (icon) icon.textContent = '▶';
      }
    }
  }

  /**
   * Event delegation on the tree container
   * @param {HTMLElement} container 
   */
  function bindTreeEvents(container) {
    container.addEventListener('click', function (e) {
      // 1. Expand All button
      if (e.target.closest('#btn_tree_expand_all')) {
        expandAll();
        return;
      }

      // 2. Collapse All button
      if (e.target.closest('#btn_tree_collapse_all')) {
        collapseAll();
        return;
      }

      // 3. Toggle button on a node
      var toggleBtn = e.target.closest('.tree-toggle-btn');
      if (toggleBtn) {
        var nodeEl = toggleBtn.closest('.tree-node');
        if (nodeEl) {
          toggleNode(nodeEl);
        }
        e.stopPropagation();
        return;
      }

      // 4. Click anywhere on a node row
      var nodeRow = e.target.closest('.tree-node-row');
      if (nodeRow) {
        var nodeId = nodeRow.getAttribute('data-node-id');
        if (nodeId) {
          selectNode(nodeId, true);
        }
      }
    });

    // Keyboard navigation (Enter / Space to toggle/select)
    container.addEventListener('keydown', function (e) {
      var nodeRow = e.target.closest('.tree-node-row');
      if (!nodeRow) return;

      var nodeEl = nodeRow.closest('.tree-node');
      var nodeId = nodeRow.getAttribute('data-node-id');

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (nodeId) selectNode(nodeId, true);
        if (nodeEl && nodeEl.classList.contains('has-children')) {
          toggleNode(nodeEl);
        }
      } else if (e.key === 'ArrowRight' && nodeEl && nodeEl.classList.contains('has-children')) {
        if (nodeEl.classList.contains('tree-node-collapsed')) {
          toggleNode(nodeEl);
        }
      } else if (e.key === 'ArrowLeft' && nodeEl && nodeEl.classList.contains('has-children')) {
        if (!nodeEl.classList.contains('tree-node-collapsed')) {
          toggleNode(nodeEl);
        }
      }
    });
  }

  return {
    render: render,
    selectNode: selectNode,
    expandAll: expandAll,
    collapseAll: collapseAll
  };
})();
