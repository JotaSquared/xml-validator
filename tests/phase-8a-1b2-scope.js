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

  function credential(identity) {
    return '<Credential domain="DUNS">' + (identity === null ? '' : '<Identity>' + identity + '</Identity>') + '</Credential>';
  }

  function validHeader(extra) {
    return '<Header>' +
      '<From>' + credential('FROM') + '</From>' +
      '<To>' + credential('TO') + '</To>' +
      '<Sender>' + credential('SENDER') + '</Sender>' +
      (extra || '') +
      '</Header>';
  }

  function invoiceHeader(attributes) {
    return '<InvoiceDetailRequestHeader ' + (attributes === undefined ? 'invoiceID="INV-1" invoiceDate="2026-08-31"' : attributes) + '/>';
  }

  function item() {
    return '<InvoiceDetailItem invoiceLineNumber="1" quantity="1"/>';
  }

  function validOrder() {
    return '<InvoiceDetailOrder><InvoiceDetailOrderInfo/>' + item() + '</InvoiceDetailOrder>';
  }

  function xml(header, realInvoiceRequest, outsideAfterRequest) {
    return '<?xml version="1.0"?>' +
      '<cXML payloadID="scope-test@example" timestamp="2026-08-31T00:00:00-05:00">' +
      header +
      '<Request>' + realInvoiceRequest + '</Request>' +
      (outsideAfterRequest || '') +
      '</cXML>';
  }

  function invoiceRequest(header, orders) {
    return '<InvoiceDetailRequest>' + (header || '') + (orders === undefined ? validOrder() : orders) + '</InvoiceDetailRequest>';
  }

  function evaluate(source) {
    var parsed = XMLValidator.Parser.parse(source);
    assert(parsed.success, 'Production parser rejected fixture XML.');
    var analyzed = XMLValidator.Analyzer.analyze(parsed.document);
    assert(analyzed.success && analyzed.tree, 'Production analyzer rejected fixture XML.');
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

  test('1. Valid-looking Credential outside /cXML/Header neither substitutes for nor creates a Header Credential requirement', function () {
    var headerWithoutCredentials = '<Header><From/><To/><Sender/></Header>';
    var outsideCredential = '<Extra><From>' + credential('OUTSIDE') + '</From></Extra>';
    var result = evaluate(xml(headerWithoutCredentials, invoiceRequest(invoiceHeader()), outsideCredential));
    assert(findingsFor(result, 'CXML_CREDENTIAL_001').length === 0, 'Outside Credential influenced CXML_CREDENTIAL_001.');
    assert(findingsFor(result, 'CXML_CREDENTIAL_002').length === 0, 'Outside Credential influenced CXML_CREDENTIAL_002.');
  });

  test('2. Misplaced Identity outside the target Header Credential does not satisfy CXML_CREDENTIAL_002', function () {
    var header = '<Header>' +
      '<From><Credential domain="DUNS"/><Identity>MISPLACED</Identity></From>' +
      '<To>' + credential('TO') + '</To>' +
      '<Sender>' + credential('SENDER') + '</Sender>' +
      '</Header>';
    var result = evaluate(xml(header, invoiceRequest(invoiceHeader())));
    assert(findingsFor(result, 'CXML_CREDENTIAL_002').length === 1, 'Misplaced Identity incorrectly satisfied the target Credential.');
  });

  test('3. Invalid Credentials under unrelated partner elements outside /cXML/Header are ignored', function () {
    var outsidePartners = '<Extra><From><Credential/></From><To><Credential/></To><Sender><Credential/></Sender></Extra>';
    var result = evaluate(xml(validHeader(), invoiceRequest(invoiceHeader()), outsidePartners));
    assert(findingsFor(result, 'CXML_CREDENTIAL_001').length === 0, 'Unrelated Credentials produced domain findings.');
    assert(findingsFor(result, 'CXML_CREDENTIAL_002').length === 0, 'Unrelated Credentials produced Identity findings.');
  });

  test('4. Misplaced InvoiceDetailRequestHeader cannot satisfy CXML_INV_HEADER_001', function () {
    var misplaced = '<InvoiceDetailRequest>' + invoiceHeader() + validOrder() + '</InvoiceDetailRequest>';
    var header = validHeader(misplaced);
    var result = evaluate(xml(header, invoiceRequest('', validOrder())));
    assert(findingsFor(result, 'CXML_INV_HEADER_001').length === 1, 'Misplaced header incorrectly satisfied the structural InvoiceDetailRequest.');
  });

  test('5. Misplaced invoiceID and invoiceDate header cannot satisfy CXML_INV_HEADER_002 or CXML_INV_HEADER_003', function () {
    var misplaced = '<InvoiceDetailRequestHeader invoiceID="OUTSIDE" invoiceDate="2026-08-31"/>';
    var result = evaluate(xml(validHeader(misplaced), invoiceRequest(invoiceHeader(''), validOrder())));
    assert(findingsFor(result, 'CXML_INV_HEADER_002').length === 1, 'Misplaced invoiceID incorrectly satisfied the structural header.');
    assert(findingsFor(result, 'CXML_INV_HEADER_003').length === 1, 'Misplaced invoiceDate incorrectly satisfied the structural header.');
  });

  test('6. Misplaced InvoiceDetailOrder outside the target InvoiceDetailRequest cannot influence CXML_ORDER_001', function () {
    var misplacedRequest = '<InvoiceDetailRequest>' + invoiceHeader() + validOrder() + '</InvoiceDetailRequest>';
    var result = evaluate(xml(validHeader(misplacedRequest), invoiceRequest(invoiceHeader(), '')));
    assert(findingsFor(result, 'CXML_ORDER_001').length === 1, 'Misplaced order incorrectly satisfied the structural InvoiceDetailRequest.');
  });

  test('7. Multiple direct InvoiceDetailOrder children remain individually validated', function () {
    var invalidSecondOrder = '<InvoiceDetailOrder>' + item() + '</InvoiceDetailOrder>';
    var result = evaluate(xml(validHeader(), invoiceRequest(invoiceHeader(), validOrder() + invalidSecondOrder)));
    var findings = findingsFor(result, 'CXML_ORDER_001');
    assert(findings.length === 1, 'Expected exactly one invalid direct order, found ' + findings.length + '.');
    assert(findings[0].path.indexOf('[2]') !== -1, 'Expected the second direct order to be identified.');
  });

  var list = document.getElementById('test_results');
  results.forEach(function (result) {
    var itemElement = document.createElement('li');
    itemElement.className = result.passed ? 'pass' : 'fail';
    itemElement.textContent = (result.passed ? 'PASS — ' : 'FAIL — ') + result.name + (result.passed ? '' : ': ' + result.detail);
    list.appendChild(itemElement);
    console[result.passed ? 'log' : 'error'](itemElement.textContent);
  });

  var allPassed = results.length === 7 && results.every(function (result) { return result.passed; });
  var status = document.getElementById('suite_status');
  status.className = allPassed ? 'pass' : 'fail';
  status.textContent = allPassed ? 'PASS — 7/7 scope and hierarchy tests passed.' : 'FAIL — ' + results.filter(function (result) { return result.passed; }).length + '/7 scope and hierarchy tests passed.';
  document.documentElement.setAttribute('data-suite-complete', 'true');
  document.documentElement.setAttribute('data-suite-passed', String(allPassed));
})();
