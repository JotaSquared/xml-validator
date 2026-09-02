(function () {
  'use strict';
  var results = [];
  function assert(v, m) { if (!v) throw new Error(m); }
  function test(n, f) { try { f(); results.push({ name: n, passed: true }); } catch (e) { results.push({ name: n, passed: false, detail: e.message }); } }
  function xml(o) {
    o = o || {};
    var secret = o.secret ? '<SharedSecret>' + o.secret + '</SharedSecret>' : '';
    var headerIndicator = '<InvoiceDetailHeaderIndicator' + (o.headerValue ? ' isHeaderInvoice="' + o.headerValue + '"' : '') + '/>';
    var lineIndicator = o.accounting ? '<InvoiceDetailLineIndicator isAccountingInLine="yes"/>' : '';
    var item = '<InvoiceDetailItem invoiceLineNumber="L-KEEP" quantity="7"><UnitOfMeasure>EA</UnitOfMeasure><UnitPrice><Money currency="USD">9.25</Money></UnitPrice><InvoiceDetailItemReference/><Description><![CDATA[KEEP <x>]]></Description></InvoiceDetailItem>';
    var order = '<InvoiceDetailOrder>' + (o.misplaced ? item + '<!--KEEP--><InvoiceDetailOrderInfo><OrderReference><DocumentReference payloadID="PO-KEEP"/></OrderReference></InvoiceDetailOrderInfo>' : '<InvoiceDetailOrderInfo/>' + item) + '</InvoiceDetailOrder>';
    var body = o.headerBody ? '<InvoiceDetailHeaderOrder/>' : order;
    return '<?xml version="1.0"?><cXML payloadID="PAYLOAD-KEEP" timestamp="2026-09-01T00:00:00Z"><Header><From><Credential domain="DUNS"><Identity>FROM-KEEP</Identity></Credential></From><To><Credential domain="DUNS"><Identity>TO-KEEP</Identity></Credential></To><Sender><Credential domain="DUNS"><Identity>SENDER-KEEP</Identity>' + secret + '</Credential></Sender></Header><Request><InvoiceDetailRequest><InvoiceDetailRequestHeader' + (o.noInvoiceID ? '' : ' invoiceID="INV-KEEP"') + ' invoiceDate="2026-09-01" purpose="standard" operation="new">' + headerIndicator + lineIndicator + '</InvoiceDetailRequestHeader>' + body + '<InvoiceDetailSummary/></InvoiceDetailRequest></Request></cXML>';
  }
  function evaluate(source) {
    var p = XMLValidator.Parser.parse(source); assert(p.success, 'Parse failed');
    var a = XMLValidator.Analyzer.analyze(p.document), obs = XMLValidator.extractStructuralObservations(p.document);
    var scenario = XMLValidator.ScenarioResolver.resolve({ xmlDocument: p.document, analysis: a, structuralObservations: obs });
    var context = { rawXml: source, xmlDocument: p.document, parserMetadata: p.metadata, structuralObservations: obs, scenario: scenario, tree: a.tree, nodeIndex: a.nodeIndex, statistics: a.statistics, namespaces: a.namespaces };
    return { context: context, rules: XMLValidator.RuleEngine.run(context) };
  }
  function planned(source, code) {
    var e = evaluate(source), finding = e.rules.findings.filter(function (f) { return f.code === code; })[0];
    assert(finding, 'Missing finding ' + code);
    return { source: source, evaluation: e, finding: finding, plan: XMLValidator.CorrectionEngine.plan(finding, e.context) };
  }
  function hasFinding(source, code) { return evaluate(source).rules.findings.some(function (f) { return f.code === code; }); }

  var move = planned(xml({ misplaced: true }), 'CXML_ORDER_001');
  test('1. Misplaced OrderInfo has preview', function () { var p = XMLValidator.CorrectionEngine.preview(move.plan, move.source); assert(p.success && p.operation === 'MOVE_NODE', 'Missing MOVE_NODE preview'); });
  var moved = XMLValidator.CorrectionEngine.apply(move.plan, move.source);
  test('2. MOVE_NODE applies', function () { assert(moved.success && moved.proposedXml !== move.source, 'Move not applied'); });
  test('3. Moved rule passes after revalidation', function () { assert(!hasFinding(moved.proposedXml, 'CXML_ORDER_001'), 'Finding remains'); });
  test('4. Unrelated values, comments, and CDATA remain byte-identical', function () { ['PAYLOAD-KEEP','INV-KEEP','PO-KEEP','L-KEEP','quantity="7"','9.25','<!--KEEP-->','<![CDATA[KEEP <x>]]>'].forEach(function (v) { assert(moved.proposedXml.indexOf(v) >= 0, 'Changed ' + v); }); });
  var detailed = planned(xml({ headerValue: 'yes' }), 'CXML_SCENARIO_001');
  test('5. Detailed conflict preview', function () { assert(XMLValidator.CorrectionEngine.preview(detailed.plan, detailed.source).operation === 'REMOVE_ATTRIBUTE', 'Wrong preview'); });
  test('6. Detailed conflicting attribute removed', function () { var a = XMLValidator.CorrectionEngine.apply(detailed.plan, detailed.source); assert(a.success && a.proposedXml.indexOf('isHeaderInvoice') < 0, 'Attribute remains'); });
  var accounting = planned(xml({ headerBody: true, headerValue: 'yes', accounting: true }), 'CXML_SCENARIO_002');
  test('7. Header accounting attribute removed', function () { var a = XMLValidator.CorrectionEngine.apply(accounting.plan, accounting.source); assert(a.success && a.proposedXml.indexOf('isAccountingInLine') < 0, 'Attribute remains'); });
  var header = planned(xml({ headerBody: true }), 'CXML_SCENARIO_001');
  test('8. Header indicator is deterministically set', function () { var a = XMLValidator.CorrectionEngine.apply(header.plan, header.source); assert(a.success && a.proposedXml.indexOf('isHeaderInvoice="yes"') >= 0, 'Header value not set'); });
  var manual = planned(xml({ noInvoiceID: true }), 'CXML_INV_HEADER_002');
  test('9. Manual finding exposes no applicable plan', function () { assert(!manual.plan.available && !XMLValidator.CorrectionEngine.preview(manual.plan, manual.source).success, 'Manual fix exposed'); });
  test('10. Missing invoiceID cannot be fixed', function () { assert(!XMLValidator.CorrectionEngine.apply(manual.plan, manual.source).success, 'Business value generated'); });
  test('11. XML edit changes state fingerprint', function () { assert(XMLValidator.CorrectionEngine.fingerprint(move.source + ' ') !== move.plan.xmlState, 'Edit not detected'); });
  test('12. Stale plan is blocked', function () { var a = XMLValidator.CorrectionEngine.apply(move.plan, move.source + ' '); assert(!a.success && a.stale, 'Stale plan applied'); });
  test('13. Preview leaves original XML unchanged', function () { var before = move.source; XMLValidator.CorrectionEngine.preview(move.plan, move.source); assert(move.source === before, 'Original changed'); });
  test('14. Undo source restores exact previous XML', function () { assert(moved.originalXml === move.source, 'Exact undo text unavailable'); });
  test('15. Restored XML revalidates to original finding', function () { assert(hasFinding(moved.originalXml, 'CXML_ORDER_001'), 'Undo revalidation mismatch'); });
  test('16. Repeated apply is blocked after XML changes', function () { var a = XMLValidator.CorrectionEngine.apply(move.plan, moved.proposedXml); assert(!a.success && a.stale, 'Repeated apply succeeded'); });
  test('17. SharedSecret never appears in preview', function () { var s = 'SECRET-NEVER-SHOW'; var p = planned(xml({ misplaced: true, secret: s }), 'CXML_ORDER_001'); assert(JSON.stringify(XMLValidator.CorrectionEngine.preview(p.plan, p.source)).indexOf(s) < 0, 'Secret exposed'); });
  test('18. Unsupported operation fails without changing XML', function () { var bad = JSON.parse(JSON.stringify(move.plan)); bad.operations[0].type = 'REPLACE_XML'; var a = XMLValidator.CorrectionEngine.apply(bad, move.source); assert(!a.success && a.proposedXml === move.source, 'Unsupported mutation applied'); });

  var passed = results.filter(function (r) { return r.passed; }).length;
  document.getElementById('suite_status').textContent = passed === results.length ? 'PASS' : 'FAIL';
  document.getElementById('aggregate_output').textContent = passed + '/' + results.length + ' Phase 9B apply-fix tests passed';
  var list = document.getElementById('test_results'); results.forEach(function (r) { var li = document.createElement('li'); li.textContent = (r.passed ? 'PASS — ' : 'FAIL — ') + r.name + (r.detail ? ': ' + r.detail : ''); list.appendChild(li); });
})();
