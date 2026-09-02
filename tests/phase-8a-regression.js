(function () {
  'use strict';

  var EXPECTED_RULE_IDS = [
    'CXML_ENV_001',
    'CXML_ENV_002',
    'CXML_ENV_003',
    'CXML_HEADER_001',
    'CXML_CREDENTIAL_001',
    'CXML_CREDENTIAL_002',
    'COUPA_INV_001',
    'CXML_INV_HEADER_001',
    'CXML_INV_HEADER_002',
    'CXML_INV_HEADER_003',
    'CXML_ORDER_001'
  ];

  var results = [];

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function record(group, name, fn) {
    try {
      fn();
      results.push({ group: group, name: name, passed: true, detail: 'PASS' });
    } catch (error) {
      results.push({
        group: group,
        name: name,
        passed: false,
        detail: error && error.message ? error.message : String(error)
      });
    }
  }

  function credential(domain, identity, includeSecret) {
    var domainAttribute = domain === null ? '' : ' domain="' + domain + '"';
    var identityElement = identity === null ? '' : '<Identity>' + identity + '</Identity>';
    var secretElement = includeSecret ? '<SharedSecret>test-secret</SharedSecret>' : '';
    return '<Credential' + domainAttribute + '>' + identityElement + secretElement + '</Credential>';
  }

  function validHeader(overrides) {
    var opts = overrides || {};
    return '<Header>' +
      '<From>' + credential(opts.fromDomain === undefined ? 'DUNS' : opts.fromDomain, opts.fromIdentity === undefined ? 'FROM' : opts.fromIdentity, false) + '</From>' +
      '<To>' + credential('DUNS', 'TO', false) + '</To>' +
      '<Sender>' + credential('DUNS', 'SENDER', true) + '</Sender>' +
      '</Header>';
  }

  function itemLine(extra) {
    return '<InvoiceDetailItem invoiceLineNumber="1" quantity="1">' +
      '<UnitOfMeasure>EA</UnitOfMeasure><UnitPrice/><InvoiceDetailItemReference/>' +
      (extra || '') + '</InvoiceDetailItem>';
  }

  function serviceLine(extra) {
    return '<InvoiceDetailServiceItem invoiceLineNumber="1" quantity="1">' + (extra || '') + '</InvoiceDetailServiceItem>';
  }

  function order(info, lines) {
    return '<InvoiceDetailOrder>' + (info === undefined ? '<InvoiceDetailOrderInfo/>' : info) + (lines === undefined ? itemLine() : lines) + '</InvoiceDetailOrder>';
  }

  function invoiceRequest(options) {
    var opts = options || {};
    var attributes = [];
    if (opts.invoiceID !== null) attributes.push('invoiceID="' + (opts.invoiceID || 'INV-TEST-001') + '"');
    if (opts.invoiceDate !== null) attributes.push('invoiceDate="' + (opts.invoiceDate || '2026-08-31T00:00:00-05:00') + '"');
    if (opts.purpose !== null) attributes.push('purpose="' + (opts.purpose || 'standard') + '"');
    var header = opts.omitInvoiceHeader ? '' : '<InvoiceDetailRequestHeader ' + attributes.join(' ') + '>' + (opts.headerChildren || '') + '</InvoiceDetailRequestHeader>';
    var orders = opts.orders === undefined ? order() : opts.orders;
    var invoiceSummary = opts.summary === undefined ? '<InvoiceDetailSummary/>' : opts.summary;
    return '<InvoiceDetailRequest>' + header + orders + invoiceSummary + '</InvoiceDetailRequest>';
  }

  function documentXml(options) {
    var opts = options || {};
    if (opts.nonCxmlRoot) return '<?xml version="1.0"?><Invoice/>';
    var rootAttributes = [];
    if (opts.payloadID !== null) rootAttributes.push('payloadID="' + (opts.payloadID || 'phase-8a-test@example') + '"');
    if (opts.timestamp !== null) rootAttributes.push('timestamp="' + (opts.timestamp || '2026-08-31T00:00:00-05:00') + '"');
    var header = opts.omitHeader ? '' : validHeader(opts.headerOptions);
    var payload = opts.requestPayload === undefined ? invoiceRequest(opts.invoiceOptions) : opts.requestPayload;
    return '<?xml version="1.0"?><cXML ' + rootAttributes.join(' ') + '>' + header + '<Request>' + payload + '</Request></cXML>';
  }

  function evaluateXml(xml) {
    var parsed = XMLValidator.Parser.parse(xml);
    assert(parsed.success, 'Production parser rejected test XML: ' + (parsed.error ? parsed.error.message : 'unknown error'));
    var analyzed = XMLValidator.Analyzer.analyze(parsed.document);
    assert(analyzed.success && analyzed.tree, 'Production analyzer failed to build the structural tree.');
    var ruleResult = XMLValidator.RuleEngine.run({
      rawXml: xml,
      xmlDocument: parsed.document,
      parserMetadata: parsed.metadata,
      versionContext: XMLValidator.extractVersionContext(xml, parsed.document),
      structuralObservations: XMLValidator.extractStructuralObservations(parsed.document),
      tree: analyzed.tree,
      nodeIndex: analyzed.nodeIndex,
      statistics: analyzed.statistics,
      namespaces: analyzed.namespaces,
      profile: null,
      template: null
    });
    return { parsed: parsed, analyzed: analyzed, rules: ruleResult };
  }

  function findingCount(evaluation, code) {
    return evaluation.rules.findings.filter(function (finding) { return finding.code === code; }).length;
  }

  function assertTriggers(xml, code) {
    var evaluation = evaluateXml(xml);
    assert(findingCount(evaluation, code) > 0, 'Expected finding ' + code + ' was not produced.');
  }

  function assertNoStructuralErrors(xml) {
    var evaluation = evaluateXml(xml);
    assert(evaluation.rules.systemIssues.length === 0, 'Rule engine produced a system issue.');
    assert(evaluation.rules.findingsSummary.errors === 0, 'Expected no structural errors; received: ' + evaluation.rules.findings.map(function (finding) { return finding.code; }).join(', '));
  }

  function verifyRegistry() {
    record('rules', 'All 11 Phase 8A baseline production rules remain registered and enabled', function () {
      var registered = XMLValidator.RuleEngine.getRegisteredRules();
      var actualIds = registered.map(function (rule) { return rule.id; });
      EXPECTED_RULE_IDS.forEach(function (id) {
        var index = actualIds.indexOf(id);
        assert(index !== -1, 'Missing Phase 8A baseline rule ' + id + '.');
        assert(registered[index].enabled === true, 'Phase 8A baseline rule ' + id + ' is disabled.');
      });
    });
  }

  function verifyReferences() {
    var references = XMLValidator.TemplateCatalog.getAll();
    record('references', 'Exactly 17 active production references exist', function () {
      assert(references.length === 17, 'Expected 17 references, found ' + references.length + '.');
    });

    references.forEach(function (reference) {
      record('references', reference.id + ' parses, analyzes, and passes all applicable rules', function () {
        var evaluation = evaluateXml(reference.xml);
        assert(evaluation.parsed.success, 'Reference did not parse.');
        assert(evaluation.analyzed.success && evaluation.analyzed.tree, 'Reference did not analyze.');
        assert(evaluation.rules.totalRules === XMLValidator.RuleEngine.getRegisteredRules().length, 'Not all registered rules were considered.');
        assert(evaluation.rules.executedRules >= EXPECTED_RULE_IDS.length, 'Not all 11 Phase 8A baseline rules executed.');
        assert(evaluation.rules.systemIssues.length === 0, 'Reference caused a rule-system issue.');
        assert(evaluation.rules.findingsSummary.errors === 0, 'Reference produced structural errors: ' + evaluation.rules.findings.map(function (finding) { return finding.code; }).join(', '));
      });
    });
  }

  function verifyScenarios() {
    var scenarios = [
      ['1. non-cXML root produces CXML_ENV_001', function () { assertTriggers(documentXml({ nonCxmlRoot: true }), 'CXML_ENV_001'); }],
      ['2. missing payloadID produces CXML_ENV_002', function () { assertTriggers(documentXml({ payloadID: null }), 'CXML_ENV_002'); }],
      ['3. missing timestamp produces CXML_ENV_003', function () { assertTriggers(documentXml({ timestamp: null }), 'CXML_ENV_003'); }],
      ['4. missing Header produces CXML_HEADER_001', function () { assertTriggers(documentXml({ omitHeader: true }), 'CXML_HEADER_001'); }],
      ['5. Credential without domain produces CXML_CREDENTIAL_001', function () { assertTriggers(documentXml({ headerOptions: { fromDomain: null } }), 'CXML_CREDENTIAL_001'); }],
      ['6. Credential without Identity produces CXML_CREDENTIAL_002', function () { assertTriggers(documentXml({ headerOptions: { fromIdentity: null } }), 'CXML_CREDENTIAL_002'); }],
      ['7. unsupported cXML request type produces COUPA_INV_001', function () { assertTriggers(documentXml({ requestPayload: '<PunchOutSetupRequest/>' }), 'COUPA_INV_001'); }],
      ['8. missing InvoiceDetailRequestHeader produces CXML_INV_HEADER_001', function () { assertTriggers(documentXml({ invoiceOptions: { omitInvoiceHeader: true } }), 'CXML_INV_HEADER_001'); }],
      ['9. missing invoiceID produces CXML_INV_HEADER_002', function () { assertTriggers(documentXml({ invoiceOptions: { invoiceID: null } }), 'CXML_INV_HEADER_002'); }],
      ['10. missing invoiceDate produces CXML_INV_HEADER_003', function () { assertTriggers(documentXml({ invoiceOptions: { invoiceDate: null } }), 'CXML_INV_HEADER_003'); }],
      ['11. valid InvoiceDetailOrder structure passes', function () { assertNoStructuralErrors(documentXml()); }],
      ['12. missing InvoiceDetailOrderInfo produces CXML_ORDER_001', function () { assertTriggers(documentXml({ invoiceOptions: { orders: order('', itemLine()) } }), 'CXML_ORDER_001'); }],
      ['13. InvoiceDetailOrderInfo after invoice lines produces CXML_ORDER_001', function () { assertTriggers(documentXml({ invoiceOptions: { orders: order(itemLine() + '<InvoiceDetailOrderInfo/>', '') } }), 'CXML_ORDER_001'); }],
      ['14. InvoiceDetailOrder with zero lines produces CXML_ORDER_001', function () { assertTriggers(documentXml({ invoiceOptions: { orders: order('<InvoiceDetailOrderInfo/>', '') } }), 'CXML_ORDER_001'); }],
      ['15. valid InvoiceDetailItem passes', function () { assertNoStructuralErrors(documentXml({ invoiceOptions: { orders: order('<InvoiceDetailOrderInfo/>', itemLine()) } })); }],
      ['16. valid InvoiceDetailServiceItem passes', function () { assertNoStructuralErrors(documentXml({ invoiceOptions: { orders: order('<InvoiceDetailOrderInfo/>', serviceLine()) } })); }],
      ['17. multiple InvoiceDetailOrder elements are individually validated', function () {
        var xml = documentXml({ invoiceOptions: { orders: order() + order('', itemLine()) } });
        var evaluation = evaluateXml(xml);
        var orderFindings = evaluation.rules.findings.filter(function (finding) { return finding.code === 'CXML_ORDER_001'; });
        assert(orderFindings.length === 1, 'Expected exactly one invalid order finding, found ' + orderFindings.length + '.');
        assert(orderFindings[0].path.indexOf('[2]') !== -1, 'Expected the finding to identify the second InvoiceDetailOrder.');
      }],
      ['18. purpose="standard" passes', function () { assertNoStructuralErrors(documentXml({ invoiceOptions: { purpose: 'standard' } })); }],
      ['19. purpose="creditMemo" does not automatically fail', function () { assertNoStructuralErrors(documentXml({ invoiceOptions: { purpose: 'creditMemo' } })); }],
      ['20. unbacked / non-PO invoice does not automatically fail', function () {
        assertNoStructuralErrors(documentXml({ invoiceOptions: { orders: order('<InvoiceDetailOrderInfo><DocumentReference payloadID=""/></InvoiceDetailOrderInfo>', itemLine()) } }));
      }],
      ['21. mixed PO + non-PO backing does not automatically fail', function () {
        var poInfo = '<InvoiceDetailOrderInfo><OrderReference><DocumentReference payloadID="PO-1"/></OrderReference></InvoiceDetailOrderInfo>';
        var nonPoInfo = '<InvoiceDetailOrderInfo><DocumentReference payloadID=""/></InvoiceDetailOrderInfo>';
        assertNoStructuralErrors(documentXml({ invoiceOptions: { orders: order(poInfo, itemLine()) + order(nonPoInfo, itemLine()) } }));
      }],
      ['22. missing PaymentTerm does not automatically fail', function () { assertNoStructuralErrors(documentXml()); }],
      ['23. Tax at line or summary level does not automatically fail', function () {
        var lineTax = '<Tax><Money currency="USD">0</Money></Tax>';
        var summaryTax = '<InvoiceDetailSummary><Tax><Money currency="USD">0</Money><TaxDetail purpose="tax" category="sales"/></Tax></InvoiceDetailSummary>';
        assertNoStructuralErrors(documentXml({ invoiceOptions: { orders: order('<InvoiceDetailOrderInfo/>', itemLine(lineTax)), summary: summaryTax } }));
      }]
    ];

    scenarios.forEach(function (scenario) {
      record('scenarios', scenario[0], scenario[1]);
    });
  }

  function render() {
    var ruleResult = results.filter(function (result) { return result.group === 'rules'; });
    var referenceResult = results.filter(function (result) { return result.group === 'references' && result.name !== 'Exactly 17 active production references exist'; });
    var referenceCountResult = results.filter(function (result) { return result.group === 'references' && result.name === 'Exactly 17 active production references exist'; });
    var scenarioResult = results.filter(function (result) { return result.group === 'scenarios'; });
    var rulesPassed = ruleResult.length === 1 && ruleResult[0].passed;
    var referencesPassed = referenceCountResult.length === 1 && referenceCountResult[0].passed && referenceResult.length === 17 && referenceResult.every(function (result) { return result.passed; });
    var scenariosPassed = scenarioResult.length === 23 && scenarioResult.every(function (result) { return result.passed; });
    var allPassed = rulesPassed && referencesPassed && scenariosPassed;

    var aggregate = document.getElementById('aggregate_output');
    var aggregateLines = [
      { text: (rulesPassed ? '11/11' : '0/11') + ' production rules baseline verified', passed: rulesPassed },
      { text: referenceResult.filter(function (result) { return result.passed; }).length + '/17 references passed', passed: referencesPassed },
      { text: scenarioResult.filter(function (result) { return result.passed; }).length + '/23 Phase 8A scenarios passed', passed: scenariosPassed }
    ];
    aggregateLines.forEach(function (line) {
      var div = document.createElement('div');
      div.className = 'summary-line ' + (line.passed ? 'pass' : 'fail');
      div.textContent = line.text;
      aggregate.appendChild(div);
    });

    var list = document.getElementById('test_results');
    results.forEach(function (result) {
      var item = document.createElement('li');
      item.className = result.passed ? 'pass' : 'fail';
      item.textContent = (result.passed ? 'PASS — ' : 'FAIL — ') + result.name + (result.passed ? '' : ': ' + result.detail);
      list.appendChild(item);
      console[result.passed ? 'log' : 'error']((result.passed ? 'PASS: ' : 'FAIL: ') + result.name + (result.passed ? '' : ' — ' + result.detail));
    });

    var status = document.getElementById('suite_status');
    status.className = allPassed ? 'pass' : 'fail';
    status.textContent = allPassed ? 'PASS — all Phase 8A.1A regression checks passed.' : 'FAIL — one or more Phase 8A.1A regression checks failed.';
    document.documentElement.setAttribute('data-suite-complete', 'true');
    document.documentElement.setAttribute('data-suite-passed', String(allPassed));
  }

  verifyRegistry();
  verifyReferences();
  verifyScenarios();
  render();
})();
