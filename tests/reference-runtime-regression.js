(function () {
  'use strict';
  var results = [];
  var catalog = XMLValidator.TemplateCatalog.getAll();
  var preflight = XMLValidator.TemplateCatalog.validateCatalog();
  var registeredRules = XMLValidator.RuleEngine.getRegisteredRules();

  function record(name, passed, detail) {
    results.push({ name: name, passed: passed, detail: detail });
  }

  record('Catalog preflight', preflight.total === 17 && preflight.valid === 17 && preflight.invalid === 0,
    preflight.valid + '/17 templates prepared');

  catalog.forEach(function (template) {
    var prepared = XMLValidator.TemplateCatalog.prepareTemplate(template.id);
    if (!prepared.success) {
      record(template.id, false, prepared.error || 'Preparation failed');
      return;
    }
    var observations = XMLValidator.extractStructuralObservations(prepared.parseResult.document);
    var scenario = XMLValidator.ScenarioResolver.resolve({
      xmlDocument: prepared.parseResult.document,
      analysis: prepared.analysisResult,
      structuralObservations: observations
    });
    var ruleResult = XMLValidator.RuleEngine.run({
      rawXml: template.xml,
      xmlDocument: prepared.parseResult.document,
      parserMetadata: prepared.parseResult.metadata,
      structuralObservations: observations,
      scenario: scenario,
      tree: prepared.analysisResult.tree,
      nodeIndex: prepared.analysisResult.nodeIndex,
      statistics: prepared.analysisResult.statistics,
      namespaces: prepared.analysisResult.namespaces
    });
    var comparison = XMLValidator.Comparator.compare(prepared.analysisResult, prepared.analysisResult, {
      compareTextValues: true,
      compareAttributeValues: true,
      referenceId: template.id
    });
    var passed = registeredRules.length === 19 && registeredRules.every(function (rule) { return rule.enabled === true; }) &&
      ruleResult.totalRules === 19 && ruleResult.executedRules >= 16 && ruleResult.findingsSummary.errors === 0 &&
      ruleResult.systemIssues.length === 0 && comparison.success && comparison.summary.totalDifferences === 0 &&
      scenario.documentType === 'INVOICE_DETAIL_REQUEST';
    var findingCodes = ruleResult.findings.map(function (finding) { return finding.code; }).join(', ');
    record(template.id, passed, 'parser/analyzer/catalog/self-compare; 19 registered, ' +
      ruleResult.executedRules + ' applicable rules executed; scenario=' + scenario.scenarioId +
      (findingCodes ? '; findings=' + findingCodes : ''));
  });

  var referencesPassed = results.slice(1).filter(function (result) { return result.passed; }).length;
  var allPassed = results[0].passed && referencesPassed === 17;
  document.getElementById('suite_status').textContent = allPassed ? 'PASS' : 'FAIL';
  document.getElementById('aggregate_output').textContent = referencesPassed + '/17 approved references passed complete runtime checks';
  var list = document.getElementById('test_results');
  results.forEach(function (result) {
    var item = document.createElement('li');
    item.textContent = (result.passed ? 'PASS — ' : 'FAIL — ') + result.name + ': ' + result.detail;
    list.appendChild(item);
  });
})();
