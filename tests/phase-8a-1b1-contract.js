(function () {
  'use strict';

  var results = [];

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function test(name, fn) {
    try {
      fn();
      results.push({ name: name, passed: true, detail: 'PASS' });
    } catch (error) {
      results.push({
        name: name,
        passed: false,
        detail: error && error.message ? error.message : String(error)
      });
    }
  }

  test('Non-object findings receive the invariant correction schema', function () {
    XMLValidator.RuleEngine.clear();
    var registration = XMLValidator.RuleEngine.register({
      id: 'TEST_NON_OBJECT_FINDING',
      name: 'Non-object finding contract test',
      severity: 'warning',
      enabled: true,
      source: { type: 'INTERNAL_CONFIRMED_RULE', title: 'Phase 8A.1B-1 regression test' },
      validate: function () { return ['malformed finding']; }
    });
    assert(registration.success, 'Test rule could not be registered.');

    var runResult = XMLValidator.RuleEngine.run({});
    assert(runResult.findings.length === 1, 'Expected one normalized finding.');
    var finding = runResult.findings[0];
    assert(finding.correction && typeof finding.correction === 'object', 'Normalized finding is missing a correction object.');
    assert(Object.prototype.hasOwnProperty.call(finding.correction, 'expected'), 'correction.expected is missing.');
    assert(Object.prototype.hasOwnProperty.call(finding.correction, 'actual'), 'correction.actual is missing.');
    assert(Object.prototype.hasOwnProperty.call(finding.correction, 'suggestion'), 'correction.suggestion is missing.');
    assert(Object.prototype.hasOwnProperty.call(finding.correction, 'autoFixable'), 'correction.autoFixable is missing.');
    assert(finding.correction.expected === null, 'Fallback correction.expected must be null.');
    assert(finding.correction.actual === null, 'Fallback correction.actual must be null.');
    assert(finding.correction.suggestion === null, 'Fallback correction.suggestion must be null.');
    assert(finding.correction.autoFixable === false, 'Fallback correction.autoFixable must be false.');
  });

  test('Rule contracts reject source.type values outside the existing allowlist', function () {
    var validation = XMLValidator.RuleEngine.validateContract({
      id: 'TEST_INVALID_SOURCE_TYPE',
      name: 'Invalid source type contract test',
      severity: 'error',
      enabled: true,
      source: { type: 'UNAPPROVED_SOURCE_TYPE', title: 'Phase 8A.1B-1 regression test' },
      validate: function () { return []; }
    });
    assert(validation.valid === false, 'Contract unexpectedly accepted an unapproved source.type.');
    assert(validation.errors.some(function (error) { return error.indexOf('source.type') !== -1; }), 'Contract rejection did not identify source.type.');
  });

  var list = document.getElementById('test_results');
  results.forEach(function (result) {
    var item = document.createElement('li');
    item.className = result.passed ? 'pass' : 'fail';
    item.textContent = (result.passed ? 'PASS — ' : 'FAIL — ') + result.name + (result.passed ? '' : ': ' + result.detail);
    list.appendChild(item);
    console[result.passed ? 'log' : 'error'](item.textContent);
  });

  var allPassed = results.length === 2 && results.every(function (result) { return result.passed; });
  var status = document.getElementById('suite_status');
  status.className = allPassed ? 'pass' : 'fail';
  status.textContent = allPassed ? 'PASS — 2/2 contract tests passed.' : 'FAIL — ' + results.filter(function (result) { return result.passed; }).length + '/2 contract tests passed.';
  document.documentElement.setAttribute('data-suite-complete', 'true');
  document.documentElement.setAttribute('data-suite-passed', String(allPassed));
})();
