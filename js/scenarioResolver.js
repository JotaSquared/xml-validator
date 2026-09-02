/**
 * XML Invoice Validator - Scenario Resolver
 *
 * Phase 8C: deterministic, hierarchy-scoped scenario detection. This module
 * classifies already parsed XML; it does not parse XML or validate Coupa rules.
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.ScenarioResolver = (function () {
  'use strict';

  var ENUMS = {
    DOCUMENT_TYPE: ['INVOICE_DETAIL_REQUEST', 'UNSUPPORTED_CXML_DOCUMENT', 'UNKNOWN'],
    PURPOSE: ['STANDARD', 'CREDIT_MEMO', 'LINE_LEVEL_CREDIT_MEMO', 'DEBIT_MEMO', 'LINE_LEVEL_DEBIT_MEMO', 'OTHER', 'NOT_DECLARED'],
    BODY_MODE: ['DETAILED', 'HEADER', 'MIXED', 'NONE'],
    LINE_PROFILE: ['QUANTITY', 'SERVICE', 'MIXED', 'NONE'],
    BACKING: ['PO', 'CONTRACT', 'MIXED', 'NONE'],
    TAX_PROFILE: ['LINE', 'SUMMARY', 'BOTH', 'NONE'],
    FEATURE: ['PAYMENT_TERMS', 'EXTRINSICS', 'REQUESTER', 'MATCH_REFERENCE', 'DISTRIBUTIONS', 'SHARED_SECRET_PRESENT', 'MULTIPLE_ORDERS', 'MULTIPLE_PO_REFERENCES', 'EMPTY_BACKING_REFERENCE'],
    CONFIDENCE: ['HIGH']
  };

  function directChildren(parent, tagName) {
    var children = [];
    if (!parent || !parent.childNodes) return children;
    for (var i = 0; i < parent.childNodes.length; i++) {
      var child = parent.childNodes[i];
      if (child.nodeType === 1 && (!tagName || child.nodeName === tagName || child.localName === tagName)) children.push(child);
    }
    return children;
  }

  function structuralNodes(doc) {
    var root = doc && doc.documentElement;
    var isCxml = Boolean(root && (root.nodeName === 'cXML' || root.localName === 'cXML'));
    var request = null;
    var invoiceRequest = null;
    if (isCxml) {
      var requests = directChildren(root, 'Request');
      request = requests.length ? requests[0] : null;
      var invoices = request ? directChildren(request, 'InvoiceDetailRequest') : [];
      invoiceRequest = invoices.length ? invoices[0] : null;
    }
    return { root: root, isCxml: isCxml, request: request, invoiceRequest: invoiceRequest };
  }

  function hasDescendant(parent, names) {
    if (!parent) return false;
    for (var i = 0; i < names.length; i++) {
      if (parent.getElementsByTagName(names[i]).length > 0) return true;
    }
    return false;
  }

  function purpose(raw) {
    var value = raw && raw.trim() !== '' ? raw.trim() : null;
    var lookup = {
      standard: 'STANDARD',
      creditMemo: 'CREDIT_MEMO',
      lineLevelCreditMemo: 'LINE_LEVEL_CREDIT_MEMO',
      debitMemo: 'DEBIT_MEMO',
      lineLevelDebitMemo: 'LINE_LEVEL_DEBIT_MEMO'
    };
    return {
      raw: value,
      type: value ? (lookup[value] || 'OTHER') : 'NOT_DECLARED',
      declared: value !== null
    };
  }

  function addFeature(features, feature) {
    if (features.indexOf(feature) === -1) features.push(feature);
  }

  function resolve(input) {
    input = input || {};
    var doc = input.xmlDocument || null;
    var observations = input.structuralObservations || {};
    var nodes = structuralNodes(doc);
    var invoiceRequest = nodes.invoiceRequest;
    var requestHeaders = invoiceRequest ? directChildren(invoiceRequest, 'InvoiceDetailRequestHeader') : [];
    var requestHeader = requestHeaders.length ? requestHeaders[0] : null;
    var orders = invoiceRequest ? directChildren(invoiceRequest, 'InvoiceDetailOrder') : [];
    var headerOrders = invoiceRequest ? directChildren(invoiceRequest, 'InvoiceDetailHeaderOrder') : [];
    var quantityLines = [];
    var serviceLines = [];
    var features = [];
    var backingDetails = {
      orderReferenceCount: 0,
      masterAgreementReferenceCount: 0,
      orderReferencePayloadIDs: [],
      masterAgreementPayloadIDs: [],
      emptyBackingReferenceCount: 0,
      hasEmptyBackingReference: false
    };

    function collectBackingDocumentReferences(parent, target) {
      var documentReferences = directChildren(parent, 'DocumentReference');
      for (var referenceIndex = 0; referenceIndex < documentReferences.length; referenceIndex++) {
        var payloadID = documentReferences[referenceIndex].getAttribute('payloadID');
        var normalized = payloadID === null ? '' : payloadID.trim();
        if (normalized) target.push(normalized);
        else backingDetails.emptyBackingReferenceCount++;
      }
    }

    for (var o = 0; o < orders.length; o++) {
      quantityLines = quantityLines.concat(directChildren(orders[o], 'InvoiceDetailItem'));
      serviceLines = serviceLines.concat(directChildren(orders[o], 'InvoiceDetailServiceItem'));
      var orderInfos = directChildren(orders[o], 'InvoiceDetailOrderInfo');
      for (var infoIndex = 0; infoIndex < orderInfos.length; infoIndex++) {
        var orderReferences = directChildren(orderInfos[infoIndex], 'OrderReference');
        var agreementReferences = directChildren(orderInfos[infoIndex], 'MasterAgreementReference');
        backingDetails.orderReferenceCount += orderReferences.length;
        backingDetails.masterAgreementReferenceCount += agreementReferences.length;
        for (var orderReferenceIndex = 0; orderReferenceIndex < orderReferences.length; orderReferenceIndex++) {
          collectBackingDocumentReferences(orderReferences[orderReferenceIndex], backingDetails.orderReferencePayloadIDs);
        }
        for (var agreementIndex = 0; agreementIndex < agreementReferences.length; agreementIndex++) {
          collectBackingDocumentReferences(agreementReferences[agreementIndex], backingDetails.masterAgreementPayloadIDs);
        }
        // Existing approved samples use an empty direct DocumentReference to
        // preserve an explicitly unbacked line. It is observable but is not a
        // supported PO or contract association.
        var directDocumentReferences = directChildren(orderInfos[infoIndex], 'DocumentReference');
        for (var directReferenceIndex = 0; directReferenceIndex < directDocumentReferences.length; directReferenceIndex++) {
          var directPayloadID = directDocumentReferences[directReferenceIndex].getAttribute('payloadID');
          if (directPayloadID === null || directPayloadID.trim() === '') backingDetails.emptyBackingReferenceCount++;
        }
      }
    }

    var bodyMode = 'NONE';
    if (orders.length && headerOrders.length) bodyMode = 'MIXED';
    else if (orders.length) bodyMode = 'DETAILED';
    else if (headerOrders.length) bodyMode = 'HEADER';

    var lineProfile = 'NONE';
    if (quantityLines.length && serviceLines.length) lineProfile = 'MIXED';
    else if (quantityLines.length) lineProfile = 'QUANTITY';
    else if (serviceLines.length) lineProfile = 'SERVICE';

    var taxAtLine = false;
    var allLines = quantityLines.concat(serviceLines);
    for (var l = 0; l < allLines.length && !taxAtLine; l++) taxAtLine = hasDescendant(allLines[l], ['Tax', 'TaxDetail']);
    var summaries = invoiceRequest ? directChildren(invoiceRequest, 'InvoiceDetailSummary') : [];
    var taxAtSummary = false;
    for (var s = 0; s < summaries.length && !taxAtSummary; s++) taxAtSummary = hasDescendant(summaries[s], ['Tax', 'TaxDetail']);
    var taxProfile = taxAtLine && taxAtSummary ? 'BOTH' : (taxAtLine ? 'LINE' : (taxAtSummary ? 'SUMMARY' : 'NONE'));

    if (requestHeader && directChildren(requestHeader, 'PaymentTerm').length) addFeature(features, 'PAYMENT_TERMS');
    var extrinsics = requestHeader ? requestHeader.getElementsByTagName('Extrinsic') : [];
    if (extrinsics.length) addFeature(features, 'EXTRINSICS');
    for (var e = 0; e < extrinsics.length; e++) {
      var extrinsicName = (extrinsics[e].getAttribute('name') || '').toLowerCase();
      if (extrinsicName === 'requester' || extrinsicName === 'requesteremail') addFeature(features, 'REQUESTER');
      if (extrinsicName === 'matchreference') addFeature(features, 'MATCH_REFERENCE');
    }
    var contacts = requestHeader ? requestHeader.getElementsByTagName('Contact') : [];
    for (var c = 0; c < contacts.length; c++) {
      if ((contacts[c].getAttribute('role') || '').toLowerCase() === 'requester') addFeature(features, 'REQUESTER');
    }
    for (var d = 0; d < allLines.length; d++) {
      if (hasDescendant(allLines[d], ['Distribution'])) addFeature(features, 'DISTRIBUTIONS');
    }
    if (observations.sharedSecretPresent === true) addFeature(features, 'SHARED_SECRET_PRESENT');
    if (orders.length > 1) addFeature(features, 'MULTIPLE_ORDERS');

    backingDetails.hasEmptyBackingReference = backingDetails.emptyBackingReferenceCount > 0;
    if (backingDetails.orderReferencePayloadIDs.length > 1) addFeature(features, 'MULTIPLE_PO_REFERENCES');
    if (backingDetails.hasEmptyBackingReference) addFeature(features, 'EMPTY_BACKING_REFERENCE');

    var hasPoBacking = backingDetails.orderReferencePayloadIDs.length > 0;
    var hasContractBacking = backingDetails.masterAgreementPayloadIDs.length > 0;
    var backing = hasPoBacking && hasContractBacking ? 'MIXED' : (hasPoBacking ? 'PO' : (hasContractBacking ? 'CONTRACT' : 'NONE'));
    return {
      documentType: invoiceRequest ? 'INVOICE_DETAIL_REQUEST' : (nodes.isCxml ? 'UNSUPPORTED_CXML_DOCUMENT' : 'UNKNOWN'),
      purpose: purpose(requestHeader ? requestHeader.getAttribute('purpose') : null),
      bodyMode: bodyMode,
      lineProfile: lineProfile,
      backing: backing,
      taxProfile: taxProfile,
      features: features,
      confidence: 'HIGH',
      backingDetails: backingDetails,
      counts: {
        orders: orders.length,
        quantityLines: quantityLines.length,
        serviceLines: serviceLines.length,
        totalLines: quantityLines.length + serviceLines.length
      }
    };
  }

  function friendlyProfile(scenario) {
    scenario = scenario || resolve({});
    var labels = {
      purpose: {
        STANDARD: 'Standard Invoice', CREDIT_MEMO: 'Credit Memo', LINE_LEVEL_CREDIT_MEMO: 'Line-level Credit Memo',
        DEBIT_MEMO: 'Debit Memo', LINE_LEVEL_DEBIT_MEMO: 'Line-level Debit Memo', OTHER: scenario.purpose.raw || 'Other', NOT_DECLARED: 'Not declared'
      },
      bodyMode: { DETAILED: 'Detailed invoice', HEADER: 'Header invoice', MIXED: 'Mixed body modes', NONE: 'No invoice body detected' },
      lineProfile: { QUANTITY: 'Quantity lines', SERVICE: 'Service lines', MIXED: 'Mixed quantity and service lines', NONE: 'No invoice lines detected' },
      backing: { PO: 'PO-backed', CONTRACT: 'Contract referenced', MIXED: 'Mixed PO and contract backing', NONE: 'No supported backing reference observed' },
      taxProfile: { LINE: 'Taxes at line level', SUMMARY: 'Taxes at summary level', BOTH: 'Taxes at line and summary level', NONE: 'No tax detected' },
      documentType: { INVOICE_DETAIL_REQUEST: 'InvoiceDetailRequest', UNSUPPORTED_CXML_DOCUMENT: 'Unsupported cXML document', UNKNOWN: 'Unknown document' }
    };
    return {
      documentType: labels.documentType[scenario.documentType],
      purpose: labels.purpose[scenario.purpose.type],
      bodyMode: labels.bodyMode[scenario.bodyMode],
      lineProfile: labels.lineProfile[scenario.lineProfile],
      backing: labels.backing[scenario.backing],
      taxProfile: labels.taxProfile[scenario.taxProfile],
      badge: scenario.lineProfile === 'SERVICE' ? 'Service Invoice' : labels.purpose[scenario.purpose.type]
    };
  }

  return { ENUMS: ENUMS, resolve: resolve, friendlyProfile: friendlyProfile };
})();
