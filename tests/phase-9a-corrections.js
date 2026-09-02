(function () {
  'use strict';
  var results = [];

  function assert(condition, message) { if (!condition) throw new Error(message); }
  function test(name, fn) {
    try { fn(); results.push({ name: name, passed: true, detail: 'PASS' }); }
    catch (error) { results.push({ name: name, passed: false, detail: error.message || String(error) }); }
  }

  function header(options) {
    var opts = options || {};
    var payload = opts.payloadID === false ? '' : ' payloadID="P-9A"';
    var identity = opts.identity === false ? '' : '<Identity>sender</Identity>';
    var secret = opts.secret ? '<SharedSecret>' + opts.secret + '</SharedSecret>' : '';
    return '<cXML' + payload + ' timestamp="2026-09-01T00:00:00Z"><Header>' +
      '<From><Credential domain="DUNS"><Identity>from</Identity></Credential></From>' +
      '<To><Credential domain="DUNS"><Identity>to</Identity></Credential></To>' +
      '<Sender><Credential domain="DUNS">' + identity + secret + '</Credential></Sender></Header>';
  }

  function documentXml(options) {
    var opts = options || {};
    var invoiceID = opts.invoiceID === false ? '' : ' invoiceID="INV-9A"';
    var invoiceDate = opts.invoiceDate === false ? '' : ' invoiceDate="2026-09-01"';
    var quantity = opts.quantity === false ? '' : ' quantity="1"';
    var orderInfo = opts.orderInfo === false ? '' : '<InvoiceDetailOrderInfo/>';
    var item = '<InvoiceDetailItem invoiceLineNumber="1"' + quantity + '><UnitOfMeasure>EA</UnitOfMeasure><UnitPrice/><InvoiceDetailItemReference/></InvoiceDetailItem>';
    var orderBody = opts.infoAfterLine ? item + orderInfo : orderInfo + item;
    var headerIndicator = '<InvoiceDetailHeaderIndicator' + (opts.isHeaderInvoice ? ' isHeaderInvoice="' + opts.isHeaderInvoice + '"' : '') + '/>';
    var lineIndicator = opts.isAccountingInLine ? '<InvoiceDetailLineIndicator isAccountingInLine="' + opts.isAccountingInLine + '"/>' : '';
    var body = opts.bodyMode === 'HEADER' ? '<InvoiceDetailHeaderOrder/>' : '<InvoiceDetailOrder>' + orderBody + '</InvoiceDetailOrder>';
    return '<?xml version="1.0"?>' + header(opts) + '<Request><InvoiceDetailRequest>' +
      '<InvoiceDetailRequestHeader' + invoiceID + invoiceDate + ' purpose="standard" operation="new">' + headerIndicator + lineIndicator + '</InvoiceDetailRequestHeader>' +
      body + '<InvoiceDetailSummary/>' +
      '</InvoiceDetailRequest></Request></cXML>';
  }

  function evaluate(source) {
    var parsed = XMLValidator.Parser.parse(source);
    assert(parsed.success, 'Fixture did not parse.');
    var analysis = XMLValidator.Analyzer.analyze(parsed.document);
    assert(analysis.success, 'Fixture did not analyze.');
    var observations = XMLValidator.extractStructuralObservations(parsed.document);
    var scenario = XMLValidator.ScenarioResolver.resolve({ xmlDocument: parsed.document, analysis: analysis, structuralObservations: observations });
    var context = {
      rawXml: source, xmlDocument: parsed.document, parserMetadata: parsed.metadata,
      structuralObservations: observations, scenario: scenario, tree: analysis.tree,
      nodeIndex: analysis.nodeIndex, statistics: analysis.statistics, namespaces: analysis.namespaces
    };
    return { context: context, result: XMLValidator.RuleEngine.run(context) };
  }

  function findingFor(evaluation, code, predicate) {
    var matches = evaluation.result.findings.filter(function (finding) {
      return finding.code === code && (!predicate || predicate(finding));
    });
    assert(matches.length > 0, 'Expected finding ' + code + '.');
    return matches[0];
  }

  function expectNotAutofixable(source, code, predicate) {
    var evaluation = evaluate(source);
    var finding = findingFor(evaluation, code, predicate);
    var plan = XMLValidator.CorrectionEngine.plan(finding, evaluation.context);
    assert(finding.correction.safety === 'NOT_AUTOFIXABLE', 'Finding default safety is not conservative.');
    assert(finding.correction.autoFixable === false, 'Finding unexpectedly became auto-fixable.');
    assert(plan.available === false && plan.safety === 'NOT_AUTOFIXABLE', 'Planner offered an unsafe correction.');
    assert(plan.operations.length === 0 && plan.requiresUserInput === true, 'Unsafe plan must require input and contain no operations.');
  }

  test('1. Missing invoiceID is not auto-fixable', function () { expectNotAutofixable(documentXml({ invoiceID: false }), 'CXML_INV_HEADER_002'); });
  test('2. Missing invoiceDate is not auto-fixable', function () { expectNotAutofixable(documentXml({ invoiceDate: false }), 'CXML_INV_HEADER_003'); });
  test('3. Missing payloadID is not auto-fixable', function () { expectNotAutofixable(documentXml({ payloadID: false }), 'CXML_ENV_002'); });
  test('4. Missing quantity is not auto-fixable', function () { expectNotAutofixable(documentXml({ quantity: false }), 'CXML_ITEM_001', function (finding) { return /quantity/.test(finding.path || ''); }); });
  test('5. Missing Identity is not auto-fixable', function () { expectNotAutofixable(documentXml({ identity: false }), 'CXML_CREDENTIAL_002'); });
  test('6. Missing InvoiceDetailOrderInfo is not auto-fixable', function () { expectNotAutofixable(documentXml({ orderInfo: false }), 'CXML_ORDER_001'); });

  test('7. Existing misplaced OrderInfo produces a safe restructure plan', function () {
    var evaluation = evaluate(documentXml({ infoAfterLine: true }));
    var finding = findingFor(evaluation, 'CXML_ORDER_001');
    var plan = XMLValidator.CorrectionEngine.plan(finding, evaluation.context);
    assert(plan.available === true && plan.safety === 'SAFE_RESTRUCTURE', 'Expected a safe restructure plan.');
    assert(plan.requiresUserInput === false && plan.operations.length === 1, 'Expected one deterministic operation.');
    assert(plan.operations[0].type === 'MOVE_NODE', 'Expected MOVE_NODE operation.');
    assert(!/invoiceID|invoiceDate|quantity|price|currency|tax|secret/i.test(JSON.stringify(plan.operations[0])), 'Operation contains business data.');
  });

  test('8. Planning does not mutate XML', function () {
    var source = documentXml({ infoAfterLine: true });
    var evaluation = evaluate(source);
    var before = new XMLSerializer().serializeToString(evaluation.context.xmlDocument);
    XMLValidator.CorrectionEngine.plan(findingFor(evaluation, 'CXML_ORDER_001'), evaluation.context);
    var after = new XMLSerializer().serializeToString(evaluation.context.xmlDocument);
    assert(before === after && evaluation.context.rawXml === source, 'Planning mutated XML or raw input.');
  });

  test('9. SharedSecret is never exposed by correction planning', function () {
    var secret = 'DO-NOT-EXPOSE-9A';
    var evaluation = evaluate(documentXml({ identity: false, secret: secret }));
    var plan = XMLValidator.CorrectionEngine.plan(findingFor(evaluation, 'CXML_CREDENTIAL_002'), evaluation.context);
    assert(JSON.stringify(plan).indexOf(secret) === -1, 'Correction plan exposed SharedSecret.');
  });

  test('10. Repeated planning is deterministic', function () {
    var evaluation = evaluate(documentXml({ infoAfterLine: true }));
    var finding = findingFor(evaluation, 'CXML_ORDER_001');
    var first = XMLValidator.CorrectionEngine.plan(finding, evaluation.context);
    var second = XMLValidator.CorrectionEngine.plan(finding, evaluation.context);
    assert(JSON.stringify(first) === JSON.stringify(second), 'Repeated planning returned different operations.');
  });

  test('11. All 19 production rules have an explicit correction classification', function () {
    var classifications = XMLValidator.CorrectionEngine.getRuleClassifications();
    var rules = XMLValidator.RuleEngine.getRegisteredRules();
    assert(rules.length === 19, 'Expected 19 production rules.');
    assert(Object.keys(classifications).length === 19, 'Expected 19 rule classifications.');
    rules.forEach(function (rule) { assert(classifications[rule.id], 'Missing classification for ' + rule.id + '.'); });
  });

  test('12. Conflicting detailed-invoice metadata produces a safe remove-attribute plan', function () {
    var evaluation = evaluate(documentXml({ isHeaderInvoice: 'yes' }));
    var plan = XMLValidator.CorrectionEngine.plan(findingFor(evaluation, 'CXML_SCENARIO_001'), evaluation.context);
    assert(plan.available && plan.safety === 'SAFE_METADATA_FIX', 'Expected safe metadata correction.');
    assert(plan.operations.length === 1 && plan.operations[0].type === 'REMOVE_ATTRIBUTE', 'Expected deterministic attribute removal.');
  });

  test('13. Header accounting indicator produces a safe remove-attribute plan', function () {
    var evaluation = evaluate(documentXml({ bodyMode: 'HEADER', isHeaderInvoice: 'yes', isAccountingInLine: 'yes' }));
    var plan = XMLValidator.CorrectionEngine.plan(findingFor(evaluation, 'CXML_SCENARIO_002'), evaluation.context);
    assert(plan.available && plan.safety === 'SAFE_METADATA_FIX', 'Expected safe metadata correction.');
    assert(plan.operations.length === 1 && plan.operations[0].type === 'REMOVE_ATTRIBUTE', 'Expected deterministic attribute removal.');
  });

  var passed = results.filter(function (result) { return result.passed; }).length;
  document.getElementById('suite_status').textContent = passed === results.length ? 'PASS' : 'FAIL';
  document.getElementById('aggregate_output').textContent = passed + '/' + results.length + ' Phase 9A correction tests passed';
  var list = document.getElementById('test_results');
  results.forEach(function (result) {
    var item = document.createElement('li');
    item.textContent = (result.passed ? 'PASS — ' : 'FAIL — ') + result.name + (result.passed ? '' : ': ' + result.detail);
    list.appendChild(item);
  });
})();
