/**
 * XML Invoice Validator - Rule Engine Module
 * 
 * Phase 4: Validation Rule Engine & Coupa Rule Infrastructure
 * 
 * Responsibilities:
 * - Register validation rules with strict contract validation
 * - Manage unique rule IDs and reject duplicates safely
 * - Check applicability (APPLIES, NOT_APPLICABLE, UNKNOWN)
 * - Execute applicable rules and normalize findings
 * - Catch internal rule exceptions as systemIssues (preserving VALIDATION INCOMPLETE state)
 * - Support zero rules execution gracefully
 * - Completely decoupled from Coupa business rules logic and offline-first
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.RuleEngine = (function () {
  'use strict';

  // In-memory registry of validated rules
  var registry = [];

  // Allowed severities
  var ALLOWED_SEVERITIES = ['error', 'warning', 'info'];

  // Allowed source types
  var ALLOWED_SOURCE_TYPES = [
    'COUPA_DOCUMENTATION',
    'CXML_SPECIFICATION',
    'COUPA_TEMPLATE',
    'CUSTOM_REFERENCE',
    'INTERNAL_CONFIRMED_RULE'
  ];

  /**
   * Validate that a rule object conforms to the mandatory contract
   * @param {Object} rule 
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validateContract(rule) {
    var errors = [];

    if (!rule || typeof rule !== 'object') {
      return { valid: false, errors: ['Rule definition must be a non-null object.'] };
    }

    // 1. ID check
    if (!rule.id || typeof rule.id !== 'string' || rule.id.trim() === '') {
      errors.push('Rule must specify a non-empty string "id".');
    }

    // 2. Name check
    if (!rule.name || typeof rule.name !== 'string' || rule.name.trim() === '') {
      errors.push('Rule must specify a non-empty string "name".');
    }

    // 3. Enabled check
    if (typeof rule.enabled !== 'boolean') {
      errors.push('Rule must specify a boolean "enabled" property.');
    }

    // 4. Severity check
    if (!rule.severity || ALLOWED_SEVERITIES.indexOf(rule.severity) === -1) {
      errors.push('Rule must specify a valid "severity" ("error", "warning", or "info").');
    }

    // 5. Source / Provenance check
    if (!rule.source || typeof rule.source !== 'object') {
      errors.push('Rule must specify a "source" object for traceability.');
    } else {
      if (!rule.source.title || typeof rule.source.title !== 'string' || rule.source.title.trim() === '') {
        errors.push('Rule source must specify a non-empty string "title".');
      }
      if (!rule.source.type || typeof rule.source.type !== 'string') {
        errors.push('Rule source must specify a valid "type".');
      }
    }

    // 6. Validate function check
    if (typeof rule.validate !== 'function') {
      errors.push('Rule must specify a "validate(context)" function.');
    }

    // 7. AppliesTo check (optional function, but if provided must be a function)
    if (rule.appliesTo !== undefined && rule.appliesTo !== null && typeof rule.appliesTo !== 'function') {
      errors.push('Rule "appliesTo" property, if specified, must be a function.');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Register a single rule into the engine
   * @param {Object} rule 
   * @returns {{ success: boolean, ruleId: string|null, errors: string[] }}
   */
  function register(rule) {
    var contractCheck = validateContract(rule);
    if (!contractCheck.valid) {
      return {
        success: false,
        ruleId: rule && rule.id ? rule.id : null,
        errors: contractCheck.errors
      };
    }

    // Check for duplicate ID
    for (var i = 0; i < registry.length; i++) {
      if (registry[i].id === rule.id) {
        return {
          success: false,
          ruleId: rule.id,
          errors: ['Rule with ID "' + rule.id + '" is already registered. Duplicates are not allowed.']
        };
      }
    }

    // Clone & store rule definition
    registry.push({
      id: rule.id,
      name: rule.name,
      description: rule.description || '',
      category: rule.category || 'COUPA_RULE',
      pack: rule.pack || 'COUPA_CORE',
      severity: rule.severity,
      enabled: rule.enabled,
      source: {
        type: rule.source.type || 'COUPA_DOCUMENTATION',
        title: rule.source.title,
        reference: rule.source.reference || null,
        url: rule.source.url || null
      },
      appliesTo: typeof rule.appliesTo === 'function' ? rule.appliesTo : null,
      validate: rule.validate
    });

    return {
      success: true,
      ruleId: rule.id,
      errors: []
    };
  }

  /**
   * Register multiple rules at once
   * @param {Array<Object>} rules 
   * @returns {{ total: number, registered: number, failed: number, results: Array }}
   */
  function registerMany(rules) {
    if (!Array.isArray(rules)) {
      return { total: 0, registered: 0, failed: 0, results: [] };
    }

    var results = [];
    var registered = 0;
    var failed = 0;

    for (var i = 0; i < rules.length; i++) {
      var res = register(rules[i]);
      results.push(res);
      if (res.success) {
        registered++;
      } else {
        failed++;
      }
    }

    return {
      total: rules.length,
      registered: registered,
      failed: failed,
      results: results
    };
  }

  /**
   * Clear all registered rules (useful for test isolation or reset)
   */
  function clear() {
    registry = [];
  }

  /**
   * Get list of currently registered rules (shallow copy of metadata)
   * @returns {Array<Object>}
   */
  function getRegisteredRules() {
    return registry.map(function (r) {
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        pack: r.pack,
        severity: r.severity,
        enabled: r.enabled,
        source: {
          type: r.source.type,
          title: r.source.title,
          reference: r.source.reference,
          url: r.source.url
        }
      };
    });
  }

  /**
   * Evaluate applicability of a rule against the context
   * Supports: APPLIES (true), NOT_APPLICABLE (false), UNKNOWN (null)
   * @param {Object} rule 
   * @param {Object} context 
   * @returns {{ applicable: boolean|null, reason: string }}
   */
  function evaluateApplicability(rule, context) {
    if (!rule.appliesTo) {
      return { applicable: true, reason: 'Rule applies by default (no custom appliesTo predicate).' };
    }

    try {
      var result = rule.appliesTo(context);

      // Soportar retorno booleano directo
      if (typeof result === 'boolean') {
        return {
          applicable: result,
          reason: result ? 'Rule applies to document context.' : 'Rule does not apply to this document context.'
        };
      }

      // Soportar retorno de objeto { applicable: boolean|null, reason: string }
      if (result && typeof result === 'object') {
        var isApp = result.applicable;
        if (isApp !== true && isApp !== false && isApp !== null) {
          isApp = null;
        }
        return {
          applicable: isApp,
          reason: result.reason || (isApp === null ? 'Applicability is unknown/undetermined.' : (isApp ? 'Rule applies.' : 'Rule does not apply.'))
        };
      }

      // Si retorna null o undefined
      if (result === null || result === undefined) {
        return {
          applicable: null,
          reason: 'Applicability is undetermined (returned null/undefined).'
        };
      }

      return {
        applicable: Boolean(result),
        reason: 'Applicability coerced from truthy/falsy evaluation.'
      };
    } catch (err) {
      return {
        applicable: null,
        reason: 'Error evaluating applicability: ' + (err && err.message ? err.message : String(err))
      };
    }
  }

  /**
   * Normalize a raw finding returned by a rule into standard system schema
   * @param {Object} finding 
   * @param {Object} rule 
   * @param {Object} context 
   * @returns {Object}
   */
  function normalizeFinding(finding, rule, context) {
    if (!finding || typeof finding !== 'object') {
      return {
        severity: rule.severity || 'warning',
        code: rule.id,
        category: rule.category || 'COUPA_RULE',
        pack: rule.pack || 'COUPA_CORE',
        title: rule.name || 'Validation Finding',
        message: 'Non-standard finding returned by rule ' + rule.id,
        nodeId: null,
        path: null,
        line: null,
        column: null,
        snippet: null,
        suggestion: null,
        source: rule.source
      };
    }

    // Determine severity from finding or default to rule severity
    var severity = finding.severity;
    if (ALLOWED_SEVERITIES.indexOf(severity) === -1) {
      severity = rule.severity || 'error';
    }

    // Resolve nodeId and path
    var nodeId = finding.nodeId || null;
    var path = finding.path || null;

    // If nodeId is provided but path is missing, try to resolve path from context.nodeIndex
    if (nodeId && !path && context && context.nodeIndex && context.nodeIndex[nodeId]) {
      path = context.nodeIndex[nodeId].path;
    }

    // If path is provided but nodeId is missing, try to resolve nodeId from context.nodeIndex
    if (path && !nodeId && context && context.nodeIndex) {
      for (var k in context.nodeIndex) {
        if (context.nodeIndex.hasOwnProperty(k) && context.nodeIndex[k].path === path) {
          nodeId = context.nodeIndex[k].id;
          break;
        }
      }
    }

    var correction = null;
    if (finding.correction && typeof finding.correction === 'object') {
      correction = {
        expected: finding.correction.expected !== undefined ? finding.correction.expected : null,
        actual: finding.correction.actual !== undefined ? finding.correction.actual : null,
        suggestion: finding.correction.suggestion !== undefined ? finding.correction.suggestion : (finding.suggestion || null),
        autoFixable: Boolean(finding.correction.autoFixable)
      };
    } else if (finding.suggestion) {
      correction = {
        expected: null,
        actual: null,
        suggestion: finding.suggestion,
        autoFixable: false
      };
    }

    return {
      severity: severity,
      code: finding.code || rule.id,
      category: finding.category || rule.category || 'COUPA_RULE',
      pack: rule.pack || 'COUPA_CORE',
      title: finding.title || rule.name,
      message: finding.message || rule.description || 'Validation condition triggered.',
      nodeId: nodeId,
      path: path,
      line: finding.line !== undefined ? finding.line : null,
      column: finding.column !== undefined ? finding.column : null,
      snippet: finding.snippet || null,
      suggestion: finding.suggestion || (correction ? correction.suggestion : null),
      correction: correction,
      source: finding.source || rule.source
    };
  }

  /**
   * Execute all applicable and enabled rules against the provided Context
   * @param {Object} context 
   * @returns {Object} Rich result summary
   */
  function run(context) {
    var safeContext = context || {};

    var summary = {
      success: true,
      totalRules: registry.length,
      enabledRules: 0,
      disabledRules: 0,
      applicableRules: 0,
      skippedRules: 0,
      unknownApplicabilityRules: 0,
      executedRules: 0,
      findings: [],
      findingsSummary: {
        errors: 0,
        warnings: 0,
        info: 0
      },
      systemIssues: []
    };

    if (registry.length === 0) {
      // 0 registered rules -> clean graceful exit
      return summary;
    }

    for (var i = 0; i < registry.length; i++) {
      var rule = registry[i];

      // 1. Check if enabled
      if (!rule.enabled) {
        summary.disabledRules++;
        summary.skippedRules++;
        continue;
      }
      summary.enabledRules++;

      // 2. Evaluate applicability
      var appEval = evaluateApplicability(rule, safeContext);

      if (appEval.applicable === false) {
        summary.skippedRules++;
        continue;
      }

      if (appEval.applicable === null) {
        summary.unknownApplicabilityRules++;
        summary.skippedRules++;
        continue;
      }

      // Applicable -> Execute
      summary.applicableRules++;
      summary.executedRules++;

      try {
        var rawFindings = rule.validate(safeContext);

        if (Array.isArray(rawFindings)) {
          for (var j = 0; j < rawFindings.length; j++) {
            var norm = normalizeFinding(rawFindings[j], rule, safeContext);
            summary.findings.push(norm);

            if (norm.severity === 'error') summary.findingsSummary.errors++;
            else if (norm.severity === 'warning') summary.findingsSummary.warnings++;
            else if (norm.severity === 'info') summary.findingsSummary.info++;
          }
        } else if (rawFindings && typeof rawFindings === 'object') {
          // Single finding object returned
          var singleNorm = normalizeFinding(rawFindings, rule, safeContext);
          summary.findings.push(singleNorm);
          if (singleNorm.severity === 'error') summary.findingsSummary.errors++;
          else if (singleNorm.severity === 'warning') summary.findingsSummary.warnings++;
          else if (singleNorm.severity === 'info') summary.findingsSummary.info++;
        }
      } catch (execError) {
        // Internal rule execution failure -> Record as SYSTEM ISSUE (NEVER as invoice error)
        summary.success = false;
        summary.systemIssues.push({
          code: 'RULE_SYSTEM_001',
          ruleId: rule.id,
          ruleName: rule.name,
          message: 'Execution of rule "' + rule.id + '" failed unexpectedly.',
          technicalDetails: execError && execError.stack ? execError.stack : (execError && execError.message ? execError.message : String(execError))
        });
      }
    }

    return summary;
  }

  /**
   * Run Self-Contained Test Suite for Rule Engine (Test 1 - Test 12)
   * Uses temporary mock rules and restores original registry state upon completion.
   * @returns {{ allPassed: boolean, passed: number, total: number, results: Array }}
   */
  function runMockTests() {
    var previousRegistry = registry.slice();
    var testResults = [];

    function recordTest(name, passed, detail) {
      testResults.push({ name: name, passed: passed, detail: detail });
    }

    try {
      // Test 1: Registro
      clear();
      var r1 = register({
        id: 'TEST_RULE_001',
        name: 'Test Rule 1',
        severity: 'error',
        enabled: true,
        source: { type: 'CUSTOM_REFERENCE', title: 'Internal Unit Test' },
        validate: function () { return []; }
      });
      recordTest('Test 1 — Registro', r1.success && registry.length === 1, '1 registered rule');

      // Test 2: ID duplicado
      var r2 = register({
        id: 'TEST_RULE_001',
        name: 'Duplicate Test Rule 1',
        severity: 'warning',
        enabled: true,
        source: { type: 'CUSTOM_REFERENCE', title: 'Internal Unit Test' },
        validate: function () { return []; }
      });
      recordTest('Test 2 — ID duplicado', !r2.success && registry.length === 1, 'Rejection of duplicate ID');

      // Test 3: Regla aplicable sin findings
      clear();
      register({
        id: 'TEST_RULE_003',
        name: 'Applicable No Findings',
        severity: 'error',
        enabled: true,
        source: { type: 'CUSTOM_REFERENCE', title: 'Internal Unit Test' },
        appliesTo: function () { return true; },
        validate: function () { return []; }
      });
      var res3 = run({});
      recordTest('Test 3 — Regla aplicable sin findings', res3.executedRules === 1 && res3.findings.length === 0, 'executedRules=1, findings=0');

      // Test 4: Regla no aplicable
      clear();
      var validateCalled4 = false;
      register({
        id: 'TEST_RULE_004',
        name: 'Non-applicable Rule',
        severity: 'error',
        enabled: true,
        source: { type: 'CUSTOM_REFERENCE', title: 'Internal Unit Test' },
        appliesTo: function () { return false; },
        validate: function () { validateCalled4 = true; return []; }
      });
      var res4 = run({});
      recordTest('Test 4 — Regla no aplicable', res4.skippedRules === 1 && res4.executedRules === 0 && !validateCalled4, 'validate() not called, skippedRules=1');

      // Test 5: Aplicabilidad desconocida
      clear();
      register({
        id: 'TEST_RULE_005',
        name: 'Unknown Applicability Rule',
        severity: 'warning',
        enabled: true,
        source: { type: 'CUSTOM_REFERENCE', title: 'Internal Unit Test' },
        appliesTo: function () { return null; },
        validate: function () { return []; }
      });
      var res5 = run({});
      recordTest('Test 5 — Aplicabilidad desconocida', res5.unknownApplicabilityRules === 1 && res5.executedRules === 0, 'unknownApplicabilityRules=1');

      // Test 6: Finding error
      clear();
      register({
        id: 'TEST_RULE_006',
        name: 'Error Rule',
        severity: 'error',
        enabled: true,
        source: { type: 'COUPA_DOCUMENTATION', title: 'Coupa Test Doc' },
        validate: function () {
          return [{
            severity: 'error',
            title: 'Mock Error',
            message: 'An error occurred'
          }];
        }
      });
      var res6 = run({});
      recordTest('Test 6 — Finding error', res6.findings.length === 1 && res6.findings[0].severity === 'error' && res6.findingsSummary.errors === 1, 'Error finding correctly normalized');

      // Test 7: Finding warning
      clear();
      register({
        id: 'TEST_RULE_007',
        name: 'Warning Rule',
        severity: 'warning',
        enabled: true,
        source: { type: 'COUPA_DOCUMENTATION', title: 'Coupa Test Doc' },
        validate: function () {
          return [{
            severity: 'warning',
            title: 'Mock Warning',
            message: 'A warning occurred'
          }];
        }
      });
      var res7 = run({});
      recordTest('Test 7 — Finding warning', res7.findings.length === 1 && res7.findings[0].severity === 'warning' && res7.findingsSummary.warnings === 1, 'Warning finding preserved');

      // Test 8: Finding info
      clear();
      register({
        id: 'TEST_RULE_008',
        name: 'Info Rule',
        severity: 'info',
        enabled: true,
        source: { type: 'COUPA_DOCUMENTATION', title: 'Coupa Test Doc' },
        validate: function () {
          return [{
            severity: 'info',
            title: 'Mock Info',
            message: 'An informational item'
          }];
        }
      });
      var res8 = run({});
      recordTest('Test 8 — Finding info', res8.findings.length === 1 && res8.findings[0].severity === 'info' && res8.findingsSummary.info === 1, 'Info finding preserved');

      // Test 9: Error interno
      clear();
      register({
        id: 'TEST_RULE_009',
        name: 'Crashing Rule',
        severity: 'error',
        enabled: true,
        source: { type: 'CUSTOM_REFERENCE', title: 'Internal Unit Test' },
        validate: function () {
          throw new Error('Test failure');
        }
      });
      var res9 = run({});
      recordTest('Test 9 — Error interno', res9.systemIssues.length === 1 && res9.systemIssues[0].code === 'RULE_SYSTEM_001' && res9.findings.length === 0, 'Recorded as systemIssue, 0 invoice errors');

      // Test 10: nodeId
      clear();
      var mockContext10 = {
        nodeIndex: {
          node_3: { id: 'node_3', path: '/Invoice/Item[3]' }
        }
      };
      register({
        id: 'TEST_RULE_010',
        name: 'Node ID Rule',
        severity: 'warning',
        enabled: true,
        source: { type: 'CUSTOM_REFERENCE', title: 'Internal Unit Test' },
        validate: function () {
          return [{
            nodeId: 'node_3',
            message: 'Targeted node'
          }];
        }
      });
      var res10 = run(mockContext10);
      recordTest('Test 10 — nodeId', res10.findings.length === 1 && res10.findings[0].nodeId === 'node_3' && res10.findings[0].path === '/Invoice/Item[3]', 'nodeId preserved and path resolved');

      // Test 11: path
      clear();
      register({
        id: 'TEST_RULE_011',
        name: 'Path Rule',
        severity: 'warning',
        enabled: true,
        source: { type: 'CUSTOM_REFERENCE', title: 'Internal Unit Test' },
        validate: function () {
          return [{
            path: '/Invoice/Item[2]',
            message: 'Targeted path'
          }];
        }
      });
      var res11 = run({});
      recordTest('Test 11 — path', res11.findings.length === 1 && res11.findings[0].path === '/Invoice/Item[2]', 'Path preserved');

      // Test 12: Regla disabled
      clear();
      var validateCalled12 = false;
      register({
        id: 'TEST_RULE_012',
        name: 'Disabled Rule',
        severity: 'error',
        enabled: false,
        source: { type: 'CUSTOM_REFERENCE', title: 'Internal Unit Test' },
        validate: function () { validateCalled12 = true; return []; }
      });
      var res12 = run({});
      recordTest('Test 12 — Regla disabled', res12.disabledRules === 1 && res12.executedRules === 0 && !validateCalled12, 'Disabled rule not executed');

    } finally {
      // Restore previous registry cleanly
      registry = previousRegistry;
    }

    var passedCount = testResults.filter(function (t) { return t.passed; }).length;

    return {
      allPassed: passedCount === testResults.length,
      passed: passedCount,
      total: testResults.length,
      results: testResults
    };
  }

  return {
    register: register,
    registerMany: registerMany,
    clear: clear,
    getRegisteredRules: getRegisteredRules,
    validateContract: validateContract,
    run: run,
    runMockTests: runMockTests
  };
})();
