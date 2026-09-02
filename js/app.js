/**
 * XML Invoice Validator - Main Application Controller
 * 
 * Phase 3 Entry Point: Event bindings, file loader, editor metrics,
 * XML syntax validation workflow, XML formatting, structural analysis (AST),
 * interactive tree rendering, node selection synchronization,
 * and live editor state invalidation.
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.App = (function () {
  'use strict';

  // DOM Elements cache
  var elements = {};

  // Internal application state
  var state = {
    fileName: 'Untitled',
    rawXml: '',
    parseResult: null,
    analysisResult: null,
    ruleResult: null,
    scenario: null,
    selectedNodeId: null,
    activeProfile: null,
    activeTemplate: null,
    referenceViewMode: 'COUPA_TEMPLATE', // 'COUPA_TEMPLATE' | 'CUSTOM_REFERENCE'
    activeReference: null, // { sourceType, templateId, template, fileName, rawXml, parseResult, analysisResult, error }
    comparisonResult: null
    ,lastFix: null
  };

  /**
   * Cache critical DOM references
   */
  function cacheDom() {
    elements.editor = document.getElementById('xml_editor_textarea');
    elements.lineNumbers = document.getElementById('line_numbers_gutter');
    elements.fileNameDisplay = document.getElementById('file_name_display');
    elements.fileInput = document.getElementById('file_input');
    elements.referenceFileInput = document.getElementById('reference_file_input');
    elements.charCount = document.getElementById('editor_char_count');
    elements.lineCount = document.getElementById('editor_line_count');
    
    elements.btnLoad = document.getElementById('btn_load_xml');
    elements.btnValidate = document.getElementById('btn_validate');
    elements.btnFormat = document.getElementById('btn_format');
    elements.btnClear = document.getElementById('btn_clear');
    elements.btnThemeToggle = document.getElementById('theme_toggle_btn');

    elements.tabValidationPane = document.getElementById('tab_pane_validation');
    elements.tabTreePane = document.getElementById('tab_pane_tree');
    elements.tabDetailsPane = document.getElementById('tab_pane_details');
    elements.tabComparisonPane = document.getElementById('tab_pane_comparison');
  }

  /**
   * Helper to retrieve current editor metrics
   * @returns {{ lines: number, chars: number }}
   */
  function getCurrentMetrics() {
    var text = elements.editor ? elements.editor.value : '';
    return {
      lines: XMLValidator.Utils.countLines(text),
      chars: XMLValidator.Utils.countCharacters(text)
    };
  }

  /**
   * Update line numbers gutter and metrics counters
   */
  function updateEditorMetrics() {
    if (!elements.editor) return;

    var text = elements.editor.value;
    var lines = XMLValidator.Utils.countLines(text);
    var chars = XMLValidator.Utils.countCharacters(text);

    // Update bottom metrics
    if (elements.charCount) {
      elements.charCount.textContent = chars.toLocaleString();
    }
    if (elements.lineCount) {
      elements.lineCount.textContent = lines.toLocaleString();
    }

    // Generate line numbers text
    if (elements.lineNumbers) {
      var linesStr = '';
      for (var i = 1; i <= lines; i++) {
        linesStr += i + '\n';
      }
      elements.lineNumbers.textContent = linesStr;
    }
  }

  /**
   * Synchronize vertical scroll between editor textarea and line numbers gutter
   */
  function syncScroll() {
    if (elements.editor && elements.lineNumbers) {
      elements.lineNumbers.scrollTop = elements.editor.scrollTop;
    }
  }

  /**
   * Render Comparison View Tab
   */
  function renderComparison() {
    if (XMLValidator.UI && typeof XMLValidator.UI.renderComparisonView === 'function') {
      XMLValidator.UI.renderComparisonView(
        state.activeReference,
        state.analysisResult,
        state.comparisonResult,
        {
          onSwitchSourceType: handleSwitchSourceType,
          onSelectCoupaTemplate: handleSelectCoupaTemplate,
          onImportClick: function () {
            if (elements.referenceFileInput) {
              elements.referenceFileInput.click();
            }
          },
          onCompareClick: handleRunComparison,
          onClearClick: handleClearReference,
          onSelectSourceNode: function (nodeId) {
            XMLValidator.UI.switchTab('tree');
            selectNode(nodeId);
          }
        },
        state.referenceViewMode
      );
    }
  }

  /**
   * Switch between Coupa Reference Catalog and Custom Reference
   * @param {string} mode 'COUPA_TEMPLATE' | 'CUSTOM_REFERENCE'
   */
  function handleSwitchSourceType(mode) {
    if (mode === state.referenceViewMode) return;
    state.referenceViewMode = mode;
    state.comparisonResult = null;
    renderComparison();
  }

  /**
   * Select a Coupa reference template from the catalog
   * @param {string} templateId 
   */
  function handleSelectCoupaTemplate(templateId) {
    if (!templateId) {
      if (state.activeReference && state.activeReference.sourceType === 'COUPA_TEMPLATE') {
        state.activeReference = null;
        state.comparisonResult = null;
        renderComparison();
      }
      return;
    }

    if (!XMLValidator.TemplateCatalog || typeof XMLValidator.TemplateCatalog.prepareTemplate !== 'function') {
      XMLValidator.UI.showNotification('Template Catalog is not initialized.', 'error', 4000);
      return;
    }

    var prepRes = XMLValidator.TemplateCatalog.prepareTemplate(templateId);

    if (!prepRes.success) {
      state.activeReference = {
        sourceType: 'COUPA_TEMPLATE',
        templateId: templateId,
        template: prepRes.template,
        fileName: prepRes.template ? prepRes.template.name : 'Unknown',
        rawXml: prepRes.template ? prepRes.template.xml : '',
        parseResult: prepRes.parseResult,
        analysisResult: null,
        error: prepRes.error
      };
      state.comparisonResult = null;
      renderComparison();
      XMLValidator.UI.showNotification(prepRes.error || 'Failed to prepare template.', 'error', 5000);
      return;
    }

    state.activeReference = {
      sourceType: 'COUPA_TEMPLATE',
      templateId: templateId,
      template: prepRes.template,
      fileName: prepRes.template.name,
      rawXml: prepRes.template.xml,
      parseResult: prepRes.parseResult,
      analysisResult: prepRes.analysisResult,
      error: null
    };
    state.comparisonResult = null;

    renderComparison();
    XMLValidator.UI.showNotification('Coupa template selected: ' + prepRes.template.name, 'info', 3000);
  }

  /**
   * Handle Reference File Selection via FileReader
   * @param {Event} e 
   */
  function handleReferenceFileSelection(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var reader = new FileReader();

    reader.onload = function (event) {
      var content = event.target.result;
      
      // Parse reference XML using standard parser
      var parseRes = XMLValidator.Parser.parse(content);
      if (!parseRes.success) {
        XMLValidator.UI.showNotification('Reference XML is malformed and cannot be used for comparison: ' + (parseRes.error ? parseRes.error.title : 'Syntax error'), 'error', 5000);
        if (elements.referenceFileInput) {
          elements.referenceFileInput.value = '';
        }
        return;
      }

      // Analyze reference XML structure using standard analyzer
      var analysisRes = XMLValidator.Analyzer.analyze(parseRes.document);
      if (!analysisRes.success || !analysisRes.tree) {
        XMLValidator.UI.showNotification('Failed to generate AST structure for reference XML.', 'error', 4000);
        if (elements.referenceFileInput) {
          elements.referenceFileInput.value = '';
        }
        return;
      }

      state.referenceViewMode = 'CUSTOM_REFERENCE';
      state.activeReference = {
        sourceType: 'CUSTOM_REFERENCE',
        templateId: null,
        template: null,
        fileName: file.name,
        rawXml: content,
        parseResult: parseRes,
        analysisResult: analysisRes,
        error: null
      };
      state.comparisonResult = null;

      renderComparison();
      XMLValidator.UI.showNotification('Custom Reference XML loaded: ' + file.name, 'info', 3000);
    };

    reader.onerror = function () {
      XMLValidator.UI.showNotification('Error reading reference XML file.', 'error', 4000);
    };

    reader.readAsText(file);
  }

  /**
   * Run structural comparison between Analyzed XML and Active Reference
   */
  function handleRunComparison() {
    if (!state.analysisResult || !state.analysisResult.tree) {
      XMLValidator.UI.showNotification('Please validate your primary XML before comparing.', 'warning', 3500);
      return;
    }

    if (!state.activeReference || !state.activeReference.analysisResult || !state.activeReference.analysisResult.tree) {
      XMLValidator.UI.showNotification('Please select or import a valid Reference first.', 'warning', 3500);
      return;
    }

    var refDisplayName = state.activeReference.template 
      ? ('Coupa — ' + state.activeReference.template.name)
      : (state.activeReference.fileName || 'Custom Reference');

    var result = XMLValidator.Comparator.compare(
      state.analysisResult,
      state.activeReference.analysisResult,
      {
        sourceName: state.fileName || 'Analyzed XML',
        referenceName: refDisplayName,
        referenceId: state.activeReference.templateId,
        referenceType: state.activeReference.sourceType
      }
    );

    state.comparisonResult = result;
    renderComparison();

    var diffCount = result.summary ? result.summary.totalDifferences : 0;
    if (diffCount === 0) {
      XMLValidator.UI.showNotification('Comparison complete: Identical structure found.', 'info', 3000);
    } else {
      XMLValidator.UI.showNotification('Comparison complete: ' + diffCount + ' difference(s) detected.', 'info', 3000);
    }
  }

  /**
   * Clear loaded Reference XML / Template
   */
  function handleClearReference() {
    state.activeReference = null;
    state.comparisonResult = null;
    if (elements.referenceFileInput) {
      elements.referenceFileInput.value = '';
    }
    renderComparison();
    XMLValidator.UI.showNotification('Reference cleared.', 'info', 2000);
  }

  /**
   * Handle text changes in editor: invalidate prior analysis results
   */
  function handleEditorInput() {
    updateEditorMetrics();
    state.lastFix = null;

    // If analysis was previously executed, invalidate to prevent misleading results
    if (state.parseResult !== null || state.analysisResult !== null || state.ruleResult !== null) {
      state.parseResult = null;
      state.analysisResult = null;
      state.ruleResult = null;
      state.selectedNodeId = null;
      state.comparisonResult = null;
      XMLValidator.UI.resetTabsToEmptyState();
      renderComparison();
    }
  }

  /**
   * Handle File Upload via FileReader
   * @param {Event} e 
   */
  function handleFileSelection(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var reader = new FileReader();

    reader.onload = function (event) {
      var content = event.target.result;
      if (elements.editor) {
        elements.editor.value = content;
        state.rawXml = content;
        state.fileName = file.name;
        state.parseResult = null;
        state.analysisResult = null;
        state.ruleResult = null;
        state.selectedNodeId = null;
        state.comparisonResult = null;
        updateEditorMetrics();
        XMLValidator.UI.resetTabsToEmptyState();
        renderComparison();
      }
      if (elements.fileNameDisplay) {
        elements.fileNameDisplay.textContent = file.name;
        elements.fileNameDisplay.title = file.name;
      }
      XMLValidator.UI.showNotification('Loaded: ' + file.name, 'info', 3000);
    };

    reader.onerror = function () {
      XMLValidator.UI.showNotification('Error reading XML file.', 'error', 4000);
    };

    reader.readAsText(file);
  }

  /**
   * Select a node in the XML tree.
   * @param {string} nodeId 
   */
  function selectNode(nodeId) {
    state.selectedNodeId = nodeId;
    if (XMLValidator.TreeRenderer && typeof XMLValidator.TreeRenderer.selectNode === 'function') {
      XMLValidator.TreeRenderer.selectNode(nodeId, false);
    }
  }

  /**
   * Clear current node selection.
   */
  function clearNodeSelection() {
    state.selectedNodeId = null;
    if (XMLValidator.TreeRenderer && typeof XMLValidator.TreeRenderer.selectNode === 'function') {
      XMLValidator.TreeRenderer.selectNode(null, false);
    }
  }

  /**
   * Handle Validate action (Phase 2 Syntax Parsing + Phase 3 Structural Analysis + Phase 4 Rule Engine)
   */
  function handleValidate() {
    var rawText = elements.editor ? elements.editor.value : '';
    state.rawXml = rawText;

    // 1. Run syntax parser
    var result = XMLValidator.Parser.parse(rawText);
    state.parseResult = result;
    state.analysisResult = null;
    state.ruleResult = null;
    state.scenario = null;
    state.selectedNodeId = null;

    var metrics = getCurrentMetrics();

    if (!result.success) {
      // Failure: Update status and render error finding
      XMLValidator.UI.updateStatus('INVALID XML');
      XMLValidator.UI.updateCounters(1, '—', '—');
      XMLValidator.UI.renderValidationError(result.error);
      XMLValidator.UI.renderInvoiceDetails(result, null, null);

      if (elements.tabTreePane) {
        XMLValidator.TreeRenderer.render(elements.tabTreePane, null, null, null);
      }

      XMLValidator.UI.switchTab('validation');

      if (result.error && result.error.code === 'XML_INPUT_001') {
        XMLValidator.UI.showNotification('No XML content to validate.', 'warning', 3000);
      } else {
        XMLValidator.UI.showNotification('XML Syntax Error: ' + result.error.title, 'error', 4000);
      }
    } else {
      // Success: XML Syntax Valid -> Run Structural Analysis
      var analysis = XMLValidator.Analyzer.analyze(result.document);
      state.analysisResult = analysis;

      // Extract Version Context and Structural Observations
      var versionContext = null;
      if (typeof XMLValidator.extractVersionContext === 'function') {
        versionContext = XMLValidator.extractVersionContext(rawText, result.document);
      }
      var structuralObservations = null;
      if (typeof XMLValidator.extractStructuralObservations === 'function') {
        structuralObservations = XMLValidator.extractStructuralObservations(result.document);
      }

      state.versionContext = versionContext;
      state.structuralObservations = structuralObservations;
      var scenario = null;
      if (XMLValidator.ScenarioResolver && typeof XMLValidator.ScenarioResolver.resolve === 'function') {
        scenario = XMLValidator.ScenarioResolver.resolve({
          xmlDocument: result.document,
          analysis: analysis,
          structuralObservations: structuralObservations
        });
      }
      state.scenario = scenario;

      // Construct neutral Rule Context
      var ruleContext = {
        rawXml: rawText,
        xmlDocument: result.document,
        parserMetadata: result.metadata,
        versionContext: versionContext,
        structuralObservations: structuralObservations,
        scenario: scenario,
        tree: analysis.tree,
        nodeIndex: analysis.nodeIndex,
        statistics: analysis.statistics,
        namespaces: analysis.namespaces,
        profile: state.activeProfile,
        template: state.activeTemplate
      };

      // Run Rule Engine
      var ruleResult = null;
      if (XMLValidator.RuleEngine && typeof XMLValidator.RuleEngine.run === 'function') {
        try {
          ruleResult = XMLValidator.RuleEngine.run(ruleContext);
        } catch (ruleEngineError) {
          // If the engine itself encounters a catastrophic error, record as system issue
          ruleResult = {
            success: false,
            totalRules: 0,
            executedRules: 0,
            applicableRules: 0,
            skippedRules: 0,
            unknownApplicabilityRules: 0,
            findings: [],
            findingsSummary: { errors: 0, warnings: 0, info: 0 },
            systemIssues: [{
              code: 'RULE_SYSTEM_001',
              ruleId: 'ENGINE_CORE',
              ruleName: 'Rule Engine Execution',
              message: 'Rule Engine execution encountered an unhandled failure.',
              technicalDetails: String(ruleEngineError)
            }]
          };
        }
      }
      if (ruleResult && ruleResult.findings && XMLValidator.CorrectionEngine) {
        for (var findingIndex = 0; findingIndex < ruleResult.findings.length; findingIndex++) {
          var correctionPlan = XMLValidator.CorrectionEngine.plan(
            ruleResult.findings[findingIndex],
            ruleContext
          );
          ruleResult.findings[findingIndex].correctionPlan = correctionPlan;
          ruleResult.findings[findingIndex].correction.safety = correctionPlan.safety;
          ruleResult.findings[findingIndex].correction.reason = correctionPlan.explanation;
        }
      }
      state.ruleResult = ruleResult;

      // Determine overall status
      var errorsCount = (ruleResult && ruleResult.findingsSummary) ? ruleResult.findingsSummary.errors : 0;
      var warningsCount = (ruleResult && ruleResult.findingsSummary) ? ruleResult.findingsSummary.warnings : 0;
      var infoCount = (ruleResult && ruleResult.findingsSummary) ? ruleResult.findingsSummary.info : 0;

      if (ruleResult && ruleResult.systemIssues && ruleResult.systemIssues.length > 0) {
        XMLValidator.UI.updateStatus('VALIDATION INCOMPLETE');
      } else if (errorsCount > 0) {
        XMLValidator.UI.updateStatus('ISSUES FOUND');
      } else {
        XMLValidator.UI.updateStatus('CHECKS PASSED');
      }

      XMLValidator.UI.updateCounters(errorsCount, warningsCount, infoCount);
      XMLValidator.UI.renderValidationSuccess(result.metadata, ruleResult, versionContext, structuralObservations, state.activeTemplate, scenario);

      if (analysis.success && analysis.tree) {
        state.selectedNodeId = analysis.tree.id;

        // Render interactive Tree Viewer
        if (elements.tabTreePane) {
          XMLValidator.TreeRenderer.render(
            elements.tabTreePane,
            analysis.tree,
            analysis.statistics,
            selectNode
          );
        }

        XMLValidator.UI.renderInvoiceDetails(result, scenario, versionContext);
      } else {
        XMLValidator.UI.renderInvoiceDetails(result, scenario, versionContext);
      }

      XMLValidator.UI.switchTab('validation');
      XMLValidator.UI.showNotification('XML Syntax Valid. Well-formed XML document.', 'info', 3000);
    }

    renderComparison();
  }

  function previewFix(findingIndex) {
    var finding = state.ruleResult && state.ruleResult.findings ? state.ruleResult.findings[findingIndex] : null;
    var currentXml = elements.editor ? elements.editor.value : '';
    if (!finding || !finding.correctionPlan) return { success: false, reason: 'Correction plan is unavailable.' };
    return XMLValidator.CorrectionEngine.preview(finding.correctionPlan, currentXml);
  }

  function applyFix(findingIndex) {
    var finding = state.ruleResult && state.ruleResult.findings ? state.ruleResult.findings[findingIndex] : null;
    var currentXml = elements.editor ? elements.editor.value : '';
    if (!finding || !finding.correctionPlan) {
      XMLValidator.UI.showNotification('Correction plan is unavailable. Validate the XML again.', 'warning', 3500);
      return false;
    }
    var applied = XMLValidator.CorrectionEngine.apply(finding.correctionPlan, currentXml);
    if (!applied.success) {
      XMLValidator.UI.showNotification(applied.stale ? 'Correction plan is stale. Validate the changed XML again.' : 'Correction could not be applied safely.', 'warning', 4000);
      return false;
    }
    state.lastFix = { originalXml: applied.originalXml, correctedXml: applied.proposedXml, ruleId: finding.code };
    elements.editor.value = applied.proposedXml;
    updateEditorMetrics();
    handleValidate();
    XMLValidator.UI.showNotification('Correction applied and XML revalidated.', 'info', 3500);
    return true;
  }

  function undoLastFix() {
    if (!state.lastFix || !elements.editor) return false;
    var previous = state.lastFix.originalXml;
    state.lastFix = null;
    elements.editor.value = previous;
    updateEditorMetrics();
    handleValidate();
    XMLValidator.UI.showNotification('Last correction undone and XML revalidated.', 'info', 3500);
    return true;
  }

  /**
   * Handle Format action (Safe XML Indentation)
   */
  function handleFormat() {
    var rawText = elements.editor ? elements.editor.value : '';
    if (!rawText || rawText.trim() === '') {
      XMLValidator.UI.showNotification('Cannot format empty content.', 'warning', 3000);
      return;
    }

    var formatResult = XMLValidator.Formatter.format(rawText);

    if (!formatResult.success) {
      XMLValidator.UI.showNotification(formatResult.error, 'warning', 4000);
      // Trigger validation to highlight where the syntax error is located
      handleValidate();
      return;
    }

    // Apply formatted text safely
    if (elements.editor && formatResult.formattedXml) {
      elements.editor.value = formatResult.formattedXml;
      state.rawXml = formatResult.formattedXml;
      updateEditorMetrics();
      handleValidate();
      XMLValidator.UI.showNotification('XML formatted with 2-space indentation.', 'info', 3000);
    }
  }

  /**
   * Handle Clear action
   */
  function handleClear() {
    if (elements.editor) {
      elements.editor.value = '';
      updateEditorMetrics();
    }
    if (elements.fileNameDisplay) {
      elements.fileNameDisplay.textContent = 'Untitled';
      elements.fileNameDisplay.title = 'Untitled';
    }
    if (elements.fileInput) {
      elements.fileInput.value = '';
    }

    state.fileName = 'Untitled';
    state.rawXml = '';
    state.parseResult = null;
    state.analysisResult = null;
    state.ruleResult = null;
    state.selectedNodeId = null;
    state.comparisonResult = null;

    XMLValidator.UI.resetTabsToEmptyState();
    renderComparison();
    XMLValidator.UI.showNotification('Editor cleared.', 'info', 2000);
  }

  /**
   * Enable Tab key indentation inside textarea
   * @param {KeyboardEvent} e 
   */
  function handleEditorKeyDown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      var textarea = elements.editor;
      var start = textarea.selectionStart;
      var end = textarea.selectionEnd;
      var value = textarea.value;

      textarea.value = value.substring(0, start) + '  ' + value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      handleEditorInput();
    }
  }

  /**
   * Bind DOM event listeners
   */
  function bindEvents() {
    // Editor typing & scrolling
    if (elements.editor) {
      elements.editor.addEventListener('input', handleEditorInput);
      elements.editor.addEventListener('scroll', syncScroll);
      elements.editor.addEventListener('keydown', handleEditorKeyDown);
    }

    // Load XML button & input
    if (elements.btnLoad && elements.fileInput) {
      elements.btnLoad.addEventListener('click', function () {
        elements.fileInput.click();
      });
      elements.fileInput.addEventListener('change', handleFileSelection);
    }

    // Reference XML input
    if (elements.referenceFileInput) {
      elements.referenceFileInput.addEventListener('change', handleReferenceFileSelection);
    }

    // Toolbar buttons
    if (elements.btnValidate) {
      elements.btnValidate.addEventListener('click', handleValidate);
    }
    if (elements.btnFormat) {
      elements.btnFormat.addEventListener('click', handleFormat);
    }
    if (elements.btnClear) {
      elements.btnClear.addEventListener('click', handleClear);
    }

    // Theme toggle
    if (elements.btnThemeToggle) {
      elements.btnThemeToggle.addEventListener('click', function () {
        XMLValidator.UI.toggleTheme();
      });
    }

    // Tab buttons
    var tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tabId = btn.getAttribute('data-tab');
        if (tabId) {
          XMLValidator.UI.switchTab(tabId);
        }
      });
    });
  }

  /**
   * Initialize Application
   */
  function init() {
    cacheDom();
    XMLValidator.UI.initTheme();
    bindEvents();
    updateEditorMetrics();
    XMLValidator.UI.resetTabsToEmptyState();
    renderComparison();
  }

  // Self-initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    init: init,
    state: state,
    selectNode: selectNode,
    clearNodeSelection: clearNodeSelection,
    updateEditorMetrics: updateEditorMetrics,
    handleValidate: handleValidate,
    handleFormat: handleFormat,
    handleClear: handleClear
    ,previewFix: previewFix
    ,applyFix: applyFix
    ,undoLastFix: undoLastFix
  };
})();
