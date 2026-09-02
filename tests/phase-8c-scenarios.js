(function () {
  'use strict';

  var results = [];
  var referenceResults = [];

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

  function header(secret) {
    return '<Header><From><Credential domain="DUNS"><Identity>FROM</Identity></Credential></From>' +
      '<To><Credential domain="DUNS"><Identity>TO</Identity></Credential></To>' +
      '<Sender><Credential domain="DUNS"><Identity>SENDER</Identity>' + (secret ? '<SharedSecret>' + secret + '</SharedSecret>' : '') +
      '</Credential></Sender></Header>';
  }

  function item(extra) {
    return '<InvoiceDetailItem invoiceLineNumber="1" quantity="1"><UnitOfMeasure>EA</UnitOfMeasure>' +
      '<UnitPrice><Money currency="USD">1</Money></UnitPrice><InvoiceDetailItemReference/>' + (extra || '') + '</InvoiceDetailItem>';
  }

  function service(extra) {
    return '<InvoiceDetailServiceItem invoiceLineNumber="2">' + (extra || '') + '</InvoiceDetailServiceItem>';
  }

  function order(lines, backing) {
    var info = backing || '';
    return '<InvoiceDetailOrder><InvoiceDetailOrderInfo>' + info + '</InvoiceDetailOrderInfo>' + (lines || item()) + '</InvoiceDetailOrder>';
  }

  function xml(options) {
    var opts = options || {};
    var purpose = opts.purpose === undefined ? ' purpose="standard"' : (opts.purpose === null ? '' : ' purpose="' + opts.purpose + '"');
    var headerChildren = opts.headerChildren || '';
    var invoiceHeader = opts.noInvoiceHeader ? '' : '<InvoiceDetailRequestHeader invoiceID="INV" invoiceDate="2026-09-01"' + purpose + '>' + headerChildren + '</InvoiceDetailRequestHeader>';
    var orders = opts.orders === undefined ? order(item(), opts.backing) : opts.orders;
    var summary = opts.summary === false ? '' : '<InvoiceDetailSummary>' + (opts.summaryContent || '') + '</InvoiceDetailSummary>';
    var invoiceBody = opts.invoiceBody !== undefined ? opts.invoiceBody : invoiceHeader + orders + summary;
    var requestBody = opts.requestBody !== undefined ? opts.requestBody : '<InvoiceDetailRequest>' + invoiceBody + '</InvoiceDetailRequest>';
    return '<?xml version="1.0"?><cXML payloadID="8c" timestamp="2026-09-01T00:00:00Z">' + header(opts.secret) + '<Request>' + requestBody + '</Request></cXML>';
  }

  function resolve(source) {
    assert(XMLValidator.ScenarioResolver && typeof XMLValidator.ScenarioResolver.resolve === 'function', 'Production ScenarioResolver is not available.');
    var parsed = XMLValidator.Parser.parse(source);
    assert(parsed.success, 'Fixture did not parse.');
    var analysis = XMLValidator.Analyzer.analyze(parsed.document);
    assert(analysis.success, 'Fixture did not analyze.');
    return XMLValidator.ScenarioResolver.resolve({
      xmlDocument: parsed.document,
      analysis: analysis,
      structuralObservations: XMLValidator.extractStructuralObservations(parsed.document)
    });
  }

  function expectDimension(name, source, key, expected) {
    test(name, function () {
      var scenario = resolve(source);
      assert(scenario[key] === expected, 'Expected ' + key + '=' + expected + ', found ' + scenario[key] + '.');
      assert(scenario.confidence === 'HIGH', 'Expected deterministic HIGH confidence.');
    });
  }

  function expectPurpose(name, source, expected) {
    test(name, function () {
      var scenario = resolve(source);
      assert(scenario.purpose.type === expected, 'Expected purpose.type=' + expected + ', found ' + scenario.purpose.type + '.');
      assert(scenario.confidence === 'HIGH', 'Expected deterministic HIGH confidence.');
    });
  }

  expectPurpose('1. standard purpose', xml({ purpose: 'standard' }), 'STANDARD');
  expectPurpose('2. creditMemo purpose', xml({ purpose: 'creditMemo' }), 'CREDIT_MEMO');
  expectPurpose('3. lineLevelCreditMemo purpose', xml({ purpose: 'lineLevelCreditMemo' }), 'LINE_LEVEL_CREDIT_MEMO');
  expectPurpose('4. debitMemo purpose', xml({ purpose: 'debitMemo' }), 'DEBIT_MEMO');
  expectPurpose('5. absent purpose is not defaulted', xml({ purpose: null }), 'NOT_DECLARED');
  expectPurpose('6. unknown declared purpose', xml({ purpose: 'futurePurpose' }), 'OTHER');
  expectDimension('7. detailed body', xml(), 'bodyMode', 'DETAILED');
  expectDimension('8. header-only body', xml({ orders: '<InvoiceDetailHeaderOrder/>' }), 'bodyMode', 'HEADER');
  expectDimension('9. mixed body', xml({ orders: '<InvoiceDetailHeaderOrder/>' + order(item()) }), 'bodyMode', 'MIXED');
  expectDimension('10. quantity line profile', xml(), 'lineProfile', 'QUANTITY');
  expectDimension('11. service line profile', xml({ orders: order(service()) }), 'lineProfile', 'SERVICE');
  expectDimension('12. mixed line profile', xml({ orders: order(item() + service()) }), 'lineProfile', 'MIXED');
  expectDimension('13. PO backing', xml({ backing: '<OrderReference orderID="PO"><DocumentReference payloadID="P1"/></OrderReference>' }), 'backing', 'PO');
  expectDimension('14. contract backing', xml({ backing: '<MasterAgreementReference agreementID="C"><DocumentReference payloadID="C1"/></MasterAgreementReference>' }), 'backing', 'CONTRACT');
  expectDimension('15. mixed backing', xml({ backing: '<OrderReference><DocumentReference payloadID="P1"/></OrderReference><MasterAgreementReference><DocumentReference payloadID="C1"/></MasterAgreementReference>' }), 'backing', 'MIXED');
  expectDimension('16. no backing', xml(), 'backing', 'NONE');
  expectDimension('17. line tax', xml({ orders: order(item('<Tax/>')), summary: false }), 'taxProfile', 'LINE');
  expectDimension('18. summary tax', xml({ summaryContent: '<Tax/>' }), 'taxProfile', 'SUMMARY');
  expectDimension('19. line and summary tax', xml({ orders: order(item('<Tax/>')), summaryContent: '<Tax/>' }), 'taxProfile', 'BOTH');
  expectDimension('20. no tax', xml(), 'taxProfile', 'NONE');

  test('21. multiple PO reference payload IDs are preserved', function () {
    var scenario = resolve(xml({ backing: '<OrderReference><DocumentReference payloadID="P1"/><DocumentReference payloadID="P2"/></OrderReference><MasterAgreementReference><DocumentReference payloadID="C1"/></MasterAgreementReference><DocumentReference payloadID=""/>' }));
    assert(scenario.backingDetails.orderReferencePayloadIDs.join(',') === 'P1,P2', 'PO payload ID array was not preserved.');
    assert(scenario.backingDetails.masterAgreementPayloadIDs.join(',') === 'C1', 'Contract payload ID array was not preserved.');
    assert(scenario.backingDetails.orderReferenceCount === 1 && scenario.backingDetails.masterAgreementReferenceCount === 1, 'Backing element counts were not preserved.');
    assert(scenario.backingDetails.emptyBackingReferenceCount === 1 && scenario.backingDetails.hasEmptyBackingReference === true, 'Empty backing reference was not preserved.');
    assert(scenario.features.indexOf('MULTIPLE_PO_REFERENCES') !== -1, 'MULTIPLE_PO_REFERENCES feature missing.');
    assert(scenario.features.indexOf('EMPTY_BACKING_REFERENCE') !== -1, 'EMPTY_BACKING_REFERENCE feature missing.');
  });
  test('22. requester feature', function () {
    assert(resolve(xml({ headerChildren: '<Extrinsic name="Requester">a@b.test</Extrinsic>' })).features.indexOf('REQUESTER') !== -1, 'REQUESTER feature missing.');
  });
  test('23. MatchReference feature', function () {
    assert(resolve(xml({ headerChildren: '<Extrinsic name="MatchReference">M1</Extrinsic>' })).features.indexOf('MATCH_REFERENCE') !== -1, 'MATCH_REFERENCE feature missing.');
  });
  test('24. SharedSecret presence is boolean-only', function () {
    var secret = 'DO-NOT-EXPOSE-8C';
    var scenario = resolve(xml({ secret: secret }));
    assert(scenario.features.indexOf('SHARED_SECRET_PRESENT') !== -1, 'SharedSecret presence feature missing.');
    assert(JSON.stringify(scenario).indexOf(secret) === -1, 'Scenario exposed SharedSecret content.');
  });

  test('25. declarative applicability can apply', function () {
    var evaluation = XMLValidator.RuleEngine.evaluateApplicability({ appliesTo: { purpose: ['CREDIT_MEMO'], bodyMode: ['HEADER'] } }, { scenario: { purpose: { type: 'CREDIT_MEMO' }, bodyMode: 'HEADER' } });
    assert(evaluation.status === 'APPLIES' && evaluation.applicable === true, 'Expected APPLIES.');
  });
  test('26. declarative applicability can be not applicable', function () {
    var evaluation = XMLValidator.RuleEngine.evaluateApplicability({ appliesTo: { purpose: ['CREDIT_MEMO'] } }, { scenario: { purpose: { type: 'STANDARD' } } });
    assert(evaluation.status === 'NOT_APPLICABLE' && evaluation.applicable === false, 'Expected NOT_APPLICABLE.');
  });
  test('27. missing scenario makes declarative applicability unknown', function () {
    var evaluation = XMLValidator.RuleEngine.evaluateApplicability({ appliesTo: { purpose: ['CREDIT_MEMO'] } }, {});
    assert(evaluation.status === 'UNKNOWN' && evaluation.applicable === null, 'Expected UNKNOWN.');
  });

  test('28. all 17 production references receive a stable scenario', function () {
    var expected = {
      coupa_contract_backed: ['STANDARD', 'DETAILED', 'QUANTITY', 'CONTRACT', 'SUMMARY'],
      coupa_multiple_po: ['STANDARD', 'DETAILED', 'QUANTITY', 'PO', 'SUMMARY'],
      coupa_payment_terms: ['STANDARD', 'DETAILED', 'QUANTITY', 'PO', 'SUMMARY'],
      coupa_custom_fields: ['STANDARD', 'DETAILED', 'QUANTITY', 'PO', 'SUMMARY'],
      coupa_match_reference: ['STANDARD', 'DETAILED', 'QUANTITY', 'PO', 'SUMMARY'],
      coupa_service_invoice: ['STANDARD', 'DETAILED', 'SERVICE', 'PO', 'SUMMARY'],
      coupa_billing_distributions: ['STANDARD', 'DETAILED', 'QUANTITY', 'CONTRACT', 'SUMMARY'],
      coupa_unbacked_invoice: ['STANDARD', 'DETAILED', 'QUANTITY', 'CONTRACT', 'SUMMARY'],
      coupa_mixed_backed_unbacked: ['STANDARD', 'DETAILED', 'QUANTITY', 'PO', 'SUMMARY'],
      coupa_taxes_po_backed_invoice_charge: ['STANDARD', 'DETAILED', 'QUANTITY', 'NONE', 'BOTH'],
      coupa_taxes_po_backed_invoice_line: ['STANDARD', 'DETAILED', 'QUANTITY', 'PO', 'BOTH'],
      coupa_taxes_po_backed_invoice_total: ['STANDARD', 'DETAILED', 'QUANTITY', 'PO', 'SUMMARY'],
      coupa_correction_invoice_dispute: ['STANDARD', 'DETAILED', 'QUANTITY', 'NONE', 'SUMMARY'],
      coupa_credit_memo_po_backed: ['CREDIT_MEMO', 'DETAILED', 'QUANTITY', 'PO', 'BOTH'],
      coupa_credit_memo: ['CREDIT_MEMO', 'DETAILED', 'QUANTITY', 'CONTRACT', 'SUMMARY'],
      coupa_dispute_credit_note: ['CREDIT_MEMO', 'DETAILED', 'QUANTITY', 'NONE', 'SUMMARY'],
      coupa_unbacked_invoice_requester: ['STANDARD', 'DETAILED', 'QUANTITY', 'CONTRACT', 'SUMMARY']
    };

    function direct(parent, name) {
      var matches = [];
      if (!parent) return matches;
      for (var i = 0; i < parent.childNodes.length; i++) {
        var child = parent.childNodes[i];
        if (child.nodeType === 1 && child.nodeName === name) matches.push(child);
      }
      return matches;
    }

    function auditStructure(source) {
      var parsed = XMLValidator.Parser.parse(source);
      var root = parsed.document.documentElement;
      var request = direct(root, 'Request')[0];
      var invoice = direct(request, 'InvoiceDetailRequest')[0];
      var orders = direct(invoice, 'InvoiceDetailOrder');
      var requestHeader = direct(invoice, 'InvoiceDetailRequestHeader')[0];
      var audit = { purposeRaw: requestHeader ? requestHeader.getAttribute('purpose') : null, quantityCount: 0, serviceCount: 0, orderCount: 0, agreementCount: 0, poIDs: [], contractIDs: [], emptyCount: 0, taxAtLine: false, taxAtSummary: false };
      orders.forEach(function (orderElement) {
        var quantityLines = direct(orderElement, 'InvoiceDetailItem');
        var serviceLines = direct(orderElement, 'InvoiceDetailServiceItem');
        audit.quantityCount += quantityLines.length;
        audit.serviceCount += serviceLines.length;
        quantityLines.concat(serviceLines).forEach(function (line) {
          if (line.getElementsByTagName('Tax').length || line.getElementsByTagName('TaxDetail').length) audit.taxAtLine = true;
        });
        direct(orderElement, 'InvoiceDetailOrderInfo').forEach(function (info) {
          var po = direct(info, 'OrderReference');
          var contracts = direct(info, 'MasterAgreementReference');
          audit.orderCount += po.length;
          audit.agreementCount += contracts.length;
          po.forEach(function (reference) {
            direct(reference, 'DocumentReference').forEach(function (documentReference) {
              var value = documentReference.getAttribute('payloadID') || '';
              if (value.trim()) audit.poIDs.push(value); else audit.emptyCount++;
            });
          });
          contracts.forEach(function (reference) {
            direct(reference, 'DocumentReference').forEach(function (documentReference) {
              var value = documentReference.getAttribute('payloadID') || '';
              if (value.trim()) audit.contractIDs.push(value); else audit.emptyCount++;
            });
          });
          direct(info, 'DocumentReference').forEach(function (documentReference) {
            if (!(documentReference.getAttribute('payloadID') || '').trim()) audit.emptyCount++;
          });
        });
      });
      direct(invoice, 'InvoiceDetailSummary').forEach(function (summary) {
        if (summary.getElementsByTagName('Tax').length || summary.getElementsByTagName('TaxDetail').length) audit.taxAtSummary = true;
      });
      return audit;
    }

    var references = XMLValidator.TemplateCatalog.getAll();
    assert(references.length === 17, 'Expected 17 active references, found ' + references.length + '.');
    references.forEach(function (reference) {
      var scenario = resolve(reference.xml);
      var actual = [scenario.purpose.type, scenario.bodyMode, scenario.lineProfile, scenario.backing, scenario.taxProfile];
      assert(JSON.stringify(actual) === JSON.stringify(expected[reference.id]), 'Classification mismatch for ' + reference.id + ': ' + actual.join('/') + '.');
      var audit = auditStructure(reference.xml);
      assert(scenario.purpose.raw === audit.purposeRaw, 'Raw purpose mismatch for ' + reference.id + '.');
      assert(scenario.counts.quantityLines === audit.quantityCount && scenario.counts.serviceLines === audit.serviceCount, 'Line counts mismatch for ' + reference.id + '.');
      assert(scenario.backingDetails.orderReferenceCount === audit.orderCount, 'OrderReference count mismatch for ' + reference.id + '.');
      assert(scenario.backingDetails.masterAgreementReferenceCount === audit.agreementCount, 'MasterAgreementReference count mismatch for ' + reference.id + '.');
      assert(JSON.stringify(scenario.backingDetails.orderReferencePayloadIDs) === JSON.stringify(audit.poIDs), 'PO payload IDs mismatch for ' + reference.id + '.');
      assert(JSON.stringify(scenario.backingDetails.masterAgreementPayloadIDs) === JSON.stringify(audit.contractIDs), 'Contract payload IDs mismatch for ' + reference.id + '.');
      assert(scenario.backingDetails.emptyBackingReferenceCount === audit.emptyCount, 'Empty backing reference count mismatch for ' + reference.id + '.');
      assert((scenario.taxProfile === 'LINE' || scenario.taxProfile === 'BOTH') === audit.taxAtLine, 'Line tax mismatch for ' + reference.id + '.');
      assert((scenario.taxProfile === 'SUMMARY' || scenario.taxProfile === 'BOTH') === audit.taxAtSummary, 'Summary tax mismatch for ' + reference.id + '.');
      referenceResults.push({ id: reference.id, name: reference.name, scenario: scenario });
    });
    var mixed = referenceResults.filter(function (entry) { return entry.id === 'coupa_mixed_backed_unbacked'; })[0].scenario;
    assert(mixed.backingDetails.hasEmptyBackingReference && mixed.features.indexOf('EMPTY_BACKING_REFERENCE') !== -1, 'Mixed backed/unbacked structural pattern was not preserved.');
  });

  var passed = results.filter(function (result) { return result.passed; }).length;
  var list = document.getElementById('test_results');
  results.forEach(function (result) {
    var li = document.createElement('li');
    li.className = result.passed ? 'pass' : 'fail';
    li.textContent = result.name + ' — ' + result.detail;
    list.appendChild(li);
    console[result.passed ? 'log' : 'error'](li.textContent);
  });

  document.getElementById('aggregate_output').textContent = passed + '/' + results.length + ' Phase 8C tests passed; ' + referenceResults.length + '/17 references classified';
  var status = document.getElementById('suite_status');
  status.textContent = passed === results.length ? 'PASS' : 'FAIL';
  status.className = passed === results.length ? 'pass' : 'fail';

  if (referenceResults.length) {
    var rows = referenceResults.map(function (entry) {
      var s = entry.scenario;
      return '<tr><td>' + XMLValidator.Utils.escapeHtml(entry.id) + '</td><td>' + XMLValidator.Utils.escapeHtml(entry.name) + '</td><td>' + XMLValidator.Utils.escapeHtml(s.purpose.raw || '(absent)') + '</td><td>' + s.bodyMode + '</td><td>' + s.counts.quantityLines + '/' + s.counts.serviceLines + '</td><td>' + s.backing + '</td><td>' + s.taxProfile + '</td><td>' + s.backingDetails.orderReferenceCount + ': ' + XMLValidator.Utils.escapeHtml(s.backingDetails.orderReferencePayloadIDs.join(', ')) + '</td><td>' + s.backingDetails.masterAgreementReferenceCount + ': ' + XMLValidator.Utils.escapeHtml(s.backingDetails.masterAgreementPayloadIDs.join(', ')) + '</td><td>' + s.backingDetails.emptyBackingReferenceCount + '</td></tr>';
    }).join('');
    document.getElementById('reference_report').innerHTML = '<h2>Production reference classification</h2><table><thead><tr><th>ID</th><th>Name</th><th>Purpose raw</th><th>Body</th><th>Q/S lines</th><th>Backing</th><th>Tax</th><th>PO refs: IDs</th><th>Contract refs: IDs</th><th>Empty refs</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
})();
