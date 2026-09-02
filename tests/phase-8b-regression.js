(function () {
  'use strict';

  var PHASE_8B_RULE_IDS = [
    'CXML_BODY_001',
    'CXML_BODY_002',
    'CXML_ITEM_001',
    'CXML_ITEM_002',
    'CXML_SERVICE_001'
  ];
  var results = [];

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function test(name, fn) {
    try {
      fn();
      results.push({ name: name, passed: true, detail: 'PASS' });
    } catch (error) {
      results.push({ name: name, passed: false, detail: error && error.message ? error.message : String(error) });
    }
  }

  function header() {
    return '<Header>' +
      '<From><Credential domain="DUNS"><Identity>FROM</Identity></Credential></From>' +
      '<To><Credential domain="DUNS"><Identity>TO</Identity></Credential></To>' +
      '<Sender><Credential domain="DUNS"><Identity>SENDER</Identity></Credential></Sender>' +
      '</Header>';
  }

  function invoiceHeader(extraAttributes, children) {
    return '<InvoiceDetailRequestHeader invoiceID="INV-8B" invoiceDate="2026-08-31"' +
      (extraAttributes || '') + '>' + (children || '') + '</InvoiceDetailRequestHeader>';
  }

  function item(attributes, children) {
    var attrs = attributes === undefined ? ' invoiceLineNumber="1" quantity="1"' : attributes;
    var body = children === undefined ?
      '<UnitOfMeasure>EA</UnitOfMeasure>' +
      '<UnitPrice><Money currency="USD">10</Money></UnitPrice>' +
      '<InvoiceDetailItemReference lineNumber="1"/>' +
      '<SubtotalAmount><Money currency="USD">10</Money></SubtotalAmount>' : children;
    return '<InvoiceDetailItem' + attrs + '>' + body + '</InvoiceDetailItem>';
  }

  function serviceItem(attributes, children) {
    var attrs = attributes === undefined ? ' invoiceLineNumber="1"' : attributes;
    return '<InvoiceDetailServiceItem' + attrs + '>' + (children || '') + '</InvoiceDetailServiceItem>';
  }

  function order(lines, info) {
    return '<InvoiceDetailOrder><InvoiceDetailOrderInfo>' + (info || '') + '</InvoiceDetailOrderInfo>' + lines + '</InvoiceDetailOrder>';
  }

  function summary(children) {
    return '<InvoiceDetailSummary>' + (children || '<SubtotalAmount><Money currency="USD">10</Money></SubtotalAmount>') + '</InvoiceDetailSummary>';
  }

  function documentXml(options) {
    var opts = options || {};
    var body = opts.body;
    if (body === undefined) {
      body = invoiceHeader(opts.headerAttributes, opts.headerChildren) +
        (opts.orders === undefined ? order(item()) : opts.orders) +
        (opts.includeSummary === false ? '' : summary(opts.summaryChildren));
    }
    return '<?xml version="1.0"?><cXML payloadID="phase-8b@example" timestamp="2026-08-31T00:00:00-05:00">' +
      header() + '<Request><InvoiceDetailRequest>' + body + '</InvoiceDetailRequest></Request></cXML>';
  }

  function evaluate(source) {
    var parsed = XMLValidator.Parser.parse(source);
    assert(parsed.success, 'Production parser rejected the fixture.');
    var analyzed = XMLValidator.Analyzer.analyze(parsed.document);
    assert(analyzed.success && analyzed.tree, 'Production analyzer rejected the fixture.');
    return XMLValidator.RuleEngine.run({
      rawXml: source,
      xmlDocument: parsed.document,
      parserMetadata: parsed.metadata,
      tree: analyzed.tree,
      nodeIndex: analyzed.nodeIndex,
      statistics: analyzed.statistics,
      namespaces: analyzed.namespaces
    });
  }

  function findingsFor(result, code) {
    return result.findings.filter(function (finding) { return finding.code === code; });
  }

  function phase8BFindings(result) {
    return result.findings.filter(function (finding) { return PHASE_8B_RULE_IDS.indexOf(finding.code) !== -1; });
  }

  function expectNoPhase8BErrors(source, label) {
    var findings = phase8BFindings(evaluate(source));
    assert(findings.length === 0, label + ' produced Phase 8B findings: ' + findings.map(function (finding) { return finding.code; }).join(', '));
  }

  function expectFinding(source, code, pathFragment) {
    var findings = findingsFor(evaluate(source), code);
    assert(findings.length === 1, 'Expected exactly one ' + code + ' finding, found ' + findings.length + '.');
    if (pathFragment) assert(findings[0].path.indexOf(pathFragment) !== -1, 'Finding did not identify ' + pathFragment + '.');
    assert(findings[0].correction && findings[0].correction.autoFixable === false, 'Finding did not retain the correction contract.');
  }

  test('1. Valid InvoiceDetailOrder passes Phase 8B validation', function () {
    var registered = XMLValidator.RuleEngine.getRegisteredRules();
    var phase8BRegistered = registered.filter(function (rule) {
      return PHASE_8B_RULE_IDS.indexOf(rule.id) !== -1;
    });
    assert(registered.length === 19, 'Expected 19 total production rules, found ' + registered.length + '.');
    assert(JSON.stringify(phase8BRegistered.map(function (rule) { return rule.id; })) === JSON.stringify(PHASE_8B_RULE_IDS), 'Phase 8B registry IDs or order differ from the approved contract.');
    assert(phase8BRegistered.every(function (rule) { return rule.enabled === true; }), 'One or more Phase 8B rules are disabled.');
    expectNoPhase8BErrors(documentXml(), 'Valid detailed invoice');
  });

  test('2. Missing InvoiceDetailSummary produces CXML_BODY_002', function () {
    expectFinding(documentXml({ includeSummary: false }), 'CXML_BODY_002', 'InvoiceDetailSummary');
  });

  test('3. InvoiceDetailItem missing invoiceLineNumber produces CXML_ITEM_001', function () {
    expectFinding(documentXml({ orders: order(item(' quantity="1"')) }), 'CXML_ITEM_001', '@invoiceLineNumber');
  });

  test('4. InvoiceDetailItem empty invoiceLineNumber produces CXML_ITEM_001', function () {
    expectFinding(documentXml({ orders: order(item(' invoiceLineNumber="" quantity="1"')) }), 'CXML_ITEM_001', '@invoiceLineNumber');
  });

  test('5. InvoiceDetailItem missing quantity produces CXML_ITEM_001', function () {
    expectFinding(documentXml({ orders: order(item(' invoiceLineNumber="1"')) }), 'CXML_ITEM_001', '@quantity');
  });

  test('6. InvoiceDetailItem empty quantity produces CXML_ITEM_001', function () {
    expectFinding(documentXml({ orders: order(item(' invoiceLineNumber="1" quantity=""')) }), 'CXML_ITEM_001', '@quantity');
  });

  test('7. InvoiceDetailItem missing UnitOfMeasure produces CXML_ITEM_002', function () {
    expectFinding(documentXml({ orders: order(item(undefined, '<UnitPrice/><InvoiceDetailItemReference/>')) }), 'CXML_ITEM_002', 'UnitOfMeasure');
  });

  test('8. InvoiceDetailItem missing UnitPrice produces CXML_ITEM_002', function () {
    expectFinding(documentXml({ orders: order(item(undefined, '<UnitOfMeasure>EA</UnitOfMeasure><InvoiceDetailItemReference/>')) }), 'CXML_ITEM_002', 'UnitPrice');
  });

  test('9. InvoiceDetailItem missing InvoiceDetailItemReference produces CXML_ITEM_002', function () {
    expectFinding(documentXml({ orders: order(item(undefined, '<UnitOfMeasure>EA</UnitOfMeasure><UnitPrice/>')) }), 'CXML_ITEM_002', 'InvoiceDetailItemReference');
  });

  test('10. Missing detailed-item SubtotalAmount does not produce a Phase 8B error', function () {
    expectNoPhase8BErrors(documentXml({ orders: order(item(undefined, '<UnitOfMeasure>EA</UnitOfMeasure><UnitPrice/><InvoiceDetailItemReference/>')) }), 'Optional SubtotalAmount omission');
  });

  test('11. Valid InvoiceDetailServiceItem passes independently', function () {
    expectNoPhase8BErrors(documentXml({ orders: order(serviceItem()) }), 'Valid service line');
  });

  test('12. Service item missing invoiceLineNumber produces CXML_SERVICE_001', function () {
    expectFinding(documentXml({ orders: order(serviceItem('')) }), 'CXML_SERVICE_001', '@invoiceLineNumber');
  });

  test('13. Service item empty invoiceLineNumber produces CXML_SERVICE_001', function () {
    expectFinding(documentXml({ orders: order(serviceItem(' invoiceLineNumber=""')) }), 'CXML_SERVICE_001', '@invoiceLineNumber');
  });

  test('14. Service item without quantity does not automatically fail', function () {
    expectNoPhase8BErrors(documentXml({ orders: order(serviceItem(' invoiceLineNumber="1"')) }), 'Service line without quantity');
  });

  test('15. Service item does not receive detailed-item quantity or child rules', function () {
    var result = evaluate(documentXml({ orders: order(serviceItem()) }));
    assert(findingsFor(result, 'CXML_ITEM_001').length === 0, 'Detailed-item attribute rule leaked onto service line.');
    assert(findingsFor(result, 'CXML_ITEM_002').length === 0, 'Detailed-item child rule leaked onto service line.');
  });

  test('16. Multiple InvoiceDetailOrder elements pass when each line is valid', function () {
    expectNoPhase8BErrors(documentXml({ orders: order(item(' invoiceLineNumber="1" quantity="1"')) + order(item(' invoiceLineNumber="2" quantity="1"')) }), 'Multiple orders');
  });

  test('17. purpose="standard" remains supported', function () {
    expectNoPhase8BErrors(documentXml({ headerAttributes: ' purpose="standard"' }), 'Standard purpose');
  });

  test('18. purpose="creditMemo" remains supported', function () {
    expectNoPhase8BErrors(documentXml({ headerAttributes: ' purpose="creditMemo"' }), 'Credit memo purpose');
  });

  test('19. Line Tax remains optional and accepted', function () {
    var children = '<UnitOfMeasure>EA</UnitOfMeasure><UnitPrice/><InvoiceDetailItemReference/><Tax/>';
    expectNoPhase8BErrors(documentXml({ orders: order(item(undefined, children)) }), 'Line tax');
  });

  test('20. Summary Tax remains accepted', function () {
    expectNoPhase8BErrors(documentXml({ summaryChildren: '<SubtotalAmount/><Tax/>' }), 'Summary tax');
  });

  test('21. Mixed backing remains an observation, not an error', function () {
    var info = '<OrderReference/><MasterAgreementReference/>';
    expectNoPhase8BErrors(documentXml({ orders: order(item(), info) }), 'Mixed backing');
  });

  test('22. Unbacked invoice remains accepted', function () {
    expectNoPhase8BErrors(documentXml({ orders: order(item(), '') }), 'Unbacked invoice');
  });

  test('23. Missing PaymentTerm does not automatically fail', function () {
    expectNoPhase8BErrors(documentXml(), 'Invoice without PaymentTerm');
  });

  test('24. Missing Extrinsic does not automatically fail', function () {
    expectNoPhase8BErrors(documentXml(), 'Invoice without Extrinsic');
  });

  test('25. InvoiceDetailHeaderOrder and InvoiceDetailOrder together produce CXML_BODY_001', function () {
    var body = invoiceHeader() + '<InvoiceDetailHeaderOrder/>' + order(item()) + summary();
    expectFinding(documentXml({ body: body }), 'CXML_BODY_001', 'InvoiceDetailRequest');
  });

  test('26. Header-only invoice mode is not rejected as a missing detailed order', function () {
    var body = invoiceHeader() + '<InvoiceDetailHeaderOrder/>' + summary();
    var result = evaluate(documentXml({ body: body }));
    assert(findingsFor(result, 'CXML_ORDER_001').length === 0, 'Header-only mode was rejected by the detailed-order rule.');
    assert(phase8BFindings(result).length === 0, 'Header-only mode produced an unexpected Phase 8B finding.');
  });

  var passed = results.filter(function (result) { return result.passed; }).length;
  var aggregate = document.getElementById('aggregate_output');
  aggregate.textContent = passed + '/26 Phase 8B scenarios passed';
  aggregate.className = passed === 26 ? 'pass' : 'fail';

  var list = document.getElementById('test_results');
  results.forEach(function (result) {
    var itemElement = document.createElement('li');
    itemElement.className = result.passed ? 'pass' : 'fail';
    itemElement.textContent = (result.passed ? 'PASS — ' : 'FAIL — ') + result.name + (result.passed ? '' : ': ' + result.detail);
    list.appendChild(itemElement);
    console[result.passed ? 'log' : 'error'](itemElement.textContent);
  });

  var allPassed = results.length === 26 && passed === 26;
  var status = document.getElementById('suite_status');
  status.className = allPassed ? 'pass' : 'fail';
  status.textContent = allPassed ? 'PASS — all Phase 8B regression checks passed.' : 'FAIL — Phase 8B production behavior is not yet implemented.';
  document.documentElement.setAttribute('data-suite-complete', 'true');
  document.documentElement.setAttribute('data-suite-passed', String(allPassed));
})();
