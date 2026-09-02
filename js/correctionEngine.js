/**
 * XML Invoice Validator — Conservative Correction Planning Foundation
 * Phase 9A: produces read-only, deterministic plans. It never mutates XML.
 */
(function (global) {
  'use strict';

  global.XMLValidator = global.XMLValidator || {};

  var SAFETY = {
    NOT_AUTOFIXABLE: 'NOT_AUTOFIXABLE',
    SAFE_RESTRUCTURE: 'SAFE_RESTRUCTURE',
    SAFE_METADATA_FIX: 'SAFE_METADATA_FIX'
  };

  function fingerprint(text) {
    var value = String(text || '');
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return value.length + ':' + (hash >>> 0).toString(16);
  }

  function classification(defaultSafety, safeCases) {
    return { defaultSafety: defaultSafety, safeCases: safeCases || [] };
  }

  var CLASSIFICATIONS = {
    CXML_ENV_001: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_ENV_002: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_ENV_003: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_HEADER_001: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_CREDENTIAL_001: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_CREDENTIAL_002: classification(SAFETY.NOT_AUTOFIXABLE),
    COUPA_INV_001: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_INV_HEADER_001: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_INV_HEADER_002: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_INV_HEADER_003: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_ORDER_001: classification(SAFETY.NOT_AUTOFIXABLE, [{
      condition: 'Existing InvoiceDetailOrderInfo occurs after an existing invoice line',
      safety: SAFETY.SAFE_RESTRUCTURE
    }]),
    CXML_BODY_001: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_BODY_002: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_ITEM_001: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_ITEM_002: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_SERVICE_001: classification(SAFETY.NOT_AUTOFIXABLE),
    CXML_SCENARIO_001: classification(SAFETY.NOT_AUTOFIXABLE, [{
      condition: 'Existing body mode deterministically conflicts with isHeaderInvoice metadata',
      safety: SAFETY.SAFE_METADATA_FIX
    }]),
    CXML_SCENARIO_002: classification(SAFETY.NOT_AUTOFIXABLE, [{
      condition: 'Existing header invoice contains prohibited isAccountingInLine attribute',
      safety: SAFETY.SAFE_METADATA_FIX
    }]),
    CXML_SCENARIO_003: classification(SAFETY.NOT_AUTOFIXABLE)
  };

  function localName(node) {
    return node ? (node.localName || String(node.nodeName || '').split(':').pop()) : '';
  }

  function directChildren(parent, name) {
    var matches = [];
    if (!parent || !parent.childNodes) return matches;
    for (var i = 0; i < parent.childNodes.length; i++) {
      var child = parent.childNodes[i];
      if (child.nodeType === 1 && localName(child) === name) matches.push(child);
    }
    return matches;
  }

  function structuralInvoiceRequest(documentNode) {
    if (!documentNode || !documentNode.documentElement || localName(documentNode.documentElement) !== 'cXML') return null;
    var requests = directChildren(documentNode.documentElement, 'Request');
    if (!requests.length) return null;
    var invoiceRequests = directChildren(requests[0], 'InvoiceDetailRequest');
    return invoiceRequests.length ? invoiceRequests[0] : null;
  }

  function manualPlan(finding, reason) {
    return {
      available: false,
      ruleId: finding && finding.code ? finding.code : null,
      targetPath: finding && finding.path ? finding.path : null,
      safety: SAFETY.NOT_AUTOFIXABLE,
      explanation: reason || 'Manual correction is required because a safe value or structural choice cannot be derived from the document.',
      description: 'Manual correction required',
      operations: [],
      requiresUserInput: true
    };
  }

  function planOrderInfo(finding, context) {
    var invoiceRequest = structuralInvoiceRequest(context && context.xmlDocument);
    if (!invoiceRequest) return manualPlan(finding);
    var orders = directChildren(invoiceRequest, 'InvoiceDetailOrder');
    for (var i = 0; i < orders.length; i++) {
      var elementChildren = [];
      for (var c = 0; c < orders[i].childNodes.length; c++) {
        if (orders[i].childNodes[c].nodeType === 1) elementChildren.push(orders[i].childNodes[c]);
      }
      var infoIndex = -1;
      var firstLineIndex = -1;
      for (var e = 0; e < elementChildren.length; e++) {
        var name = localName(elementChildren[e]);
        if (name === 'InvoiceDetailOrderInfo' && infoIndex === -1) infoIndex = e;
        if ((name === 'InvoiceDetailItem' || name === 'InvoiceDetailServiceItem') && firstLineIndex === -1) firstLineIndex = e;
      }
      if (infoIndex > firstLineIndex && firstLineIndex !== -1) {
        var suffix = orders.length > 1 ? '[' + (i + 1) + ']' : '';
        var orderPath = '/cXML/Request/InvoiceDetailRequest/InvoiceDetailOrder' + suffix;
        return {
          available: true,
          ruleId: finding.code,
          targetPath: orderPath + '/InvoiceDetailOrderInfo',
          safety: SAFETY.SAFE_RESTRUCTURE,
          explanation: 'The existing InvoiceDetailOrderInfo can be moved before the first invoice line without creating or changing business data.',
          description: 'Move the existing InvoiceDetailOrderInfo before the first invoice line.',
          operations: [{
            type: 'MOVE_NODE',
            sourcePath: orderPath + '/InvoiceDetailOrderInfo',
            destinationParentPath: orderPath,
            position: 'BEFORE_FIRST_INVOICE_LINE'
          }],
          requiresUserInput: false
        };
      }
    }
    return manualPlan(finding, 'InvoiceDetailOrderInfo or required invoice-line content is missing; the engine cannot invent it.');
  }

  function planScenarioIndicator(finding, context) {
    var invoiceRequest = structuralInvoiceRequest(context && context.xmlDocument);
    if (!invoiceRequest) return manualPlan(finding);
    var headers = directChildren(invoiceRequest, 'InvoiceDetailRequestHeader');
    var indicators = headers.length ? directChildren(headers[0], 'InvoiceDetailHeaderIndicator') : [];
    if (!indicators.length) return manualPlan(finding, 'The required header indicator element is absent and its surrounding content cannot be safely constructed.');
    var attributePath = '/cXML/Request/InvoiceDetailRequest/InvoiceDetailRequestHeader/InvoiceDetailHeaderIndicator/@isHeaderInvoice';
    if (context.scenario && context.scenario.bodyMode === 'DETAILED' && indicators[0].getAttribute('isHeaderInvoice') === 'yes') {
      return {
        available: true, ruleId: finding.code, targetPath: attributePath,
        safety: SAFETY.SAFE_METADATA_FIX,
        explanation: 'The conflicting header-invoice indicator can be removed without changing invoice business data.',
        description: 'Remove isHeaderInvoice from the detailed invoice indicator.',
        operations: [{ type: 'REMOVE_ATTRIBUTE', targetPath: attributePath, attributeName: 'isHeaderInvoice' }],
        requiresUserInput: false
      };
    }
    if (context.scenario && context.scenario.bodyMode === 'HEADER') {
      return {
        available: true, ruleId: finding.code, targetPath: attributePath,
        safety: SAFETY.SAFE_METADATA_FIX,
        explanation: 'The value is deterministically derived from the existing InvoiceDetailHeaderOrder body structure.',
        description: 'Set isHeaderInvoice from the existing header-invoice body mode.',
        operations: [{
          type: 'SET_ATTRIBUTE_FROM_EXISTING_STRUCTURE',
          targetPath: attributePath,
          attributeName: 'isHeaderInvoice',
          sourcePath: '/cXML/Request/InvoiceDetailRequest/InvoiceDetailHeaderOrder',
          derivation: 'HEADER_BODY_MODE'
        }],
        requiresUserInput: false
      };
    }
    return manualPlan(finding);
  }

  function planAccountingIndicator(finding, context) {
    var invoiceRequest = structuralInvoiceRequest(context && context.xmlDocument);
    var headers = invoiceRequest ? directChildren(invoiceRequest, 'InvoiceDetailRequestHeader') : [];
    var indicators = headers.length ? directChildren(headers[0], 'InvoiceDetailLineIndicator') : [];
    if (!indicators.length || !indicators[0].hasAttribute('isAccountingInLine')) return manualPlan(finding);
    var path = '/cXML/Request/InvoiceDetailRequest/InvoiceDetailRequestHeader/InvoiceDetailLineIndicator/@isAccountingInLine';
    return {
      available: true, ruleId: finding.code, targetPath: path,
      safety: SAFETY.SAFE_METADATA_FIX,
      explanation: 'The prohibited attribute can be removed without creating or changing business data.',
      description: 'Remove isAccountingInLine from the header invoice.',
      operations: [{ type: 'REMOVE_ATTRIBUTE', targetPath: path, attributeName: 'isAccountingInLine' }],
      requiresUserInput: false
    };
  }

  function plan(finding, context) {
    var result;
    if (!finding || typeof finding !== 'object') result = manualPlan(null, 'A normalized finding is required.');
    else if (finding.code === 'CXML_ORDER_001') result = planOrderInfo(finding, context || {});
    else if (finding.code === 'CXML_SCENARIO_001') result = planScenarioIndicator(finding, context || {});
    else if (finding.code === 'CXML_SCENARIO_002') result = planAccountingIndicator(finding, context || {});
    else result = manualPlan(finding);
    result.xmlState = fingerprint(context && context.rawXml);
    return result;
  }

  function scanElements(xml) {
    var nodes = [];
    var stack = [];
    var i = 0;
    while (i < xml.length) {
      var start = xml.indexOf('<', i);
      if (start === -1) break;
      if (xml.substr(start, 4) === '<!--') { i = xml.indexOf('-->', start + 4); i = i < 0 ? xml.length : i + 3; continue; }
      if (xml.substr(start, 9) === '<![CDATA[') { i = xml.indexOf(']]>', start + 9); i = i < 0 ? xml.length : i + 3; continue; }
      if (xml.substr(start, 2) === '<?') { i = xml.indexOf('?>', start + 2); i = i < 0 ? xml.length : i + 2; continue; }
      if (xml.substr(start, 2) === '<!') { i = xml.indexOf('>', start + 2); i = i < 0 ? xml.length : i + 1; continue; }
      var quote = null, end = start + 1;
      for (; end < xml.length; end++) {
        var ch = xml.charAt(end);
        if (quote) { if (ch === quote) quote = null; }
        else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '>') break;
      }
      if (end >= xml.length) break;
      var raw = xml.slice(start, end + 1);
      if (/^<\s*\//.test(raw)) {
        var closed = stack.pop();
        if (closed) closed.end = end + 1;
      } else {
        var match = /^<\s*([^\s/>]+)/.exec(raw);
        if (match) {
          var node = { name: match[1].split(':').pop(), start: start, startTagEnd: end + 1, end: end + 1, rawStartTag: raw, parent: stack.length ? stack[stack.length - 1] : null };
          nodes.push(node);
          if (!/\/\s*>$/.test(raw)) stack.push(node);
        }
      }
      i = end + 1;
    }
    return nodes;
  }

  function direct(nodes, parent, name) {
    return nodes.filter(function (node) { return node.parent === parent && node.name === name; });
  }

  function structuralNodes(xml) {
    var nodes = scanElements(xml);
    var root = nodes.filter(function (n) { return !n.parent && n.name === 'cXML'; })[0];
    var request = root && direct(nodes, root, 'Request')[0];
    var invoice = request && direct(nodes, request, 'InvoiceDetailRequest')[0];
    return { all: nodes, invoice: invoice };
  }

  function removeAttribute(xml, element, attributeName) {
    var tag = xml.slice(element.start, element.startTagEnd);
    var pattern = new RegExp('\\s+' + attributeName + '\\s*=\\s*("[^"]*"|\'[^\']*\')');
    var match = pattern.exec(tag);
    if (!match) return null;
    return xml.slice(0, element.start + match.index) + xml.slice(element.start + match.index + match[0].length);
  }

  function setStructuralAttribute(xml, element, attributeName) {
    var tag = xml.slice(element.start, element.startTagEnd);
    var pattern = new RegExp('(\\s+' + attributeName + '\\s*=\\s*)(["\'])([^"\']*)(\\2)');
    var match = pattern.exec(tag);
    if (match) {
      var valueStart = element.start + match.index + match[1].length + 1;
      return xml.slice(0, valueStart) + 'yes' + xml.slice(valueStart + match[3].length);
    }
    var insertAt = element.startTagEnd - (/\/\s*>$/.test(tag) ? 2 : 1);
    return xml.slice(0, insertAt) + ' ' + attributeName + '="yes"' + xml.slice(insertAt);
  }

  function apply(planObject, xml) {
    var source = String(xml || '');
    if (!planObject || !planObject.available || [SAFETY.SAFE_RESTRUCTURE, SAFETY.SAFE_METADATA_FIX].indexOf(planObject.safety) === -1) {
      return { success: false, reason: 'Plan is not safely applicable.', proposedXml: source };
    }
    if (planObject.xmlState !== fingerprint(source)) return { success: false, stale: true, reason: 'Correction plan is stale.', proposedXml: source };
    if (!planObject.operations || planObject.operations.length !== 1) return { success: false, reason: 'Exactly one approved operation is required.', proposedXml: source };
    var operation = planObject.operations[0];
    var structure = structuralNodes(source);
    if (!structure.invoice) return { success: false, reason: 'Structural InvoiceDetailRequest was not found.', proposedXml: source };
    var proposed = null;
    if (operation.type === 'MOVE_NODE') {
      var orders = direct(structure.all, structure.invoice, 'InvoiceDetailOrder');
      var orderMatch = /InvoiceDetailOrder\[(\d+)\]/.exec(operation.destinationParentPath || '');
      var order = orders[orderMatch ? Number(orderMatch[1]) - 1 : 0];
      var infos = order ? direct(structure.all, order, 'InvoiceDetailOrderInfo') : [];
      var lines = order ? direct(structure.all, order, 'InvoiceDetailItem').concat(direct(structure.all, order, 'InvoiceDetailServiceItem')).sort(function (a, b) { return a.start - b.start; }) : [];
      if (infos.length && lines.length && infos[0].start > lines[0].start) {
        var fragment = source.slice(infos[0].start, infos[0].end);
        var removed = source.slice(0, infos[0].start) + source.slice(infos[0].end);
        proposed = removed.slice(0, lines[0].start) + fragment + removed.slice(lines[0].start);
      }
    } else {
      var headers = direct(structure.all, structure.invoice, 'InvoiceDetailRequestHeader');
      var targetName = operation.attributeName === 'isAccountingInLine' ? 'InvoiceDetailLineIndicator' : 'InvoiceDetailHeaderIndicator';
      var targets = headers.length ? direct(structure.all, headers[0], targetName) : [];
      if (targets.length && operation.type === 'REMOVE_ATTRIBUTE') proposed = removeAttribute(source, targets[0], operation.attributeName);
      if (targets.length && operation.type === 'SET_ATTRIBUTE_FROM_EXISTING_STRUCTURE') {
        var headerBodies = direct(structure.all, structure.invoice, 'InvoiceDetailHeaderOrder');
        if (headerBodies.length) proposed = setStructuralAttribute(source, targets[0], operation.attributeName);
      }
    }
    if (proposed === null || proposed === source) return { success: false, reason: 'Approved operation is no longer applicable.', proposedXml: source };
    return { success: true, originalXml: source, proposedXml: proposed, operation: operation };
  }

  function redact(text) {
    return String(text || '').replace(/(<(?:\w+:)?SharedSecret\b[^>]*>)[\s\S]*?(<\/(?:\w+:)?SharedSecret\s*>)/gi, '$1[REDACTED]$2');
  }

  function preview(planObject, xml) {
    var applied = apply(planObject, xml);
    if (!applied.success) return applied;
    var operation = planObject.operations[0];
    return {
      success: true,
      ruleId: planObject.ruleId,
      description: planObject.description,
      operation: operation.type,
      current: redact(operation.targetPath || operation.sourcePath || 'Current structural location'),
      proposed: redact(planObject.description),
      assurance: 'No business values will be generated.'
    };
  }

  function getRuleClassifications() {
    return JSON.parse(JSON.stringify(CLASSIFICATIONS));
  }

  global.XMLValidator.CorrectionEngine = {
    SAFETY: SAFETY,
    plan: plan,
    apply: apply,
    preview: preview,
    fingerprint: fingerprint,
    getRuleClassifications: getRuleClassifications
  };
})(window);
