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
      results.push({ name: name, passed: false, detail: error && error.message ? error.message : String(error) });
    }
  }

  function header(senderSecret, extra) {
    var secret = senderSecret === null ? '' : '<SharedSecret>' + senderSecret + '</SharedSecret>';
    return '<Header>' +
      '<From><Credential domain="DUNS"><Identity>FROM</Identity></Credential></From>' +
      '<To><Credential domain="DUNS"><Identity>TO</Identity></Credential></To>' +
      '<Sender><Credential domain="DUNS"><Identity>SENDER</Identity>' + secret + '</Credential></Sender>' +
      (extra || '') +
      '</Header>';
  }

  function documentReference(payloadID) {
    if (payloadID === undefined) return '<DocumentReference/>';
    return '<DocumentReference payloadID="' + payloadID + '"/>';
  }

  function poReference(payloadID) {
    return '<OrderReference>' + documentReference(payloadID) + '</OrderReference>';
  }

  function contractReference(payloadID) {
    return '<MasterAgreementReference>' + documentReference(payloadID) + '</MasterAgreementReference>';
  }

  function order(info) {
    return '<InvoiceDetailOrder><InvoiceDetailOrderInfo>' + (info || '') + '</InvoiceDetailOrderInfo>' +
      '<InvoiceDetailItem invoiceLineNumber="1" quantity="1"/></InvoiceDetailOrder>';
  }

  function xml(options) {
    var opts = options || {};
    var purposeAttribute = opts.purpose === undefined ? '' : ' purpose="' + opts.purpose + '"';
    return '<?xml version="1.0"?><cXML payloadID="obs@example" timestamp="2026-08-31T00:00:00-05:00">' +
      header(opts.senderSecret === undefined ? 'sender-secret' : opts.senderSecret, opts.headerExtra) +
      '<Request><InvoiceDetailRequest>' +
      '<InvoiceDetailRequestHeader invoiceID="INV-OBS" invoiceDate="2026-08-31"' + purposeAttribute + '/>' +
      (opts.orders === undefined ? order('') : opts.orders) +
      '</InvoiceDetailRequest></Request>' +
      (opts.outside || '') +
      '</cXML>';
  }

  function parse(source) {
    var result = XMLValidator.Parser.parse(source);
    assert(result.success, 'Production parser rejected observation fixture.');
    return result;
  }

  function observe(source) {
    return XMLValidator.extractStructuralObservations(parse(source).document);
  }

  function evaluate(source) {
    var parsed = parse(source);
    var analyzed = XMLValidator.Analyzer.analyze(parsed.document);
    assert(analyzed.success, 'Production analyzer rejected observation fixture.');
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

  function renderedObservationText(observation) {
    XMLValidator.UI.renderValidationSuccess({}, {
      totalRules: 11,
      executedRules: 11,
      findings: [],
      findingsSummary: { errors: 0, warnings: 0, info: 0 },
      systemIssues: []
    }, null, observation, null);
    return document.getElementById('tab_pane_validation').textContent.replace(/\s+/g, ' ').trim();
  }

  test('1. SharedSecret structurally inside Header Sender Credential is observed without exposing its value', function () {
    var observation = observe(xml({ senderSecret: 'do-not-display-this' }));
    var rendered = renderedObservationText(observation);
    assert(observation.sharedSecretPresent === true, 'Sender SharedSecret was not observed.');
    assert(rendered.indexOf('Observed in Sender') !== -1, 'UI did not report the Sender observation.');
    assert(rendered.indexOf('do-not-display-this') === -1, 'UI exposed the SharedSecret value.');
  });

  test('2. SharedSecret outside Header Sender is not reported as a Sender SharedSecret', function () {
    var observation = observe(xml({ senderSecret: null, outside: '<Extra><SharedSecret>outside-secret</SharedSecret></Extra>' }));
    assert(observation.sharedSecretPresent === false, 'Unrelated SharedSecret affected the Sender observation.');
  });

  test('3. Missing purpose is absent/not declared and is not rendered as standard', function () {
    var observation = observe(xml({}));
    var rendered = renderedObservationText(observation);
    assert(observation.purpose === null, 'Missing purpose was not represented as null.');
    assert(rendered.indexOf('Not declared / not observed') !== -1, 'UI did not describe missing purpose neutrally.');
  });

  test('4. Explicit purpose="standard" is observed as standard', function () {
    assert(observe(xml({ purpose: 'standard' })).purpose === 'standard', 'Explicit standard purpose was not preserved.');
  });

  test('5. Explicit purpose="creditMemo" is observed as creditMemo', function () {
    assert(observe(xml({ purpose: 'creditMemo' })).purpose === 'creditMemo', 'Explicit creditMemo purpose was not preserved.');
  });

  test('6. PO-only backing is reported accurately', function () {
    var observation = observe(xml({ orders: order(poReference('PO-1')) }));
    assert(observation.backingType === 'PO', 'Expected PO backing state.');
    assert(JSON.stringify(observation.orderReferencePayloadIDs) === JSON.stringify(['PO-1']), 'PO payloadID was not structurally associated.');
  });

  test('7. Contract-only backing is reported accurately', function () {
    var observation = observe(xml({ orders: order(contractReference('CONTRACT-1')) }));
    assert(observation.backingType === 'CONTRACT', 'Expected Contract backing state.');
    assert(JSON.stringify(observation.masterAgreementPayloadIDs) === JSON.stringify(['CONTRACT-1']), 'Contract payloadID was not structurally associated.');
  });

  test('8. PO and contract backing is reported as mixed/both', function () {
    var observation = observe(xml({ orders: order(poReference('PO-1') + contractReference('CONTRACT-1')) }));
    assert(observation.backingType === 'MIXED', 'Combined backing was not reported as mixed.');
    assert(renderedObservationText(observation).indexOf('Both PO and Contract backing observed') !== -1, 'UI collapsed mixed backing to a single type.');
  });

  test('9. No recognized backing is described neutrally without a structural error', function () {
    var source = xml({ orders: order('') });
    var observation = observe(source);
    assert(observation.backingType === 'NONE', 'Expected no recognized backing state.');
    assert(renderedObservationText(observation).indexOf('Neither PO nor Contract backing observed') !== -1, 'UI did not describe absent recognized backing neutrally.');
    assert(evaluate(source).findingsSummary.errors === 0, 'No-backing observation became a validation error.');
  });

  test('10. Multiple backing payloadIDs remain represented as multiple associated values', function () {
    var orders = order(poReference('PO-1')) + order(poReference('PO-2')) + order(contractReference('CONTRACT-1'));
    var observation = observe(xml({ orders: orders }));
    assert(JSON.stringify(observation.orderReferencePayloadIDs) === JSON.stringify(['PO-1', 'PO-2']), 'Multiple PO payloadIDs were collapsed or lost.');
    assert(observation.orderReferencePayloadID === null, 'Singular PO payloadID misleadingly implies uniqueness.');
    assert(JSON.stringify(observation.masterAgreementPayloadIDs) === JSON.stringify(['CONTRACT-1']), 'Contract payloadID was not retained.');
  });

  test('11. Unrelated backing reference elsewhere does not affect invoice backing observations', function () {
    var outside = '<Extra>' + poReference('OUTSIDE-PO') + contractReference('OUTSIDE-CONTRACT') + '</Extra>';
    var observation = observe(xml({ orders: order(''), outside: outside }));
    assert(observation.backingType === 'NONE', 'Unrelated reference affected backing state.');
    assert(observation.orderReferencePayloadIDs.length === 0, 'Unrelated PO payloadID was collected.');
    assert(observation.masterAgreementPayloadIDs.length === 0, 'Unrelated Contract payloadID was collected.');
  });

  test('12. Empty DocumentReference payloadID remains observable without becoming an error', function () {
    var source = xml({ orders: order(poReference('')) });
    var observation = observe(source);
    assert(observation.backingType === 'PO', 'Empty payloadID removed the observed PO reference.');
    assert(observation.emptyDocumentReferencePayloadID === true, 'Empty payloadID was not observed.');
    assert(JSON.stringify(observation.orderReferencePayloadIDs) === JSON.stringify(['']), 'Empty payloadID was not retained in the associated values.');
    assert(evaluate(source).findingsSummary.errors === 0, 'Empty payloadID observation became a validation error.');
  });

  var list = document.getElementById('test_results');
  results.forEach(function (result) {
    var item = document.createElement('li');
    item.className = result.passed ? 'pass' : 'fail';
    item.textContent = (result.passed ? 'PASS — ' : 'FAIL — ') + result.name + (result.passed ? '' : ': ' + result.detail);
    list.appendChild(item);
    console[result.passed ? 'log' : 'error'](item.textContent);
  });

  var allPassed = results.length === 12 && results.every(function (result) { return result.passed; });
  var status = document.getElementById('suite_status');
  status.className = allPassed ? 'pass' : 'fail';
  status.textContent = allPassed ? 'PASS — 12/12 observation tests passed.' : 'FAIL — ' + results.filter(function (result) { return result.passed; }).length + '/12 observation tests passed.';
  document.documentElement.setAttribute('data-suite-complete', 'true');
  document.documentElement.setAttribute('data-suite-passed', String(allPassed));
})();
