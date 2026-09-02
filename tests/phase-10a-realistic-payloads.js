(async function () {
  'use strict';
  var results = [];
  function assert(v, m) { if (!v) throw new Error(m); }
  function record(name, fn) { try { fn(); results.push({ name: name, passed: true }); } catch (e) { results.push({ name: name, passed: false, detail: e.message || String(e) }); } }
  function sortedUnique(values) { return values.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(); }
  function pipeline(source) {
    var parsed = XMLValidator.Parser.parse(source);
    if (!parsed.success) return { parsed: parsed };
    var analysis = XMLValidator.Analyzer.analyze(parsed.document);
    var observations = XMLValidator.extractStructuralObservations(parsed.document);
    var scenario = XMLValidator.ScenarioResolver.resolve({ xmlDocument: parsed.document, analysis: analysis, structuralObservations: observations });
    var context = { rawXml: source, xmlDocument: parsed.document, parserMetadata: parsed.metadata, structuralObservations: observations, scenario: scenario, tree: analysis.tree, nodeIndex: analysis.nodeIndex, statistics: analysis.statistics, namespaces: analysis.namespaces };
    var rules = XMLValidator.RuleEngine.run(context);
    rules.findings.forEach(function (finding) { finding.correctionPlan = XMLValidator.CorrectionEngine.plan(finding, context); });
    return { parsed: parsed, analysis: analysis, observations: observations, scenario: scenario, context: context, rules: rules };
  }
  var manifest = await fetch('sample-payloads/manifest.json').then(function (r) { assert(r.ok, 'Manifest failed to load'); return r.json(); });
  assert(manifest.length === 10, 'Expected exactly 10 payloads');
  assert(manifest.filter(function (m) { return m.difficulty === 'SIMPLE'; }).length === 5, 'Expected five SIMPLE payloads');
  assert(manifest.filter(function (m) { return m.difficulty === 'INTERMEDIATE'; }).length === 5, 'Expected five INTERMEDIATE payloads');
  var loaded = {};
  for (var i = 0; i < manifest.length; i++) loaded[manifest[i].id] = await fetch('sample-payloads/' + manifest[i].filename).then(function (r) { assert(r.ok, 'Payload failed to load'); return r.text(); });

  for (var m = 0; m < manifest.length; m++) {
    (function (entry) {
      record(entry.id + ' — ' + entry.description, function () {
        var evaluated = pipeline(loaded[entry.id]);
        assert(evaluated.parsed.success === (entry.expectedSyntaxStatus === 'VALID'), 'Unexpected syntax status');
        if (!evaluated.parsed.success) { assert(!evaluated.rules, 'Structural validation ran after syntax failure'); return; }
        assert(evaluated.analysis.success, 'Analyzer failed');
        var actualIds = sortedUnique(evaluated.rules.findings.filter(function (f) { return f.severity === 'error'; }).map(function (f) { return f.code; }));
        assert(JSON.stringify(actualIds) === JSON.stringify(entry.expectedRuleIds.slice().sort()), 'Expected [' + entry.expectedRuleIds + '], got [' + actualIds + ']');
        if (entry.intentionallyValid) assert(evaluated.rules.findingsSummary.errors === 0, 'Valid payload produced errors');
        if (!entry.expectedSafeCorrection) {
          evaluated.rules.findings.forEach(function (f) { assert(!f.correctionPlan.available, 'Unexpected safe correction for ' + f.code); });
        }
        assert(evaluated.scenario.documentType === 'INVOICE_DETAIL_REQUEST', 'Unexpected document type');
      });
    })(manifest[m]);
  }

  record('INTERMEDIATE_01 scenario and multiple PO feature', function () {
    var e = pipeline(loaded.INTERMEDIATE_01);
    assert(e.scenario.bodyMode === 'DETAILED' && e.scenario.lineProfile === 'QUANTITY' && e.scenario.backing === 'PO', 'Multiple-PO classification mismatch');
    assert(e.scenario.features.indexOf('MULTIPLE_PO_REFERENCES') >= 0, 'Multiple PO feature missing');
  });
  record('INTERMEDIATE_02 service profile has no deferred pricing error', function () {
    var e = pipeline(loaded.INTERMEDIATE_02);
    assert(e.scenario.lineProfile === 'SERVICE' && e.rules.findingsSummary.errors === 0, 'Service false positive');
  });
  record('INTERMEDIATE_03 MOVE_NODE end-to-end and exact undo source', function () {
    var original = loaded.INTERMEDIATE_03, e = pipeline(original), f = e.rules.findings.filter(function (x) { return x.code === 'CXML_ORDER_001'; })[0];
    assert(f.correctionPlan.safety === 'SAFE_RESTRUCTURE' && f.correctionPlan.operations[0].type === 'MOVE_NODE', 'Wrong safe plan');
    var applied = XMLValidator.CorrectionEngine.apply(f.correctionPlan, original); assert(applied.success, 'Move failed');
    var after = pipeline(applied.proposedXml); assert(!after.rules.findings.some(function (x) { return x.code === 'CXML_ORDER_001'; }), 'Finding remains');
    ['INV-TEST-103','PO-TEST-103','KEEP-LINE-103','25.00','<!--SYNTHETIC-COMMENT-KEEP-->'].forEach(function (v) { assert(applied.proposedXml.indexOf(v) >= 0, 'Unrelated value changed: ' + v); });
    assert(applied.originalXml === original && pipeline(applied.originalXml).rules.findings.some(function (x) { return x.code === 'CXML_ORDER_001'; }), 'Exact undo/revalidation failed');
  });
  record('INTERMEDIATE_04 metadata correction end-to-end', function () {
    var original = loaded.INTERMEDIATE_04, e = pipeline(original), f = e.rules.findings.filter(function (x) { return x.code === 'CXML_SCENARIO_001'; })[0];
    assert(f.correctionPlan.safety === 'SAFE_METADATA_FIX' && f.correctionPlan.operations[0].type === 'REMOVE_ATTRIBUTE', 'Wrong metadata plan');
    var applied = XMLValidator.CorrectionEngine.apply(f.correctionPlan, original); assert(applied.success, 'Metadata fix failed');
    assert(!pipeline(applied.proposedXml).rules.findings.some(function (x) { return x.code === 'CXML_SCENARIO_001'; }), 'Scenario finding remains');
    ['PAYLOAD-TEST-I04','INV-TEST-104','SUPPLIER-TEST','BUYER-TEST'].forEach(function (v) { assert(applied.proposedXml.indexOf(v) >= 0, 'Business value changed'); });
  });
  record('INTERMEDIATE_05 unrelated PO reference cannot satisfy cancel reference', function () {
    var e = pipeline(loaded.INTERMEDIATE_05), f = e.rules.findings.filter(function (x) { return x.code === 'CXML_SCENARIO_003'; })[0];
    assert(f && !f.correctionPlan.available && f.correctionPlan.safety === 'NOT_AUTOFIXABLE', 'Cancel finding was incorrectly fixable');
  });

  var passed = results.filter(function (r) { return r.passed; }).length;
  document.getElementById('suite_status').textContent = passed === results.length ? 'PASS' : 'FAIL';
  document.getElementById('aggregate_output').textContent = passed + '/' + results.length + ' Phase 10A realistic payload checks passed; 10/10 payloads evaluated';
  var list = document.getElementById('test_results'); results.forEach(function (r) { var li = document.createElement('li'); li.textContent = (r.passed ? 'PASS — ' : 'FAIL — ') + r.name + (r.detail ? ': ' + r.detail : ''); list.appendChild(li); });
})().catch(function (error) { document.getElementById('suite_status').textContent = 'FAIL'; document.getElementById('aggregate_output').textContent = error.message || String(error); });
