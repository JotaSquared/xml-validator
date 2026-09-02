(function () {
  'use strict';
  var RULE_IDS = ['CXML_SCENARIO_001', 'CXML_SCENARIO_002', 'CXML_SCENARIO_003'];
  var results = [];

  function assert(condition, message) { if (!condition) throw new Error(message); }
  function test(name, fn) {
    try { fn(); results.push({ name: name, passed: true, detail: 'PASS' }); }
    catch (error) { results.push({ name: name, passed: false, detail: error.message || String(error) }); }
  }

  function transportHeader() {
    return '<Header><From><Credential domain="DUNS"><Identity>F</Identity></Credential></From>' +
      '<To><Credential domain="DUNS"><Identity>T</Identity></Credential></To>' +
      '<Sender><Credential domain="DUNS"><Identity>S</Identity></Credential></Sender></Header>';
  }

  function quantityLine(extra) {
    return '<InvoiceDetailItem invoiceLineNumber="1" quantity="1"><UnitOfMeasure>EA</UnitOfMeasure>' +
      '<UnitPrice/><InvoiceDetailItemReference/>' + (extra || '') + '</InvoiceDetailItem>';
  }

  function detailedOrder(backing, lineExtra) {
    return '<InvoiceDetailOrder><InvoiceDetailOrderInfo>' + (backing || '') + '</InvoiceDetailOrderInfo>' + quantityLine(lineExtra) + '</InvoiceDetailOrder>';
  }

  function documentXml(options) {
    var opts = options || {};
    var indicator = opts.headerIndicator === false ? '' : '<InvoiceDetailHeaderIndicator' + (opts.isHeaderInvoice ? ' isHeaderInvoice="' + opts.isHeaderInvoice + '"' : '') + '/>';
    var lineIndicator = opts.isAccountingInLine === undefined ? '' : '<InvoiceDetailLineIndicator isAccountingInLine="' + opts.isAccountingInLine + '"/>';
    var documentReference = opts.headerDocumentReference === undefined ? '' : '<DocumentReference payloadID="' + opts.headerDocumentReference + '"/>';
    var requestHeader = '<InvoiceDetailRequestHeader invoiceID="8D" invoiceDate="2026-09-01" purpose="' + (opts.purpose || 'standard') + '" operation="' + (opts.operation || 'new') + '">' + indicator + lineIndicator + documentReference + '</InvoiceDetailRequestHeader>';
    var body = opts.bodyMode === 'HEADER' ? '<InvoiceDetailHeaderOrder/>' : detailedOrder(opts.backing, opts.lineExtra);
    return '<?xml version="1.0"?><cXML payloadID="8d" timestamp="2026-09-01T00:00:00Z">' + transportHeader() + '<Request><InvoiceDetailRequest>' + requestHeader + body + '<InvoiceDetailSummary/></InvoiceDetailRequest></Request></cXML>';
  }

  function evaluate(source) {
    var parsed = XMLValidator.Parser.parse(source);
    assert(parsed.success, 'Production parser rejected fixture.');
    var analysis = XMLValidator.Analyzer.analyze(parsed.document);
    assert(analysis.success, 'Production analyzer rejected fixture.');
    var observations = XMLValidator.extractStructuralObservations(parsed.document);
    var scenario = XMLValidator.ScenarioResolver.resolve({ xmlDocument: parsed.document, analysis: analysis, structuralObservations: observations });
    return XMLValidator.RuleEngine.run({
      rawXml: source, xmlDocument: parsed.document, parserMetadata: parsed.metadata,
      structuralObservations: observations, scenario: scenario, tree: analysis.tree,
      nodeIndex: analysis.nodeIndex, statistics: analysis.statistics, namespaces: analysis.namespaces
    });
  }

  function scenarioFindings(result) {
    return result.findings.filter(function (finding) { return RULE_IDS.indexOf(finding.code) !== -1; });
  }
  function expectNoScenarioError(source, label) {
    var findings = scenarioFindings(evaluate(source));
    assert(findings.length === 0, label + ' produced ' + findings.map(function (finding) { return finding.code; }).join(', '));
  }
  function expectFinding(source, code) {
    var findings = scenarioFindings(evaluate(source)).filter(function (finding) { return finding.code === code; });
    assert(findings.length === 1, 'Expected one ' + code + ', found ' + findings.length + '.');
    assert(findings[0].correction && findings[0].correction.expected && findings[0].correction.actual && findings[0].correction.suggestion && findings[0].correction.autoFixable === false, 'Incomplete correction contract.');
  }

  test('1. Header body + isHeaderInvoice=yes passes', function () {
    var registered = XMLValidator.RuleEngine.getRegisteredRules();
    assert(registered.length === 19, 'Expected 19 production rules, found ' + registered.length + '.');
    assert(RULE_IDS.every(function (id) { return registered.some(function (rule) { return rule.id === id && rule.enabled; }); }), 'Scenario rule registry is incomplete.');
    expectNoScenarioError(documentXml({ bodyMode: 'HEADER', isHeaderInvoice: 'yes' }), 'Valid header invoice');
  });
  test('2. Header body without isHeaderInvoice=yes errors', function () { expectFinding(documentXml({ bodyMode: 'HEADER' }), 'CXML_SCENARIO_001'); });
  test('3. Detailed body without isHeaderInvoice passes', function () { expectNoScenarioError(documentXml(), 'Detailed invoice'); });
  test('4. Detailed body + isHeaderInvoice=yes errors', function () { expectFinding(documentXml({ isHeaderInvoice: 'yes' }), 'CXML_SCENARIO_001'); });
  test('5. Header invoice + isAccountingInLine errors', function () { expectFinding(documentXml({ bodyMode: 'HEADER', isHeaderInvoice: 'yes', isAccountingInLine: 'yes' }), 'CXML_SCENARIO_002'); });
  test('6. Detailed invoice + isAccountingInLine has no scenario error', function () { expectNoScenarioError(documentXml({ isAccountingInLine: 'yes' }), 'Detailed accounting indicator'); });
  test('7. Delete + direct non-empty header DocumentReference passes', function () { expectNoScenarioError(documentXml({ operation: 'delete', headerDocumentReference: 'ORIGINAL-1' }), 'Valid cancel'); });
  test('8. Delete without DocumentReference errors', function () { expectFinding(documentXml({ operation: 'delete' }), 'CXML_SCENARIO_003'); });
  test('9. OrderReference cannot satisfy cancel reference', function () { expectFinding(documentXml({ operation: 'delete', backing: '<OrderReference><DocumentReference payloadID="PO-1"/></OrderReference>' }), 'CXML_SCENARIO_003'); });
  test('10. MasterAgreementReference cannot satisfy cancel reference', function () { expectFinding(documentXml({ operation: 'delete', backing: '<MasterAgreementReference><DocumentReference payloadID="C-1"/></MasterAgreementReference>' }), 'CXML_SCENARIO_003'); });
  test('11. Approved detailed creditMemo pattern gets no credit-specific error', function () { expectNoScenarioError(documentXml({ purpose: 'creditMemo' }), 'Detailed credit memo'); });
  test('12. PO backing gets no universal scenario error', function () { expectNoScenarioError(documentXml({ backing: '<OrderReference><DocumentReference payloadID="PO-1"/></OrderReference>' }), 'PO backing'); });
  test('13. Contract backing gets no universal scenario error', function () { expectNoScenarioError(documentXml({ backing: '<MasterAgreementReference><DocumentReference payloadID="C-1"/></MasterAgreementReference>' }), 'Contract backing'); });
  test('14. NONE backing gets no universal scenario error', function () { expectNoScenarioError(documentXml(), 'No backing'); });
  test('15. Mixed/empty backing gets no universal scenario error', function () { expectNoScenarioError(documentXml({ backing: '<OrderReference><DocumentReference payloadID="PO-1"/></OrderReference><MasterAgreementReference><DocumentReference payloadID=""/></MasterAgreementReference>' }), 'Mixed empty backing'); });
  test('16. LINE/SUMMARY/BOTH tax profiles get no tax-compliance error', function () {
    expectNoScenarioError(documentXml({ lineExtra: '<Tax/>' }), 'Line tax');
    expectNoScenarioError(documentXml().replace('<InvoiceDetailSummary/>', '<InvoiceDetailSummary><Tax/></InvoiceDetailSummary>'), 'Summary tax');
    expectNoScenarioError(documentXml({ lineExtra: '<Tax/>' }).replace('<InvoiceDetailSummary/>', '<InvoiceDetailSummary><Tax/></InvoiceDetailSummary>'), 'Both tax');
  });

  var passed = results.filter(function (result) { return result.passed; }).length;
  document.getElementById('suite_status').textContent = passed === results.length ? 'PASS' : 'FAIL';
  document.getElementById('aggregate_output').textContent = passed + '/' + results.length + ' Phase 8D scenarios passed';
  var list = document.getElementById('test_results');
  results.forEach(function (result) { var item = document.createElement('li'); item.textContent = (result.passed ? 'PASS — ' : 'FAIL — ') + result.name + (result.passed ? '' : ': ' + result.detail); list.appendChild(item); });
})();
