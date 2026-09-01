/**
 * XML Invoice Validator - UI Controller Module
 * 
 * Manages visual state, tabs switching, notifications, theme toggling,
 * summary bar indicators, validation diagnostics rendering, and XML details.
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.UI = (function () {
  'use strict';

  var THEME_STORAGE_KEY = 'xml_validator_theme';
  var currentTab = 'validation';

  /**
   * Initialize theme from localStorage preference (only preference, no data)
   */
  function initTheme() {
    var savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (e) {
      // LocalStorage might be disabled or restricted in certain environments
    }

    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      updateThemeButtonLabel('dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      updateThemeButtonLabel('light');
    }
  }

  /**
   * Toggle between light and dark mode
   */
  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var nextTheme = current === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', nextTheme);
    updateThemeButtonLabel(nextTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (e) {
      // Ignore storage error
    }
  }

  /**
   * Update theme toggle button label/icon
   * @param {string} theme 
   */
  function updateThemeButtonLabel(theme) {
    var btn = document.getElementById('theme_toggle_btn');
    if (!btn) return;
    if (theme === 'dark') {
      btn.innerHTML = '<span>☀️</span><span>Light</span>';
      btn.setAttribute('title', 'Switch to Light theme');
    } else {
      btn.innerHTML = '<span>🌙</span><span>Dark</span>';
      btn.setAttribute('title', 'Switch to Dark theme');
    }
  }

  /**
   * Switch active tab in analysis panel
   * @param {string} tabId ('validation' | 'tree' | 'details' | 'comparison')
   */
  function switchTab(tabId) {
    currentTab = tabId;

    // Update tab button classes
    var buttons = document.querySelectorAll('.tab-button');
    buttons.forEach(function (btn) {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update tab pane visibility
    var panes = document.querySelectorAll('.tab-pane');
    panes.forEach(function (pane) {
      if (pane.id === 'tab_pane_' + tabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  }

  /**
   * Update the global summary status pill
   * @param {'NOT ANALYZED' | 'SYNTAX VALID' | 'INVALID XML' | 'VALID' | 'INVALID' | 'REVIEW REQUIRED'} status 
   */
  function updateStatus(status) {
    var statusPill = document.getElementById('global_status_pill');
    if (!statusPill) return;

    statusPill.textContent = status;
    statusPill.className = 'status-pill';

    switch (status) {
      case 'SYNTAX VALID':
      case 'VALID':
        statusPill.classList.add('status-valid');
        break;
      case 'INVALID XML':
      case 'INVALID':
        statusPill.classList.add('status-invalid');
        break;
      case 'REVIEW REQUIRED':
        statusPill.classList.add('status-review-required');
        break;
      case 'NOT ANALYZED':
      default:
        statusPill.classList.add('status-not-analyzed');
        break;
    }
  }

  /**
   * Update Summary Diagnostic Counters
   * @param {string|number} errors 
   * @param {string|number} warnings 
   * @param {string|number} info 
   */
  function updateCounters(errors, warnings, info) {
    var errorEl = document.getElementById('summary_errors_count');
    var warningEl = document.getElementById('summary_warnings_count');
    var infoEl = document.getElementById('summary_info_count');

    if (errorEl) errorEl.textContent = errors !== undefined ? errors : '—';
    if (warningEl) warningEl.textContent = warnings !== undefined ? warnings : '—';
    if (infoEl) infoEl.textContent = info !== undefined ? info : '—';
  }

  /**
   * Display a non-intrusive notification banner
   * @param {string} message 
   * @param {'info' | 'warning' | 'error'} type 
   * @param {number} [durationMs] 
   */
  var notificationTimer = null;
  function showNotification(message, type, durationMs) {
    var banner = document.getElementById('app_notification_banner');
    var textEl = document.getElementById('notification_text');
    if (!banner || !textEl) return;

    if (notificationTimer) {
      clearTimeout(notificationTimer);
      notificationTimer = null;
    }

    type = type || 'info';
    durationMs = durationMs || 4000;

    textEl.textContent = message;
    banner.className = 'notification-banner active ' + type;

    notificationTimer = setTimeout(function () {
      banner.className = 'notification-banner';
    }, durationMs);
  }

  /**
   * Render Validation Success view in Validation Results tab
   * Separates XML Syntax status, cXML/Coupa Structure status, and Reference Comparison cleanly
   * @param {Object} metadata 
   * @param {Object} [ruleResult]
   * @param {Object} [versionContext]
   * @param {Object} [structuralObservations]
   * @param {Object} [activeTemplate]
   */
  function renderValidationSuccess(metadata, ruleResult, versionContext, structuralObservations, activeTemplate) {
    var container = document.getElementById('tab_pane_validation');
    if (!container) return;

    var escapeHtml = XMLValidator.Utils.escapeHtml;

    // 1. XML Syntax Card
    var syntaxCardHtml = [
      '<div class="syntax-success-card">',
      '  <div class="syntax-success-header">',
      '    <div class="success-icon-badge" aria-hidden="true">✓</div>',
      '    <div class="success-title-group">',
      '      <div class="success-title">XML Syntax Valid</div>',
      '      <div class="success-description">The document is well-formed XML and was parsed successfully.</div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    // 2. cXML / Coupa Structure Card
    var coupaSectionHtml = '';
    if (!ruleResult || ruleResult.totalRules === 0) {
      coupaSectionHtml = [
        '<div class="coupa-validation-status-card">',
        '  <div class="coupa-validation-status-header">',
        '    <div class="coupa-status-title-group">',
        '      <span class="coupa-status-title">cXML / Coupa Structure</span>',
        '    </div>',
        '    <span class="coupa-badge-unavailable">NOT AVAILABLE</span>',
        '  </div>',
        '  <div class="coupa-validation-status-body">',
        '    No validation rules currently registered.',
        '  </div>',
        '</div>'
      ].join('\n');
    } else {
      var isSuccess = ruleResult.findingsSummary.errors === 0 && (!ruleResult.systemIssues || ruleResult.systemIssues.length === 0);
      var hasSystemIssues = ruleResult.systemIssues && ruleResult.systemIssues.length > 0;
      var hasErrors = ruleResult.findingsSummary.errors > 0;

      var statusTitle = 'STRUCTURAL CHECKS PASSED';
      var statusBadgeClass = 'coupa-badge-unavailable';
      var statusBadgeText = ruleResult.executedRules + ' rules evaluated';

      if (hasSystemIssues) {
        statusTitle = 'VALIDATION INCOMPLETE';
        statusBadgeText = 'System issues';
      } else if (hasErrors) {
        statusTitle = 'ISSUES FOUND';
        statusBadgeText = ruleResult.findingsSummary.errors + ' error(s) found';
      }

      // Mandatory Disclaimer Box
      var disclaimerHtml = [
        '<div class="coupa-disclaimer-box">',
        '  <strong>Scope Notice:</strong> Only locally verifiable cXML/Coupa structural requirements are checked. Full transactional validity requires buyer/supplier setup in Coupa.',
        '</div>'
      ].join('\n');

      // Version Context Grid
      var versionContextHtml = '';
      if (versionContext) {
        versionContextHtml = [
          '<div style="margin-top: 8px;">',
          '  <span class="version-badge-label">Version Context</span>',
          '  <div class="version-context-grid">',
          '    <div class="version-badge-item"><span class="version-badge-label">XML Declaration</span><span class="version-badge-val">' + escapeHtml(versionContext.xmlDeclarationVersion || 'Not declared (default 1.0)') + '</span></div>',
          '    <div class="version-badge-item"><span class="version-badge-label">cXML Root Version</span><span class="version-badge-val">' + escapeHtml(versionContext.rootVersionAttribute || 'Not specified') + '</span></div>',
          '    <div class="version-badge-item"><span class="version-badge-label">DTD Version</span><span class="version-badge-val">' + escapeHtml(versionContext.dtdVersion || 'Not referenced') + '</span></div>',
          '    <div class="version-badge-item"><span class="version-badge-label">DTD System ID</span><span class="version-badge-val" style="font-size:10px; word-break:break-all;">' + escapeHtml(versionContext.dtdSystemIdentifier || 'None') + '</span></div>',
          '  </div>',
          '</div>'
        ].join('\n');
      }

      // Structural Observations (Non-error facts)
      var observationsHtml = '';
      if (structuralObservations) {
        var backingDesc = 'Unbacked / No PO';
        if (structuralObservations.orderReferencePresent) {
          backingDesc = 'PO-backed (' + (structuralObservations.orderReferencePayloadID || 'OrderReference') + ')';
        } else if (structuralObservations.masterAgreementReferencePresent) {
          backingDesc = 'Contract-backed (' + (structuralObservations.masterAgreementPayloadID || 'MasterAgreementReference') + ')';
        }

        observationsHtml = [
          '<div style="margin-top: 12px;">',
          '  <span class="version-badge-label">Structural Observations (Non-Error Profile)</span>',
          '  <div class="obs-grid">',
          '    <div class="obs-badge-item"><span class="obs-badge-label">Document Purpose</span><span class="obs-badge-val">' + escapeHtml(structuralObservations.purpose || 'standard') + '</span></div>',
          '    <div class="obs-badge-item"><span class="obs-badge-label">Backing Observed</span><span class="obs-badge-val">' + escapeHtml(backingDesc) + '</span></div>',
          '    <div class="obs-badge-item"><span class="obs-badge-label">Invoice Lines</span><span class="obs-badge-val">' + structuralObservations.invoiceDetailItemCount + ' standard / ' + structuralObservations.invoiceDetailServiceItemCount + ' service</span></div>',
          '    <div class="obs-badge-item"><span class="obs-badge-label">Tax Observed</span><span class="obs-badge-val">' + (structuralObservations.taxAtLine ? 'Line Tax' : '') + (structuralObservations.taxAtLine && structuralObservations.taxAtSummary ? ' + ' : '') + (structuralObservations.taxAtSummary ? 'Summary Tax' : '') + (!structuralObservations.taxAtLine && !structuralObservations.taxAtSummary ? 'None' : '') + '</span></div>',
          '    <div class="obs-badge-item"><span class="obs-badge-label">Shared Secret</span><span class="obs-badge-val">' + (structuralObservations.sharedSecretPresent ? 'Observed in Sender' : 'Not provided') + '</span></div>',
          '  </div>',
          '</div>'
        ].join('\n');
      }

      // Findings rendering
      var findingsHtml = [];
      if (ruleResult.findings && ruleResult.findings.length > 0) {
        for (var f = 0; f < ruleResult.findings.length; f++) {
          var finding = ruleResult.findings[f];
          var cardClass = finding.severity === 'error' ? 'error-card' : (finding.severity === 'warning' ? 'warning-card' : 'info-card');
          var badgeClass = finding.severity === 'error' ? 'badge-error' : (finding.severity === 'warning' ? 'badge-warning' : 'badge-info');

          var viewNodeBtn = '';
          if (finding.nodeId) {
            viewNodeBtn = '<button type="button" class="finding-btn-view-node" data-node-id="' + escapeHtml(finding.nodeId) + '">🔍 View in Tree</button>';
          }

          var correctionHtml = '';
          if (finding.correction) {
            var exp = finding.correction.expected;
            var act = finding.correction.actual;
            var sug = finding.correction.suggestion;

            correctionHtml = [
              '<div class="finding-correction-box">',
              exp ? '<div class="correction-row"><span class="correction-label">Expected:</span><span class="correction-val expected-val">' + escapeHtml(exp) + '</span></div>' : '',
              act ? '<div class="correction-row"><span class="correction-label">Actual:</span><span class="correction-val actual-val">' + escapeHtml(act) + '</span></div>' : '',
              sug ? '<div class="correction-row"><span class="correction-label">Suggestion:</span><span class="correction-val suggestion-val">' + escapeHtml(sug) + '</span></div>' : '',
              '</div>'
            ].join('\n');
          }

          var provenanceHtml = '';
          if (finding.source) {
            provenanceHtml = [
              '<div class="finding-provenance-box">',
              '  <span class="finding-provenance-title">Source: ' + escapeHtml(finding.source.type || 'DOCUMENTATION') + '</span>',
              '  <span class="finding-provenance-content">' + escapeHtml(finding.source.title) + (finding.source.reference ? ' (' + escapeHtml(finding.source.reference) + ')' : '') + '</span>',
              '</div>'
            ].join('\n');
          }

          findingsHtml.push(
            '<div class="' + cardClass + '">' +
            '  <div class="' + cardClass + '-header">' +
            '    <div class="error-badges-group">' +
            '      <span class="' + badgeClass + '">' + escapeHtml(finding.severity.toUpperCase()) + '</span>' +
            '      <span class="badge-code">' + escapeHtml(finding.code) + '</span>' +
            '    </div>' +
            (finding.path ? '    <div class="error-meta-tags"><span class="meta-pill">' + escapeHtml(finding.path) + '</span></div>' : '') +
            '  </div>' +
            '  <div class="error-card-body">' +
            '    <div class="error-card-title">' + escapeHtml(finding.title) + '</div>' +
            '    <div class="error-card-message">' + escapeHtml(finding.message) + '</div>' +
            correctionHtml +
            provenanceHtml +
            (viewNodeBtn ? '<div style="margin-top:4px;">' + viewNodeBtn + '</div>' : '') +
            '  </div>' +
            '</div>'
          );
        }
      }

      var sysIssuesHtml = [];
      if (ruleResult.systemIssues && ruleResult.systemIssues.length > 0) {
        for (var s = 0; s < ruleResult.systemIssues.length; s++) {
          var sys = ruleResult.systemIssues[s];
          sysIssuesHtml.push(
            '<div class="warning-card">' +
            '  <div class="warning-card-header">' +
            '    <span class="badge-warning">SYSTEM ISSUE</span>' +
            '    <span class="badge-code">' + escapeHtml(sys.code) + '</span>' +
            '  </div>' +
            '  <div class="error-card-body">' +
            '    <div class="error-card-title">Rule Execution Incomplete (' + escapeHtml(sys.ruleId) + ')</div>' +
            '    <div class="error-card-message">' + escapeHtml(sys.message) + '</div>' +
            (sys.technicalDetails ? '<details class="technical-details-box"><summary class="technical-details-summary"><span>⚙ Details</span></summary><div class="technical-details-content">' + escapeHtml(sys.technicalDetails) + '</div></details>' : '') +
            '  </div>' +
            '</div>'
          );
        }
      }

      var passingNotesHtml = '';
      if (isSuccess) {
        passingNotesHtml = '<div style="font-size:12px; color:var(--color-success-text); font-weight:600; padding:4px 0;">✓ All ' + ruleResult.executedRules + ' local cXML / Coupa structural rules passed without errors.</div>';
      }

      coupaSectionHtml = [
        '<div class="coupa-validation-status-card">',
        '  <div class="coupa-validation-status-header">',
        '    <div class="coupa-status-title-group">',
        '      <span class="coupa-status-title">cXML / Coupa Structure: ' + escapeHtml(statusTitle) + '</span>',
        '    </div>',
        '    <span class="meta-pill">' + escapeHtml(statusBadgeText) + '</span>',
        '  </div>',
        '  <div class="coupa-validation-status-body">',
        disclaimerHtml,
        passingNotesHtml,
        versionContextHtml,
        observationsHtml,
        findingsHtml.length > 0 ? '<div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">' + findingsHtml.join('\n') + '</div>' : '',
        sysIssuesHtml.length > 0 ? sysIssuesHtml.join('\n') : '',
        '  </div>',
        '</div>'
      ].join('\n');
    }

    // 3. Reference Comparison summary section
    var refSectionHtml = [
      '<div class="coupa-validation-status-card">',
      '  <div class="coupa-validation-status-header">',
      '    <div class="coupa-status-title-group">',
      '      <span class="coupa-status-title">Reference Comparison</span>',
      '    </div>',
      '    <span class="meta-pill">' + (activeTemplate ? escapeHtml(activeTemplate.name) : 'No reference active') + '</span>',
      '  </div>',
      '  <div class="coupa-validation-status-body">',
      activeTemplate ? '<p>Comparing against official Coupa template: <strong>' + escapeHtml(activeTemplate.name) + '</strong> (' + escapeHtml(activeTemplate.id) + '). Switch to the <em>Reference Comparison</em> tab for side-by-side AST diff analysis.</p>' : '<p>Select an official Coupa reference template from the catalog to run differential AST analysis against baseline samples.</p>',
      '  </div>',
      '</div>'
    ].join('\n');

    var html = [
      '<div class="diagnostics-wrapper">',
      '  <div class="validation-results-group">',
      syntaxCardHtml,
      coupaSectionHtml,
      refSectionHtml,
      '  </div>',
      '</div>'
    ].join('\n');

    container.innerHTML = html;

    // Bind any view-in-tree buttons
    var viewBtns = container.querySelectorAll('.finding-btn-view-node');
    for (var v = 0; v < viewBtns.length; v++) {
      viewBtns[v].addEventListener('click', function () {
        var nId = this.getAttribute('data-node-id');
        if (nId && window.XMLValidator && window.XMLValidator.App) {
          window.XMLValidator.UI.switchTab('tree');
          window.XMLValidator.App.selectNode(nId);
        }
      });
    }
  }

  /**
   * Render Validation Error Card in Validation Results tab
   * @param {Object} error 
   */
  function renderValidationError(error) {
    var container = document.getElementById('tab_pane_validation');
    if (!container) return;

    var escapeHtml = XMLValidator.Utils.escapeHtml;

    var locationTags = '';
    if (error.line !== null && error.line !== undefined) {
      locationTags += '<span class="meta-pill meta-pill-accent">Line ' + error.line + '</span>';
    }
    if (error.column !== null && error.column !== undefined) {
      locationTags += '<span class="meta-pill">Column ' + error.column + '</span>';
    }

    var snippetHtml = '';
    if (error.snippet && error.snippet.lines && error.snippet.lines.length > 0) {
      var linesHtml = [];
      for (var i = 0; i < error.snippet.lines.length; i++) {
        var lineObj = error.snippet.lines[i];
        var isErr = lineObj.isError;
        var lineClass = isErr ? 'snippet-line error-line' : 'snippet-line';
        var indicator = isErr ? '▶ ' : '  ';
        linesHtml.push(
          '<div class="' + lineClass + '">' +
          '  <span class="snippet-num">' + indicator + lineObj.lineNumber + '</span>' +
          '  <span class="snippet-code">' + escapeHtml(lineObj.text) + '</span>' +
          '</div>'
        );
      }

      snippetHtml = [
        '<div class="snippet-box" aria-label="Code snippet showing error line">',
        linesHtml.join('\n'),
        '</div>'
      ].join('\n');
    }

    var technicalDetailsHtml = '';
    if (error.technicalDetails) {
      technicalDetailsHtml = [
        '<details class="technical-details-box">',
        '  <summary class="technical-details-summary">',
        '    <span>⚙ Technical Details (DOMParser Output)</span>',
        '  </summary>',
        '  <div class="technical-details-content">' + escapeHtml(error.technicalDetails) + '</div>',
        '</details>'
      ].join('\n');
    }

    var html = [
      '<div class="diagnostics-wrapper">',
      '  <div class="error-card">',
      '    <div class="error-card-header">',
      '      <div class="error-badges-group">',
      '        <span class="badge-error">ERROR</span>',
      '        <span class="badge-code">' + escapeHtml(error.code) + '</span>',
      '      </div>',
      locationTags ? '      <div class="error-meta-tags">' + locationTags + '</div>' : '',
      '    </div>',
      '    <div class="error-card-body">',
      '      <div class="error-card-title">' + escapeHtml(error.title) + '</div>',
      '      <div class="error-card-message">' + escapeHtml(error.message) + '</div>',
      snippetHtml,
      '      <div class="suggestion-box">',
      '        <span class="suggestion-icon">💡</span>',
      '        <div class="suggestion-content">',
      '          <span class="suggestion-title">Troubleshooting Suggestion</span>',
      '          <span class="suggestion-text">' + escapeHtml(error.suggestion || 'Review the XML syntax around the reported line.') + '</span>',
      '        </div>',
      '      </div>',
      technicalDetailsHtml,
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n');

    container.innerHTML = html;
  }

  /**
   * Copy path to clipboard with file:// fallback
   * @param {string} path 
   */
  function copyPathToClipboard(path) {
    if (!path) return;

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(path).then(function () {
        showNotification('Path copied: ' + path, 'info', 3000);
      }).catch(function () {
        fallbackCopyText(path);
      });
    } else {
      fallbackCopyText(path);
    }
  }

  /**
   * Fallback copy text using textarea execCommand
   * @param {string} text 
   */
  function fallbackCopyText(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.left = '-9999px';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        showNotification('Path copied: ' + text, 'info', 3000);
      } else {
        showNotification('Unable to copy automatically. Path: ' + text, 'warning', 4000);
      }
    } catch (e) {
      showNotification('Unable to copy automatically. Path: ' + text, 'warning', 4000);
    }
  }

  /**
   * Render XML Details tab with document overview or selected node details
   * @param {Object} parseResult 
   * @param {Object} analysisResult 
   * @param {{ lines: number, chars: number }} metrics 
   * @param {string|null} selectedNodeId 
   */
  function renderXmlDetails(parseResult, analysisResult, metrics, selectedNodeId) {
    var container = document.getElementById('tab_pane_details');
    if (!container) return;

    var escapeHtml = XMLValidator.Utils.escapeHtml;

    if (!parseResult || !parseResult.success) {
      container.innerHTML = [
        '<div class="empty-state">',
        '  <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">',
        '    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
        '  </svg>',
        '  <div class="empty-state-title">No Metadata Available</div>',
        '  <p class="empty-state-text">Validate a syntactically valid XML document to inspect its structure and declaration details.</p>',
        '</div>'
      ].join('\n');
      return;
    }

    var selectedNode = null;
    if (selectedNodeId && analysisResult && analysisResult.nodeIndex && analysisResult.nodeIndex[selectedNodeId]) {
      selectedNode = analysisResult.nodeIndex[selectedNodeId];
    }

    // STATE 1: SELECTED NODE VIEW
    if (selectedNode) {
      var prefixVal = selectedNode.prefix ? escapeHtml(selectedNode.prefix) : '<span class="metadata-badge-unspecified">Not specified</span>';
      var nsVal = selectedNode.namespaceURI ? escapeHtml(selectedNode.namespaceURI) : '<span class="metadata-badge-unspecified">Not specified</span>';
      var siblingPositionText = selectedNode.siblingCount > 1
        ? selectedNode.siblingIndex + ' of ' + selectedNode.siblingCount + ' (repeated sibling)'
        : 'Single element under parent';

      // Attributes table
      var attrsHtml = '';
      if (selectedNode.attributes && selectedNode.attributes.length > 0) {
        var attrRows = [];
        for (var a = 0; a < selectedNode.attributes.length; a++) {
          var attr = selectedNode.attributes[a];
          attrRows.push(
            '<tr>' +
            '  <td class="metadata-label"><code>' + escapeHtml(attr.name) + '</code></td>' +
            '  <td class="metadata-value"><code>' + escapeHtml(attr.value) + '</code></td>' +
            '</tr>'
          );
        }
        attrsHtml = '<table class="metadata-table"><tbody>' + attrRows.join('\n') + '</tbody></table>';
      } else {
        attrsHtml = '<div class="metadata-empty-note">No attributes declared on this element.</div>';
      }

      // Direct text card
      var directTextSection = '';
      if (selectedNode.directText !== '') {
        directTextSection = [
          '<div class="metadata-section-card">',
          '  <div class="metadata-card-header">',
          '    <span>Direct Text & CDATA Content</span>',
          '    <span class="meta-pill">' + selectedNode.directText.length + ' chars</span>',
          '  </div>',
          '  <div class="node-direct-text-box">' + escapeHtml(selectedNode.directText) + '</div>',
          '</div>'
        ].join('\n');
      }

      // Direct children overview
      var childrenSection = '';
      if (selectedNode.hasElementChildren) {
        var childTags = [];
        for (var c = 0; c < selectedNode.children.length; c++) {
          var ch = selectedNode.children[c];
          var idxLabel = ch.isRepeatedSibling ? ' [' + ch.siblingIndex + ']' : '';
          childTags.push(
            '<button type="button" class="node-child-tag-btn" data-target-node-id="' + escapeHtml(ch.id) + '">' +
            '  &lt;' + escapeHtml(ch.name) + idxLabel + '&gt;' +
            '</button>'
          );
        }
        childrenSection = [
          '<div class="metadata-section-card">',
          '  <div class="metadata-card-header">',
          '    <span>Direct Child Elements (' + selectedNode.childCount + ')</span>',
          '  </div>',
          '  <div class="node-children-tag-list">' + childTags.join('\n') + '</div>',
          '</div>'
        ].join('\n');
      } else {
        childrenSection = [
          '<div class="metadata-section-card">',
          '  <div class="metadata-card-header">',
          '    <span>Child Elements</span>',
          '  </div>',
          '  <div class="metadata-empty-note">Leaf element (no child elements).</div>',
          '</div>'
        ].join('\n');
      }

      var nodeDetailsHtml = [
        '<div class="diagnostics-wrapper">',
        '  <div class="node-selection-bar">',
        '    <div class="node-selection-title-group">',
        '      <span class="badge-code">Selected Node</span>',
        '      <span class="selected-node-tag-display">&lt;<strong>' + escapeHtml(selectedNode.name) + '</strong>&gt;</span>',
        '    </div>',
        '    <button type="button" id="btn_clear_node_selection" class="btn-clear-selection" title="Switch back to Document Overview">',
        '      ✕ Document Overview',
        '    </button>',
        '  </div>',
        '',
        '  <div class="metadata-section-card">',
        '    <div class="metadata-card-header">',
        '      <span>Element Identity & Path</span>',
        '      <button type="button" id="btn_copy_xpath" class="btn-copy-path" data-path="' + escapeHtml(selectedNode.path) + '" title="Copy XPath-like path to clipboard">',
        '        📋 Copy Path',
        '      </button>',
        '    </div>',
        '    <table class="metadata-table">',
        '      <tbody>',
        '        <tr>',
        '          <td class="metadata-label">XPath-like Path</td>',
        '          <td class="metadata-value"><code>' + escapeHtml(selectedNode.path) + '</code></td>',
        '        </tr>',
        '        <tr>',
        '          <td class="metadata-label">Element Name</td>',
        '          <td class="metadata-value"><strong>&lt;' + escapeHtml(selectedNode.name) + '&gt;</strong></td>',
        '        </tr>',
        '        <tr>',
        '          <td class="metadata-label">Local Name</td>',
        '          <td class="metadata-value">' + escapeHtml(selectedNode.localName) + '</td>',
        '        </tr>',
        '        <tr>',
        '          <td class="metadata-label">Namespace Prefix</td>',
        '          <td class="metadata-value">' + prefixVal + '</td>',
        '        </tr>',
        '        <tr>',
        '          <td class="metadata-label">Namespace URI</td>',
        '          <td class="metadata-value">' + nsVal + '</td>',
        '        </tr>',
        '        <tr>',
        '          <td class="metadata-label">Hierarchy Depth</td>',
        '          <td class="metadata-value">' + selectedNode.depth + '</td>',
        '        </tr>',
        '        <tr>',
        '          <td class="metadata-label">Sibling Position</td>',
        '          <td class="metadata-value">' + escapeHtml(siblingPositionText) + '</td>',
        '        </tr>',
        '      </tbody>',
        '    </table>',
        '  </div>',
        '',
        directTextSection,
        '',
        '  <div class="metadata-section-card">',
        '    <div class="metadata-card-header">',
        '      <span>Element Attributes (' + selectedNode.attributes.length + ')</span>',
        '    </div>',
        attrsHtml,
        '  </div>',
        '',
        childrenSection,
        '</div>'
      ].join('\n');

      container.innerHTML = nodeDetailsHtml;

      // Bind events for Details tab
      var copyBtn = document.getElementById('btn_copy_xpath');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          var p = this.getAttribute('data-path');
          copyPathToClipboard(p);
        });
      }

      var clearSelectionBtn = document.getElementById('btn_clear_node_selection');
      if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', function () {
          if (window.XMLValidator && window.XMLValidator.App) {
            window.XMLValidator.App.clearNodeSelection();
          }
        });
      }

      // Bind child tag buttons to navigate tree
      var childTagBtns = container.querySelectorAll('.node-child-tag-btn');
      for (var b = 0; b < childTagBtns.length; b++) {
        childTagBtns[b].addEventListener('click', function () {
          var tId = this.getAttribute('data-target-node-id');
          if (tId && window.XMLValidator && window.XMLValidator.App) {
            window.XMLValidator.App.selectNode(tId);
          }
        });
      }

      return;
    }

    // STATE 2: DOCUMENT OVERVIEW VIEW
    var meta = parseResult.metadata || {};
    var decl = meta.declaration || {};
    var root = meta.root || {};
    var namespaces = meta.namespaces || [];
    var stats = analysisResult ? analysisResult.statistics : null;

    var declBadge = meta.hasXmlDeclaration
      ? '<span class="metadata-badge-specified">Present</span>'
      : '<span class="metadata-badge-unspecified">Not specified</span>';

    var versionVal = decl.version ? escapeHtml(decl.version) : '<span class="metadata-badge-unspecified">Not specified</span>';
    var encodingVal = decl.encoding ? escapeHtml(decl.encoding) : '<span class="metadata-badge-unspecified">Not specified</span>';
    var standaloneVal = decl.standalone ? escapeHtml(decl.standalone) : '<span class="metadata-badge-unspecified">Not specified</span>';

    var rootName = root.name ? escapeHtml(root.name) : '<span class="metadata-badge-unspecified">None</span>';
    var rootLocal = root.localName ? escapeHtml(root.localName) : '<span class="metadata-badge-unspecified">None</span>';
    var rootPrefix = root.prefix ? escapeHtml(root.prefix) : '<span class="metadata-badge-unspecified">None (default)</span>';
    var rootNs = root.namespaceURI ? escapeHtml(root.namespaceURI) : '<span class="metadata-badge-unspecified">None</span>';

    // Statistics section
    var statsSection = '';
    if (stats) {
      statsSection = [
        '<div class="metadata-section-card">',
        '  <div class="metadata-card-header">',
        '    <span>Structural Statistics</span>',
        '  </div>',
        '  <table class="metadata-table">',
        '    <tbody>',
        '      <tr>',
        '        <td class="metadata-label">Total Elements</td>',
        '        <td class="metadata-value"><strong>' + stats.totalElements.toLocaleString() + '</strong></td>',
        '      </tr>',
        '      <tr>',
        '        <td class="metadata-label">Total Attributes</td>',
        '        <td class="metadata-value">' + stats.totalAttributes.toLocaleString() + '</td>',
        '      </tr>',
        '      <tr>',
        '        <td class="metadata-label">Maximum Tree Depth</td>',
        '        <td class="metadata-value">' + stats.maxDepth + '</td>',
        '      </tr>',
        '      <tr>',
        '        <td class="metadata-label">Unique Element Names</td>',
        '        <td class="metadata-value">' + stats.uniqueElementNames + '</td>',
        '      </tr>',
        '      <tr>',
        '        <td class="metadata-label">Repeated Sibling Groups</td>',
        '        <td class="metadata-value">' + stats.repeatedElementGroups + '</td>',
        '      </tr>',
        '      <tr>',
        '        <td class="metadata-label">Elements with Direct Text</td>',
        '        <td class="metadata-value">' + stats.totalTextNodes + '</td>',
        '      </tr>',
        '    </tbody>',
        '  </table>',
        '</div>'
      ].join('\n');
    }

    var namespacesHtml = '';
    if (namespaces.length > 0) {
      var nsItems = [];
      for (var i = 0; i < namespaces.length; i++) {
        var ns = namespaces[i];
        var prefixLabel = ns.prefix ? 'xmlns:' + escapeHtml(ns.prefix) : 'xmlns (default)';
        nsItems.push(
          '<div class="namespace-item">' +
          '  <span class="ns-prefix">' + prefixLabel + '</span>' +
          '  <span class="ns-uri">' + escapeHtml(ns.uri) + '</span>' +
          '</div>'
        );
      }
      namespacesHtml = '<div class="namespaces-list">' + nsItems.join('\n') + '</div>';
    } else {
      namespacesHtml = '<div class="metadata-empty-note">No namespaces declared on the root element.</div>';
    }

    var overviewHtml = [
      '<div class="diagnostics-wrapper">',
      '  <div class="metadata-section-card">',
      '    <div class="metadata-card-header">',
      '      <span>Document Overview & Declaration</span>',
      '    </div>',
      '    <table class="metadata-table">',
      '      <tbody>',
      '        <tr>',
      '          <td class="metadata-label">XML Declaration</td>',
      '          <td class="metadata-value">' + declBadge + '</td>',
      '        </tr>',
      '        <tr>',
      '          <td class="metadata-label">XML Version</td>',
      '          <td class="metadata-value">' + versionVal + '</td>',
      '        </tr>',
      '        <tr>',
      '          <td class="metadata-label">Declared Encoding</td>',
      '          <td class="metadata-value">' + encodingVal + '</td>',
      '        </tr>',
      '        <tr>',
      '          <td class="metadata-label">Standalone</td>',
      '          <td class="metadata-value">' + standaloneVal + '</td>',
      '        </tr>',
      '        <tr>',
      '          <td class="metadata-label">Total Lines</td>',
      '          <td class="metadata-value">' + (metrics && metrics.lines ? metrics.lines.toLocaleString() : '—') + '</td>',
      '        </tr>',
      '        <tr>',
      '          <td class="metadata-label">Total Characters</td>',
      '          <td class="metadata-value">' + (metrics && metrics.chars ? metrics.chars.toLocaleString() : '—') + '</td>',
      '        </tr>',
      '      </tbody>',
      '    </table>',
      '  </div>',
      '',
      statsSection,
      '',
      '  <div class="metadata-section-card">',
      '    <div class="metadata-card-header">',
      '      <span>Root Element</span>',
      '    </div>',
      '    <table class="metadata-table">',
      '      <tbody>',
      '        <tr>',
      '          <td class="metadata-label">Root Tag</td>',
      '          <td class="metadata-value"><strong>&lt;' + rootName + '&gt;</strong></td>',
      '        </tr>',
      '        <tr>',
      '          <td class="metadata-label">Local Name</td>',
      '          <td class="metadata-value">' + rootLocal + '</td>',
      '        </tr>',
      '        <tr>',
      '          <td class="metadata-label">Prefix</td>',
      '          <td class="metadata-value">' + rootPrefix + '</td>',
      '        </tr>',
      '        <tr>',
      '          <td class="metadata-label">Namespace URI</td>',
      '          <td class="metadata-value">' + rootNs + '</td>',
      '        </tr>',
      '      </tbody>',
      '    </table>',
      '  </div>',
      '',
      '  <div class="metadata-section-card">',
      '    <div class="metadata-card-header">',
      '      <span>Declared Namespaces (' + namespaces.length + ')</span>',
      '    </div>',
      namespacesHtml,
      '  </div>',
      '</div>'
    ].join('\n');

    container.innerHTML = overviewHtml;
  }

  /**
   * Render Template Comparison Tab Pane
   * @param {Object|null} activeReference { sourceType, templateId, template, fileName, rawXml, parseResult, analysisResult, error }
   * @param {Object|null} sourceAnalysis 
   * @param {Object|null} comparisonResult 
   * @param {Object} [callbacks] 
   * @param {string} [currentViewMode] 'COUPA_TEMPLATE' | 'CUSTOM_REFERENCE'
   */
  function renderComparisonView(activeReference, sourceAnalysis, comparisonResult, callbacks, currentViewMode) {
    var container = document.getElementById('tab_pane_comparison');
    if (!container) return;

    var escapeHtml = XMLValidator.Utils.escapeHtml;
    callbacks = callbacks || {};

    // Determine current view mode (Coupa Template vs Custom Reference)
    var viewMode = currentViewMode || (activeReference && activeReference.sourceType) || 'COUPA_TEMPLATE';
    var isCoupaMode = viewMode === 'COUPA_TEMPLATE';

    // 1. Reference Source Switcher
    var sourceSwitcherHtml = [
      '<div class="reference-source-toggle">',
      '  <span class="reference-source-label">REFERENCE SOURCE:</span>',
      '  <div class="reference-radio-group">',
      '    <label class="reference-radio-item">',
      '      <input type="radio" name="ref_source_type" value="COUPA_TEMPLATE"' + (isCoupaMode ? ' checked' : '') + ' id="radio_ref_coupa" />',
      '      <span>Coupa Reference</span>',
      '    </label>',
      '    <label class="reference-radio-item">',
      '      <input type="radio" name="ref_source_type" value="CUSTOM_REFERENCE"' + (!isCoupaMode ? ' checked' : '') + ' id="radio_ref_custom" />',
      '      <span>Custom Reference</span>',
      '    </label>',
      '  </div>',
      '</div>'
    ].join('\n');

    // 2. Reference Selection / Configuration Body
    var refConfigHtml = '';

    if (isCoupaMode) {
      // Coupa Reference Catalog view
      var catalog = XMLValidator.TemplateCatalog ? XMLValidator.TemplateCatalog.getAll() : [];
      var categories = XMLValidator.TemplateCatalog ? XMLValidator.TemplateCatalog.getCategories() : [];

      if (catalog.length === 0) {
        refConfigHtml = [
          '<div class="coupa-template-picker-row">',
          '  <div class="empty-state" style="padding: 24px 16px;">',
          '    <div class="empty-state-title" style="font-size: 13px;">No Coupa References Available</div>',
          '    <p class="empty-state-text">No official Coupa reference templates are loaded in the catalog at this time. You can import an external XML file using <strong>Custom Reference</strong> above.</p>',
          '  </div>',
          '</div>'
        ].join('\n');
      } else {
        // Build category options
        var catOptions = ['<option value="">All Categories (' + catalog.length + ')</option>'];
        for (var c = 0; c < categories.length; c++) {
          catOptions.push('<option value="' + escapeHtml(categories[c].id) + '">' + escapeHtml(categories[c].label) + ' (' + categories[c].count + ')</option>');
        }

        // Build template options
        var tplOptions = ['<option value="">-- Select a Coupa Reference Template --</option>'];
        var currentTplId = activeReference && activeReference.templateId ? activeReference.templateId : '';

        for (var t = 0; t < catalog.length; t++) {
          var tpl = catalog[t];
          var isSelected = tpl.id === currentTplId ? ' selected' : '';
          tplOptions.push('<option value="' + escapeHtml(tpl.id) + '"' + isSelected + '>' + escapeHtml(tpl.name) + ' [' + escapeHtml(tpl.categoryLabel || tpl.category) + ']</option>');
        }

        var tplSelectHtml = [
          '<div class="coupa-template-picker-row">',
          '  <div class="coupa-template-select-group">',
          '    <select id="coupa_category_filter" class="coupa-category-filter">',
          catOptions.join('\n'),
          '    </select>',
          '    <select id="coupa_template_select" class="coupa-template-select">',
          tplOptions.join('\n'),
          '    </select>',
          '  </div>',
          '</div>'
        ].join('\n');

        // Template metadata detail card if a template is active
        var tplDetailHtml = '';
        if (activeReference && activeReference.template) {
          var tObj = activeReference.template;
          var refStats = activeReference.analysisResult && activeReference.analysisResult.statistics ? activeReference.analysisResult.statistics : { totalElements: 0, totalAttributes: 0 };

          tplDetailHtml = [
            '<div class="template-info-box">',
            '  <div class="template-info-header">',
            '    <div class="template-info-name">📑 ' + escapeHtml(tObj.name) + '</div>',
            '    <span class="template-info-badge">' + escapeHtml(tObj.categoryLabel || tObj.category) + '</span>',
            '  </div>',
            (tObj.description ? '  <div class="template-info-desc">' + escapeHtml(tObj.description) + '</div>' : ''),
            (tObj.documentNote ? '  <div class="template-document-note" style="font-size:11px; color:var(--text-muted); font-style:italic; margin-bottom:8px;">Document note: ' + escapeHtml(tObj.documentNote) + '</div>' : ''),
            '  <div class="template-info-grid">',
            '    <div class="template-info-cell"><span class="template-cell-label">Publisher:</span><span class="template-cell-value">' + escapeHtml(tObj.publisher || 'Coupa') + '</span></div>',
            '    <div class="template-info-cell"><span class="template-cell-label">Source Type:</span><span class="template-cell-value">' + escapeHtml(tObj.sourceType || 'OFFICIAL_DOCUMENTATION') + '</span></div>',
            '    <div class="template-info-cell"><span class="template-cell-label">Elements:</span><span class="template-cell-value">' + (refStats.totalElements || 0).toLocaleString() + '</span></div>',
            '    <div class="template-info-cell"><span class="template-cell-label">Comparison:</span><span class="template-cell-value">' + escapeHtml(tObj.comparisonMode || 'STRUCTURE_ONLY') + '</span></div>',
            '  </div>',
            '  <button type="button" class="template-toggle-source-btn" id="btn_toggle_source_info">',
            '    <span>ℹ</span><span>View Source Information</span>',
            '  </button>',
            '  <div id="template_source_details_box" class="template-source-details-box" style="display: none;">',
            '    <div class="template-source-row"><span class="template-source-label">Publisher:</span><span class="template-source-val">' + escapeHtml(tObj.publisher || 'Coupa') + '</span></div>',
            (tObj.sourceTitle ? '    <div class="template-source-row"><span class="template-source-label">Source Title:</span><span class="template-source-val">' + escapeHtml(tObj.sourceTitle) + '</span></div>' : ''),
            (tObj.sourceUrl ? '    <div class="template-source-row"><span class="template-source-label">Source URL:</span><span class="template-source-val">' + escapeHtml(tObj.sourceUrl) + ' <a href="' + escapeHtml(tObj.sourceUrl) + '" target="_blank" rel="noopener noreferrer" class="template-source-link">(Open Link)</a></span></div>' : ''),
            (tObj.retrievedDate ? '    <div class="template-source-row"><span class="template-source-label">Retrieved Date:</span><span class="template-source-val">' + escapeHtml(tObj.retrievedDate) + '</span></div>' : ''),
            (tObj.version ? '    <div class="template-source-row"><span class="template-source-label">Version:</span><span class="template-source-val">' + escapeHtml(tObj.version) + '</span></div>' : ''),
            '    <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">Note: Source links are metadata for reference provenance only. The application operates 100% offline.</div>',
            '  </div>',
            '</div>'
          ].join('\n');
        }

        refConfigHtml = tplSelectHtml + tplDetailHtml;
      }
    } else {
      // Custom Reference view (FileReader)
      if (!activeReference || !activeReference.analysisResult || !activeReference.analysisResult.tree) {
        refConfigHtml = [
          '<div style="padding: 12px 0;">',
          '  <p class="empty-state-text" style="margin-bottom: 12px;">Import a custom XML file (e.g. known functional invoice from another environment) to compare structural presence and hierarchy.</p>',
          '  <button type="button" class="comparison-btn-primary" id="btn_import_reference_custom">',
          '    <span>📂</span><span>Import Reference XML</span>',
          '  </button>',
          '</div>'
        ].join('\n');
      } else {
        var customFileName = activeReference.fileName || 'custom_reference.xml';
        var customStats = activeReference.analysisResult.statistics || { totalElements: 0, totalAttributes: 0 };
        refConfigHtml = [
          '<div class="template-info-box">',
          '  <div class="template-info-header">',
          '    <div class="template-info-name">📄 ' + escapeHtml(customFileName) + '</div>',
          '    <span class="status-pill status-valid" style="font-size:10px; padding:2px 8px;">SYNTAX VALID</span>',
          '  </div>',
          '  <div class="template-info-grid">',
          '    <div class="template-info-cell"><span class="template-cell-label">Source Type:</span><span class="template-cell-value">CUSTOM_REFERENCE</span></div>',
          '    <div class="template-info-cell"><span class="template-cell-label">Elements:</span><span class="template-cell-value">' + (customStats.totalElements || 0).toLocaleString() + '</span></div>',
          '    <div class="template-info-cell"><span class="template-cell-label">Attributes:</span><span class="template-cell-value">' + (customStats.totalAttributes || 0).toLocaleString() + '</span></div>',
          '  </div>',
          '  <div style="margin-top: 6px;">',
          '    <button type="button" class="comparison-btn-secondary" id="btn_import_reference_custom_change">',
          '      <span>📂</span><span>Change Custom Reference File</span>',
          '    </button>',
          '  </div>',
          '</div>'
        ].join('\n');
      }
    }

    // 3. Action Toolbar (Compare Structure, Clear Reference)
    var hasRefReady = activeReference && activeReference.analysisResult && activeReference.analysisResult.tree;
    var hasSourceReady = sourceAnalysis && sourceAnalysis.success && sourceAnalysis.tree;
    var compareBtnDisabled = (!hasRefReady || !hasSourceReady) ? ' disabled' : '';

    var actionToolbarHtml = [
      '<div class="comparison-actions-bar">',
      '  <button type="button" class="comparison-btn-primary" id="btn_run_comparison"' + compareBtnDisabled + '>',
      '    <span>⚡</span><span>Compare Structure</span>',
      '  </button>',
      (hasRefReady ? '  <button type="button" class="comparison-btn-danger" id="btn_clear_reference"><span>🗑</span><span>Clear Reference</span></button>' : ''),
      '</div>',
      (!hasSourceReady ? '  <div style="font-size:11px; color:var(--text-muted); padding-top:4px;">Please click <strong>Validate XML</strong> on your primary XML editor to enable structural comparison.</div>' : '')
    ].join('\n');

    var referenceCardHtml = [
      '<div class="comparison-reference-card">',
      sourceSwitcherHtml,
      refConfigHtml,
      actionToolbarHtml,
      '</div>'
    ].join('\n');

    // 4. Comparison Results
    var resultsHtml = '';

    if (comparisonResult && comparisonResult.summary) {
      var sum = comparisonResult.summary;

      var metricsGridHtml = [
        '<div class="comparison-metrics-grid">',
        '  <div class="comparison-metric-box">',
        '    <span class="comparison-metric-title">Total Differences</span>',
        '    <span class="comparison-metric-val">' + sum.totalDifferences + '</span>',
        '  </div>',
        '  <div class="comparison-metric-box">',
        '    <span class="comparison-metric-title">Missing</span>',
        '    <span class="comparison-metric-val">' + sum.missingElements + '</span>',
        '  </div>',
        '  <div class="comparison-metric-box">',
        '    <span class="comparison-metric-title">Additional</span>',
        '    <span class="comparison-metric-val">' + sum.additionalElements + '</span>',
        '  </div>',
        '  <div class="comparison-metric-box">',
        '    <span class="comparison-metric-title">Attributes</span>',
        '    <span class="comparison-metric-val">' + sum.attributeDifferences + '</span>',
        '  </div>',
        '  <div class="comparison-metric-box">',
        '    <span class="comparison-metric-title">Hierarchy</span>',
        '    <span class="comparison-metric-val">' + sum.hierarchyDifferences + '</span>',
        '  </div>',
        '  <div class="comparison-metric-box">',
        '    <span class="comparison-metric-title">Occurrences</span>',
        '    <span class="comparison-metric-val">' + sum.occurrenceDifferences + '</span>',
        '  </div>',
        '</div>'
      ].join('\n');

      var diffCardsHtml = [];
      if (comparisonResult.differences.length === 0) {
        diffCardsHtml.push(
          '<div class="syntax-success-card">' +
          '  <div class="syntax-success-header">' +
          '    <div class="success-icon-badge" aria-hidden="true">✓</div>' +
          '    <div class="success-title-group">' +
          '      <div class="success-title">Identical Structure</div>' +
          '      <div class="success-description">No structural differences were detected against the selected reference.</div>' +
          '      <div class="comparison-disclaimer-banner" style="margin-top: 8px;">⚠️ <strong>Notice:</strong> This does not represent full Coupa validation.</div>' +
          '    </div>' +
          '  </div>' +
          '</div>'
        );
      } else {
        for (var d = 0; d < comparisonResult.differences.length; d++) {
          var diff = comparisonResult.differences[d];
          var badgeClass = 'diff-badge-missing';
          var badgeLabel = 'MISSING';

          if (diff.type === 'ADDITIONAL_ELEMENT') {
            badgeClass = 'diff-badge-additional';
            badgeLabel = 'ADDITIONAL';
          } else if (diff.type.indexOf('ATTRIBUTE') === 0) {
            badgeClass = 'diff-badge-attribute';
            badgeLabel = diff.type === 'ATTRIBUTE_MISSING' ? 'ATTRIBUTE MISSING' : 'ATTRIBUTE ADDITIONAL';
          } else if (diff.type === 'HIERARCHY_DIFFERENCE') {
            badgeClass = 'diff-badge-hierarchy';
            badgeLabel = 'HIERARCHY';
          } else if (diff.type === 'OCCURRENCE_DIFFERENCE') {
            badgeClass = 'diff-badge-occurrence';
            badgeLabel = 'OCCURRENCE';
          }

          var viewNodeBtn = '';
          if (diff.sourceNodeId) {
            viewNodeBtn = '<button type="button" class="diff-btn-view-tree" data-node-id="' + escapeHtml(diff.sourceNodeId) + '">🔍 View in XML Tree</button>';
          }

          var pathsHtml = '';
          if (diff.referencePath || diff.sourcePath) {
            pathsHtml = [
              '<div class="diff-paths-box">',
              (diff.referencePath ? '  <div class="diff-path-row"><span class="diff-path-label">Reference:</span><span class="diff-path-val">' + escapeHtml(diff.referencePath) + '</span></div>' : ''),
              (diff.sourcePath ? '  <div class="diff-path-row"><span class="diff-path-label">Analyzed:</span><span class="diff-path-val">' + escapeHtml(diff.sourcePath) + '</span></div>' : ''),
              '</div>'
            ].join('\n');
          }

          diffCardsHtml.push(
            '<div class="diff-card">' +
            '  <div class="diff-card-header">' +
            '    <div class="diff-badge-group">' +
            '      <span class="diff-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
            '      <span class="diff-card-title">&lt;' + escapeHtml(diff.elementName || '') + '&gt;</span>' +
            '    </div>' +
            '  </div>' +
            '  <div class="diff-card-body">' +
            '    <div class="diff-card-message">' + escapeHtml(diff.message) + '</div>' +
            pathsHtml +
            (viewNodeBtn ? '<div style="margin-top: 4px;">' + viewNodeBtn + '</div>' : '') +
            '  </div>' +
            '</div>'
          );
        }
      }

      resultsHtml = [
        '<div style="font-size: 13px; font-weight: 700; color: var(--text-primary); margin-top: 8px;">Structural Comparison Results:</div>',
        metricsGridHtml,
        '<div class="comparison-diff-list">',
        diffCardsHtml.join('\n'),
        '</div>'
      ].join('\n');
    }

    container.innerHTML = [
      '<div class="comparison-wrapper">',
      referenceCardHtml,
      resultsHtml,
      '</div>'
    ].join('\n');

    // Bind event listeners
    var radioCoupa = document.getElementById('radio_ref_coupa');
    var radioCustom = document.getElementById('radio_ref_custom');

    if (radioCoupa && typeof callbacks.onSwitchSourceType === 'function') {
      radioCoupa.addEventListener('change', function () {
        if (this.checked) callbacks.onSwitchSourceType('COUPA_TEMPLATE');
      });
    }

    if (radioCustom && typeof callbacks.onSwitchSourceType === 'function') {
      radioCustom.addEventListener('change', function () {
        if (this.checked) callbacks.onSwitchSourceType('CUSTOM_REFERENCE');
      });
    }

    var catFilter = document.getElementById('coupa_category_filter');
    var tplSelect = document.getElementById('coupa_template_select');

    if (catFilter && tplSelect) {
      catFilter.addEventListener('change', function () {
        var selectedCat = this.value;
        var allTpls = XMLValidator.TemplateCatalog ? (selectedCat ? XMLValidator.TemplateCatalog.getByCategory(selectedCat) : XMLValidator.TemplateCatalog.getAll()) : [];
        tplSelect.innerHTML = '<option value="">-- Select a Coupa Reference Template --</option>';
        for (var o = 0; o < allTpls.length; o++) {
          var tItem = allTpls[o];
          var opt = document.createElement('option');
          opt.value = tItem.id;
          opt.textContent = tItem.name + ' [' + (tItem.categoryLabel || tItem.category) + ']';
          tplSelect.appendChild(opt);
        }
      });
    }

    if (tplSelect && typeof callbacks.onSelectCoupaTemplate === 'function') {
      tplSelect.addEventListener('change', function () {
        var tId = this.value;
        callbacks.onSelectCoupaTemplate(tId);
      });
    }

    var toggleSourceBtn = document.getElementById('btn_toggle_source_info');
    var sourceDetailsBox = document.getElementById('template_source_details_box');
    if (toggleSourceBtn && sourceDetailsBox) {
      toggleSourceBtn.addEventListener('click', function () {
        var isHidden = sourceDetailsBox.style.display === 'none';
        sourceDetailsBox.style.display = isHidden ? 'flex' : 'none';
        toggleSourceBtn.innerHTML = isHidden ? '<span>▲</span><span>Hide Source Information</span>' : '<span>ℹ</span><span>View Source Information</span>';
      });
    }

    var importCustomBtn = document.getElementById('btn_import_reference_custom');
    if (importCustomBtn && typeof callbacks.onImportClick === 'function') {
      importCustomBtn.addEventListener('click', callbacks.onImportClick);
    }

    var importCustomChangeBtn = document.getElementById('btn_import_reference_custom_change');
    if (importCustomChangeBtn && typeof callbacks.onImportClick === 'function') {
      importCustomChangeBtn.addEventListener('click', callbacks.onImportClick);
    }

    var compareBtn = document.getElementById('btn_run_comparison');
    if (compareBtn && typeof callbacks.onCompareClick === 'function') {
      compareBtn.addEventListener('click', callbacks.onCompareClick);
    }

    var clearBtn = document.getElementById('btn_clear_reference');
    if (clearBtn && typeof callbacks.onClearClick === 'function') {
      clearBtn.addEventListener('click', callbacks.onClearClick);
    }

    var viewTreeBtns = container.querySelectorAll('.diff-btn-view-tree');
    for (var v = 0; v < viewTreeBtns.length; v++) {
      viewTreeBtns[v].addEventListener('click', function () {
        var nId = this.getAttribute('data-node-id');
        if (nId && typeof callbacks.onSelectSourceNode === 'function') {
          callbacks.onSelectSourceNode(nId);
        }
      });
    }
  }

  /**
   * Reset all tabs back to default empty states
   */
  function resetTabsToEmptyState() {
    updateStatus('NOT ANALYZED');
    updateCounters('—', '—', '—');

    var validationPane = document.getElementById('tab_pane_validation');
    if (validationPane) {
      validationPane.innerHTML = [
        '<div class="empty-state">',
        '  <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">',
        '    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />',
        '  </svg>',
        '  <div class="empty-state-title">No Diagnostics to Display</div>',
        '  <p class="empty-state-text">Run a validation to see diagnostic results.</p>',
        '</div>'
      ].join('\n');
    }

    var treePane = document.getElementById('tab_pane_tree');
    if (treePane) {
      treePane.innerHTML = [
        '<div class="empty-state">',
        '  <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">',
        '    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16m-7 6h7" />',
        '  </svg>',
        '  <div class="empty-state-title">XML Tree Viewer</div>',
        '  <p class="empty-state-text">Validate an XML document to render its interactive hierarchy.</p>',
        '</div>'
      ].join('\n');
    }

    var detailsPane = document.getElementById('tab_pane_details');
    if (detailsPane) {
      detailsPane.innerHTML = [
        '<div class="empty-state">',
        '  <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">',
        '    <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
        '  </svg>',
        '  <div class="empty-state-title">XML Details</div>',
        '  <p class="empty-state-text">Validate an XML document to view document metadata or select a node in the tree to inspect its properties.</p>',
        '</div>'
      ].join('\n');
    }

    var comparisonPane = document.getElementById('tab_pane_comparison');
    if (comparisonPane) {
      comparisonPane.innerHTML = [
        '<div class="empty-state">',
        '  <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">',
        '    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />',
        '  </svg>',
        '  <div class="empty-state-title">No Reference XML Selected</div>',
        '  <p class="empty-state-text">Import a reference XML invoice file to compare structural presence and hierarchy against your analyzed XML.</p>',
        '  <div style="margin-top: 16px;">',
        '    <button type="button" class="comparison-btn-primary" id="btn_import_reference_initial">',
        '      <span>📂</span><span>Import Reference XML</span>',
        '    </button>',
        '  </div>',
        '</div>'
      ].join('\n');
    }
  }

  return {
    initTheme: initTheme,
    toggleTheme: toggleTheme,
    switchTab: switchTab,
    updateStatus: updateStatus,
    updateCounters: updateCounters,
    showNotification: showNotification,
    renderValidationSuccess: renderValidationSuccess,
    renderValidationError: renderValidationError,
    renderXmlDetails: renderXmlDetails,
    renderComparisonView: renderComparisonView,
    resetTabsToEmptyState: resetTabsToEmptyState
  };
})();

