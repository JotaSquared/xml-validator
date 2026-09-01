/**
 * XML Invoice Validator - Validation Rules Definition
 * 
 * Phase 8A: cXML / Coupa Structural Validation Core
 * 
 * Evidence-backed rules verified against:
 * - cXML Envelope & InvoiceDetail DTD Specification
 * - Coupa cXML Invoicing Documentation
 * 
 * STRICT ARCHITECTURAL CONSTRAINTS:
 * - 0 network calls (no fetch, no XHR, no DTD downloads)
 * - 0 assumed business rules (PO/Contract/SharedSecret/Tax/PaymentTerm are NOT universally required)
 * - Pure standalone Vanilla JS, file:// compatible
 */
window.XMLValidator = window.XMLValidator || {};

(function () {
  'use strict';

  /**
   * Helper: Extract version context metadata without downloading DTD or making network calls
   * @param {string} rawXml 
   * @param {Document} xmlDocument 
   * @returns {{ xmlDeclarationVersion: string|null, rootVersionAttribute: string|null, dtdVersion: string|null, dtdSystemIdentifier: string|null }}
   */
  function extractVersionContext(rawXml, xmlDocument) {
    var xmlDecl = null;
    if (typeof rawXml === 'string') {
      var declMatch = rawXml.match(/^\s*<\?xml\s+([^?]+)\?>/i);
      if (declMatch) {
        var vMatch = declMatch[1].match(/version\s*=\s*["']([^"']+)["']/i);
        xmlDecl = vMatch ? vMatch[1] : '1.0';
      }
    }

    var rootVer = null;
    if (xmlDocument && xmlDocument.documentElement && xmlDocument.documentElement.nodeName.toLowerCase() === 'cxml') {
      rootVer = xmlDocument.documentElement.getAttribute('version') || null;
    } else if (typeof rawXml === 'string') {
      var rootMatch = rawXml.match(/<cXML\s+[^>]*version\s*=\s*["']([^"']+)["']/i);
      if (rootMatch) rootVer = rootMatch[1];
    }

    var dtdSystemId = null;
    var dtdVersion = null;
    if (typeof rawXml === 'string') {
      var doctypeMatch = rawXml.match(/<!DOCTYPE\s+([^\s>]+)\s+(?:SYSTEM|PUBLIC\s+["'][^"']*["'])\s+["']([^"']+)["']/i);
      if (doctypeMatch) {
        dtdSystemId = doctypeMatch[2];
        var dtdVerMatch = dtdSystemId.match(/cXML\/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
        if (dtdVerMatch) {
          dtdVersion = dtdVerMatch[1];
        }
      }
    }

    return {
      xmlDeclarationVersion: xmlDecl,
      rootVersionAttribute: rootVer,
      dtdVersion: dtdVersion,
      dtdSystemIdentifier: dtdSystemId
    };
  }

  /**
   * Helper: Extract non-error structural observations
   * @param {Document} doc 
   * @returns {Object}
   */
  function extractStructuralObservations(doc) {
    var obs = {
      orderReferencePresent: false,
      orderReferencePayloadID: null,
      masterAgreementReferencePresent: false,
      masterAgreementPayloadID: null,
      emptyDocumentReferencePayloadID: false,
      invoiceDetailItemCount: 0,
      invoiceDetailServiceItemCount: 0,
      taxAtLine: false,
      taxAtSummary: false,
      purpose: null,
      sharedSecretPresent: false
    };

    if (!doc || !doc.documentElement) return obs;

    // 1. purpose
    var reqHeaders = doc.getElementsByTagName('InvoiceDetailRequestHeader');
    if (reqHeaders && reqHeaders.length > 0) {
      obs.purpose = reqHeaders[0].getAttribute('purpose') || null;
    }

    // 2. OrderReference
    var orderRefs = doc.getElementsByTagName('OrderReference');
    if (orderRefs && orderRefs.length > 0) {
      obs.orderReferencePresent = true;
      var docRefs = orderRefs[0].getElementsByTagName('DocumentReference');
      if (docRefs && docRefs.length > 0) {
        var pId = docRefs[0].getAttribute('payloadID');
        obs.orderReferencePayloadID = pId || '';
        if (!pId || pId.trim() === '') {
          obs.emptyDocumentReferencePayloadID = true;
        }
      }
    }

    // 3. MasterAgreementReference
    var maRefs = doc.getElementsByTagName('MasterAgreementReference');
    if (maRefs && maRefs.length > 0) {
      obs.masterAgreementReferencePresent = true;
      var mDocRefs = maRefs[0].getElementsByTagName('DocumentReference');
      if (mDocRefs && mDocRefs.length > 0) {
        var mPId = mDocRefs[0].getAttribute('payloadID');
        obs.masterAgreementPayloadID = mPId || '';
        if (!mPId || mPId.trim() === '') {
          obs.emptyDocumentReferencePayloadID = true;
        }
      }
    }

    // 4. Line counts
    var items = doc.getElementsByTagName('InvoiceDetailItem');
    obs.invoiceDetailItemCount = items ? items.length : 0;

    var serviceItems = doc.getElementsByTagName('InvoiceDetailServiceItem');
    obs.invoiceDetailServiceItemCount = serviceItems ? serviceItems.length : 0;

    // 5. Tax at line & summary
    if (items) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].getElementsByTagName('Tax').length > 0 || items[i].getElementsByTagName('TaxDetail').length > 0) {
          obs.taxAtLine = true;
          break;
        }
      }
    }
    if (serviceItems && !obs.taxAtLine) {
      for (var s = 0; s < serviceItems.length; s++) {
        if (serviceItems[s].getElementsByTagName('Tax').length > 0 || serviceItems[s].getElementsByTagName('TaxDetail').length > 0) {
          obs.taxAtLine = true;
          break;
        }
      }
    }

    var summaries = doc.getElementsByTagName('InvoiceDetailSummary');
    if (summaries && summaries.length > 0) {
      if (summaries[0].getElementsByTagName('Tax').length > 0 || summaries[0].getElementsByTagName('TaxDetail').length > 0) {
        obs.taxAtSummary = true;
      }
    }

    // 6. SharedSecret
    var secrets = doc.getElementsByTagName('SharedSecret');
    if (secrets && secrets.length > 0) {
      for (var sec = 0; sec < secrets.length; sec++) {
        var secVal = secrets[sec].textContent || secrets[sec].innerText || '';
        if (secVal.trim() !== '') {
          obs.sharedSecretPresent = true;
          break;
        }
      }
    }

    return obs;
  }

  /**
   * Helper to get direct element children
   * @param {Element} parentEl 
   * @param {string} [tagName] 
   * @returns {Array<Element>}
   */
  function getDirectElementChildren(parentEl, tagName) {
    if (!parentEl || !parentEl.childNodes) return [];
    var result = [];
    for (var i = 0; i < parentEl.childNodes.length; i++) {
      var child = parentEl.childNodes[i];
      if (child.nodeType === 1) { // ELEMENT_NODE
        if (!tagName || child.nodeName === tagName || child.localName === tagName) {
          result.push(child);
        }
      }
    }
    return result;
  }

  /**
   * Resolve the structural cXML Header without considering same-named elements elsewhere
   * @param {Document} doc
   * @returns {Element|null}
   */
  function getStructuralHeader(doc) {
    if (!doc || !doc.documentElement || doc.documentElement.nodeName !== 'cXML') return null;
    var headers = getDirectElementChildren(doc.documentElement, 'Header');
    return headers.length > 0 ? headers[0] : null;
  }

  /**
   * Resolve /cXML/Request/InvoiceDetailRequest using direct-child relationships
   * @param {Document} doc
   * @returns {Element|null}
   */
  function getStructuralInvoiceDetailRequest(doc) {
    if (!doc || !doc.documentElement || doc.documentElement.nodeName !== 'cXML') return null;
    var requests = getDirectElementChildren(doc.documentElement, 'Request');
    if (requests.length === 0) return null;
    var invoiceRequests = getDirectElementChildren(requests[0], 'InvoiceDetailRequest');
    return invoiceRequests.length > 0 ? invoiceRequests[0] : null;
  }

  // =========================================================================
  // PRODUCTION VALIDATION RULES (FASE 8A)
  // =========================================================================

  var rules = [
    // -----------------------------------------------------------------------
    // CXML_ENV_001 — Root Element
    // -----------------------------------------------------------------------
    {
      id: 'CXML_ENV_001',
      name: 'cXML Root Element',
      description: 'The root element of the XML document must be <cXML>.',
      category: 'ENVELOPE',
      pack: 'CXML_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'CXML_SPECIFICATION',
        title: 'cXML Envelope Specification',
        reference: 'cXML Root Element Declaration',
        url: 'http://xml.cxml.org'
      },
      validate: function (context) {
        var doc = context.xmlDocument;
        if (!doc || !doc.documentElement) {
          return [{
            code: 'CXML_ENV_001',
            title: 'Missing Document Root',
            message: 'No document root element was found.',
            path: '/*',
            suggestion: 'Ensure the document is enclosed in a root <cXML> element.',
            correction: {
              expected: '<cXML> root element',
              actual: 'No root element found',
              suggestion: 'Ensure the document is enclosed in a root <cXML> element.',
              autoFixable: false
            }
          }];
        }

        var rootTag = doc.documentElement.nodeName;
        if (rootTag !== 'cXML') {
          return [{
            code: 'CXML_ENV_001',
            title: 'Invalid Root Element',
            message: 'The document root element must be <cXML>. Found: <' + rootTag + '>.',
            path: '/' + rootTag,
            suggestion: 'Ensure the root element of the document is <cXML>.',
            correction: {
              expected: '<cXML> root element',
              actual: '<' + rootTag + '>',
              suggestion: 'Change root element to <cXML>.',
              autoFixable: false
            }
          }];
        }

        return [];
      }
    },

    // -----------------------------------------------------------------------
    // CXML_ENV_002 — payloadID
    // -----------------------------------------------------------------------
    {
      id: 'CXML_ENV_002',
      name: 'cXML Root payloadID Attribute',
      description: 'The <cXML> root element must have a non-empty payloadID attribute.',
      category: 'ENVELOPE',
      pack: 'CXML_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'CXML_SPECIFICATION',
        title: 'cXML Envelope Specification',
        reference: 'cXML Element Attributes',
        url: 'http://xml.cxml.org'
      },
      appliesTo: function (context) {
        return context.xmlDocument && context.xmlDocument.documentElement && context.xmlDocument.documentElement.nodeName === 'cXML';
      },
      validate: function (context) {
        var root = context.xmlDocument.documentElement;
        var payloadId = root.getAttribute('payloadID');

        if (payloadId === null || payloadId.trim() === '') {
          return [{
            code: 'CXML_ENV_002',
            title: 'Missing or Empty payloadID',
            message: 'The <cXML> root element must specify a non-empty payloadID attribute.',
            path: '/cXML/@payloadID',
            suggestion: 'Add a unique payloadID attribute to the <cXML> element (e.g. payloadID="20260831.001@supplier.com").',
            correction: {
              expected: 'Non-empty payloadID attribute on <cXML>',
              actual: payloadId === null ? 'payloadID attribute is missing' : 'payloadID attribute is empty',
              suggestion: 'Add a unique payloadID attribute to <cXML>.',
              autoFixable: false
            }
          }];
        }

        return [];
      }
    },

    // -----------------------------------------------------------------------
    // CXML_ENV_003 — timestamp
    // -----------------------------------------------------------------------
    {
      id: 'CXML_ENV_003',
      name: 'cXML Root timestamp Attribute',
      description: 'The <cXML> root element must have a non-empty timestamp attribute.',
      category: 'ENVELOPE',
      pack: 'CXML_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'CXML_SPECIFICATION',
        title: 'cXML Envelope Specification',
        reference: 'cXML Element Attributes',
        url: 'http://xml.cxml.org'
      },
      appliesTo: function (context) {
        return context.xmlDocument && context.xmlDocument.documentElement && context.xmlDocument.documentElement.nodeName === 'cXML';
      },
      validate: function (context) {
        var root = context.xmlDocument.documentElement;
        var timestamp = root.getAttribute('timestamp');

        if (timestamp === null || timestamp.trim() === '') {
          return [{
            code: 'CXML_ENV_003',
            title: 'Missing or Empty timestamp',
            message: 'The <cXML> root element must specify a non-empty timestamp attribute.',
            path: '/cXML/@timestamp',
            suggestion: 'Add a timestamp attribute with ISO date-time to the <cXML> element (e.g. timestamp="2026-08-31T12:00:00-00:00").',
            correction: {
              expected: 'Non-empty timestamp attribute on <cXML>',
              actual: timestamp === null ? 'timestamp attribute is missing' : 'timestamp attribute is empty',
              suggestion: 'Add a timestamp attribute to <cXML>.',
              autoFixable: false
            }
          }];
        }

        return [];
      }
    },

    // -----------------------------------------------------------------------
    // CXML_HEADER_001 — Header Element
    // -----------------------------------------------------------------------
    {
      id: 'CXML_HEADER_001',
      name: 'cXML Header and Partner Elements',
      description: 'The cXML invoice Header must be present and contain <From>, <To>, and <Sender> elements.',
      category: 'HEADER',
      pack: 'CXML_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'CXML_SPECIFICATION',
        title: 'cXML Envelope Specification',
        reference: 'Header Element & Partner Declarations',
        url: 'http://xml.cxml.org'
      },
      appliesTo: function (context) {
        return context.xmlDocument && context.xmlDocument.documentElement && context.xmlDocument.documentElement.nodeName === 'cXML';
      },
      validate: function (context) {
        var root = context.xmlDocument.documentElement;
        var headers = getDirectElementChildren(root, 'Header');

        if (headers.length === 0) {
          return [{
            code: 'CXML_HEADER_001',
            title: 'Missing <Header> Element',
            message: 'The <cXML> document must contain a <Header> element declaring routing partners.',
            path: '/cXML/Header',
            suggestion: 'Add a <Header> element containing <From>, <To>, and <Sender> partner declarations.',
            correction: {
              expected: '<Header> element containing <From>, <To>, and <Sender>',
              actual: '<Header> element is missing',
              suggestion: 'Add a <Header> element inside <cXML>.',
              autoFixable: false
            }
          }];
        }

        var header = headers[0];
        var froms = getDirectElementChildren(header, 'From');
        var tos = getDirectElementChildren(header, 'To');
        var senders = getDirectElementChildren(header, 'Sender');

        var missing = [];
        if (froms.length === 0) missing.push('<From>');
        if (tos.length === 0) missing.push('<To>');
        if (senders.length === 0) missing.push('<Sender>');

        if (missing.length > 0) {
          return [{
            code: 'CXML_HEADER_001',
            title: 'Missing Routing Partner Elements',
            message: 'The <Header> element is missing required partner element(s): ' + missing.join(', ') + '.',
            path: '/cXML/Header',
            suggestion: 'Ensure <Header> contains <From>, <To>, and <Sender> declarations.',
            correction: {
              expected: '<Header> containing <From>, <To>, and <Sender>',
              actual: 'Missing partner element(s): ' + missing.join(', '),
              suggestion: 'Add the missing partner element(s) to <Header>.',
              autoFixable: false
            }
          }];
        }

        return [];
      }
    },

    // -----------------------------------------------------------------------
    // CXML_CREDENTIAL_001 — Credential domain
    // -----------------------------------------------------------------------
    {
      id: 'CXML_CREDENTIAL_001',
      name: 'Credential domain Attribute',
      description: 'Each <Credential> inside <From>, <To>, and <Sender> must specify a non-empty domain attribute.',
      category: 'CREDENTIAL',
      pack: 'CXML_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'CXML_SPECIFICATION',
        title: 'cXML Envelope Specification',
        reference: 'Credential Element Structure',
        url: 'http://xml.cxml.org'
      },
      appliesTo: function (context) {
        return context.xmlDocument && context.xmlDocument.documentElement && context.xmlDocument.documentElement.nodeName === 'cXML';
      },
      validate: function (context) {
        var doc = context.xmlDocument;
        var findings = [];
        var partners = ['From', 'To', 'Sender'];
        var header = getStructuralHeader(doc);

        if (!header) return findings;

        for (var p = 0; p < partners.length; p++) {
          var pName = partners[p];
          var pEls = getDirectElementChildren(header, pName);
          for (var i = 0; i < pEls.length; i++) {
            var creds = getDirectElementChildren(pEls[i], 'Credential');
            for (var c = 0; c < creds.length; c++) {
              var cred = creds[c];
              var domain = cred.getAttribute('domain');
              var cPath = '/cXML/Header/' + pName + '/Credential' + (creds.length > 1 ? '[' + (c + 1) + ']' : '');

              if (domain === null || domain.trim() === '') {
                findings.push({
                  code: 'CXML_CREDENTIAL_001',
                  title: 'Missing or Empty Credential domain',
                  message: 'The <Credential> inside <' + pName + '> must have a non-empty domain attribute.',
                  path: cPath + '/@domain',
                  suggestion: 'Add a domain attribute to the <Credential> element (e.g. domain="DUNS" or domain="COUPA").',
                  correction: {
                    expected: 'Non-empty domain attribute on <Credential>',
                    actual: domain === null ? 'domain attribute is missing' : 'domain attribute is empty',
                    suggestion: 'Specify domain="COUPA" or your organization domain on <Credential>.',
                    autoFixable: false
                  }
                });
              }
            }
          }
        }

        return findings;
      }
    },

    // -----------------------------------------------------------------------
    // CXML_CREDENTIAL_002 — Credential Identity
    // -----------------------------------------------------------------------
    {
      id: 'CXML_CREDENTIAL_002',
      name: 'Credential Identity Element',
      description: 'Each <Credential> inside <From>, <To>, and <Sender> must contain a non-empty <Identity> element.',
      category: 'CREDENTIAL',
      pack: 'CXML_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'CXML_SPECIFICATION',
        title: 'cXML Envelope Specification',
        reference: 'Credential Identity Declaration',
        url: 'http://xml.cxml.org'
      },
      appliesTo: function (context) {
        return context.xmlDocument && context.xmlDocument.documentElement && context.xmlDocument.documentElement.nodeName === 'cXML';
      },
      validate: function (context) {
        var doc = context.xmlDocument;
        var findings = [];
        var partners = ['From', 'To', 'Sender'];
        var header = getStructuralHeader(doc);

        if (!header) return findings;

        for (var p = 0; p < partners.length; p++) {
          var pName = partners[p];
          var pEls = getDirectElementChildren(header, pName);
          for (var i = 0; i < pEls.length; i++) {
            var creds = getDirectElementChildren(pEls[i], 'Credential');
            for (var c = 0; c < creds.length; c++) {
              var cred = creds[c];
              var idEls = getDirectElementChildren(cred, 'Identity');
              var cPath = '/cXML/Header/' + pName + '/Credential' + (creds.length > 1 ? '[' + (c + 1) + ']' : '');

              if (idEls.length === 0) {
                findings.push({
                  code: 'CXML_CREDENTIAL_002',
                  title: 'Missing <Identity> in Credential',
                  message: 'The <Credential> inside <' + pName + '> must contain an <Identity> element.',
                  path: cPath + '/Identity',
                  suggestion: 'Add an <Identity> element containing the partner identifier text.',
                  correction: {
                    expected: '<Identity> element with non-empty text content',
                    actual: '<Identity> element is missing',
                    suggestion: 'Add an <Identity> element inside <Credential>.',
                    autoFixable: false
                  }
                });
              } else {
                var idVal = idEls[0].textContent || idEls[0].innerText || '';
                if (idVal.trim() === '') {
                  findings.push({
                    code: 'CXML_CREDENTIAL_002',
                    title: 'Empty <Identity> in Credential',
                    message: 'The <Identity> inside <' + pName + '> Credential must contain non-empty identifier text.',
                    path: cPath + '/Identity',
                    suggestion: 'Provide a valid identifier text inside <Identity>.',
                    correction: {
                      expected: 'Non-empty text content inside <Identity>',
                      actual: '<Identity> content is empty',
                      suggestion: 'Provide the partner identifier string inside <Identity>.',
                      autoFixable: false
                    }
                  });
                }
              }
            }
          }
        }

        return findings;
      }
    },

    // -----------------------------------------------------------------------
    // COUPA_INV_001 — InvoiceDetailRequest
    // -----------------------------------------------------------------------
    {
      id: 'COUPA_INV_001',
      name: 'InvoiceDetailRequest Document Type',
      description: 'The document must contain an /cXML/Request/InvoiceDetailRequest element.',
      category: 'DOCUMENT_TYPE',
      pack: 'COUPA_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'COUPA_DOCUMENTATION',
        title: 'Coupa cXML Invoicing Guide',
        reference: 'cXML Request Structure',
        url: 'https://docs.coupa.com'
      },
      appliesTo: function (context) {
        return context.xmlDocument && context.xmlDocument.documentElement && context.xmlDocument.documentElement.nodeName === 'cXML';
      },
      validate: function (context) {
        var root = context.xmlDocument.documentElement;
        var requests = getDirectElementChildren(root, 'Request');

        if (requests.length === 0) {
          return [{
            code: 'COUPA_INV_001',
            title: 'Unsupported cXML document type',
            message: 'Unsupported cXML document type. Missing <Request> element. Expected /cXML/Request/InvoiceDetailRequest.',
            path: '/cXML/Request',
            suggestion: 'Ensure the cXML document contains a <Request> element enclosing <InvoiceDetailRequest>.',
            correction: {
              expected: '/cXML/Request/InvoiceDetailRequest',
              actual: 'Missing <Request> element',
              suggestion: 'Provide a cXML document containing an <InvoiceDetailRequest> within <Request>.',
              autoFixable: false
            }
          }];
        }

        var req = requests[0];
        var invReqs = getDirectElementChildren(req, 'InvoiceDetailRequest');

        if (invReqs.length === 0) {
          // Check what request type was found
          var childReqs = getDirectElementChildren(req);
          var foundType = childReqs.length > 0 ? childReqs[0].nodeName : 'Empty Request';

          return [{
            code: 'COUPA_INV_001',
            title: 'Unsupported cXML document type',
            message: 'Unsupported cXML document type. Expected InvoiceDetailRequest but found <' + foundType + '>.',
            path: '/cXML/Request/' + (childReqs.length > 0 ? childReqs[0].nodeName : ''),
            suggestion: 'Provide an invoice document with <InvoiceDetailRequest> as the request payload.',
            correction: {
              expected: '/cXML/Request/InvoiceDetailRequest',
              actual: 'Found <' + foundType + '> instead of <InvoiceDetailRequest>',
              suggestion: 'Provide a cXML document containing an <InvoiceDetailRequest> within <Request>.',
              autoFixable: false
            }
          }];
        }

        return [];
      }
    },

    // -----------------------------------------------------------------------
    // CXML_INV_HEADER_001 — InvoiceDetailRequestHeader
    // -----------------------------------------------------------------------
    {
      id: 'CXML_INV_HEADER_001',
      name: 'InvoiceDetailRequestHeader Element',
      description: 'The <InvoiceDetailRequest> must contain an <InvoiceDetailRequestHeader> element.',
      category: 'INVOICE_HEADER',
      pack: 'CXML_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'CXML_SPECIFICATION',
        title: 'cXML InvoiceDetail DTD',
        reference: 'InvoiceDetailRequest Definition',
        url: 'http://xml.cxml.org'
      },
      appliesTo: function (context) {
        return getStructuralInvoiceDetailRequest(context.xmlDocument) !== null;
      },
      validate: function (context) {
        var doc = context.xmlDocument;
        var invReq = getStructuralInvoiceDetailRequest(doc);
        if (!invReq) return [];
        var headers = getDirectElementChildren(invReq, 'InvoiceDetailRequestHeader');

        if (headers.length === 0) {
          return [{
            code: 'CXML_INV_HEADER_001',
            title: 'Missing InvoiceDetailRequestHeader',
            message: 'The <InvoiceDetailRequest> must contain an <InvoiceDetailRequestHeader> element.',
            path: '/cXML/Request/InvoiceDetailRequest/InvoiceDetailRequestHeader',
            suggestion: 'Add an <InvoiceDetailRequestHeader> element to declare invoice attributes and partners.',
            correction: {
              expected: '<InvoiceDetailRequestHeader> inside <InvoiceDetailRequest>',
              actual: '<InvoiceDetailRequestHeader> is missing',
              suggestion: 'Add an <InvoiceDetailRequestHeader> element inside <InvoiceDetailRequest>.',
              autoFixable: false
            }
          }];
        }

        return [];
      }
    },

    // -----------------------------------------------------------------------
    // CXML_INV_HEADER_002 — invoiceID
    // -----------------------------------------------------------------------
    {
      id: 'CXML_INV_HEADER_002',
      name: 'InvoiceDetailRequestHeader invoiceID Attribute',
      description: 'The <InvoiceDetailRequestHeader> must have a non-empty invoiceID attribute.',
      category: 'INVOICE_HEADER',
      pack: 'CXML_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'CXML_SPECIFICATION',
        title: 'cXML InvoiceDetail DTD',
        reference: 'InvoiceDetailRequestHeader Attributes',
        url: 'http://xml.cxml.org'
      },
      appliesTo: function (context) {
        return getStructuralInvoiceDetailRequest(context.xmlDocument) !== null;
      },
      validate: function (context) {
        var doc = context.xmlDocument;
        var invReq = getStructuralInvoiceDetailRequest(doc);
        if (!invReq) return [];
        var headers = getDirectElementChildren(invReq, 'InvoiceDetailRequestHeader');
        if (headers.length === 0) return [];

        var header = headers[0];
        var invoiceId = header.getAttribute('invoiceID');

        if (invoiceId === null || invoiceId.trim() === '') {
          return [{
            code: 'CXML_INV_HEADER_002',
            title: 'Missing or Empty invoiceID',
            message: 'The <InvoiceDetailRequestHeader> must specify a non-empty invoiceID attribute.',
            path: '/cXML/Request/InvoiceDetailRequest/InvoiceDetailRequestHeader/@invoiceID',
            suggestion: 'Specify a non-empty invoiceID attribute on <InvoiceDetailRequestHeader> (e.g. invoiceID="INV-1001").',
            correction: {
              expected: 'Non-empty invoiceID attribute on <InvoiceDetailRequestHeader>',
              actual: invoiceId === null ? 'invoiceID attribute is missing' : 'invoiceID attribute is empty',
              suggestion: 'Add invoiceID attribute to <InvoiceDetailRequestHeader>.',
              autoFixable: false
            }
          }];
        }

        return [];
      }
    },

    // -----------------------------------------------------------------------
    // CXML_INV_HEADER_003 — invoiceDate
    // -----------------------------------------------------------------------
    {
      id: 'CXML_INV_HEADER_003',
      name: 'InvoiceDetailRequestHeader invoiceDate Attribute',
      description: 'The <InvoiceDetailRequestHeader> must have a non-empty invoiceDate attribute.',
      category: 'INVOICE_HEADER',
      pack: 'CXML_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'CXML_SPECIFICATION',
        title: 'cXML InvoiceDetail DTD',
        reference: 'InvoiceDetailRequestHeader Attributes',
        url: 'http://xml.cxml.org'
      },
      appliesTo: function (context) {
        return getStructuralInvoiceDetailRequest(context.xmlDocument) !== null;
      },
      validate: function (context) {
        var doc = context.xmlDocument;
        var invReq = getStructuralInvoiceDetailRequest(doc);
        if (!invReq) return [];
        var headers = getDirectElementChildren(invReq, 'InvoiceDetailRequestHeader');
        if (headers.length === 0) return [];

        var header = headers[0];
        var invoiceDate = header.getAttribute('invoiceDate');

        if (invoiceDate === null || invoiceDate.trim() === '') {
          return [{
            code: 'CXML_INV_HEADER_003',
            title: 'Missing or Empty invoiceDate',
            message: 'The <InvoiceDetailRequestHeader> must specify a non-empty invoiceDate attribute.',
            path: '/cXML/Request/InvoiceDetailRequest/InvoiceDetailRequestHeader/@invoiceDate',
            suggestion: 'Specify a non-empty invoiceDate attribute on <InvoiceDetailRequestHeader> (e.g. invoiceDate="2026-08-31T00:00:00-00:00").',
            correction: {
              expected: 'Non-empty invoiceDate attribute on <InvoiceDetailRequestHeader>',
              actual: invoiceDate === null ? 'invoiceDate attribute is missing' : 'invoiceDate attribute is empty',
              suggestion: 'Add invoiceDate attribute to <InvoiceDetailRequestHeader>.',
              autoFixable: false
            }
          }];
        }

        return [];
      }
    },

    // -----------------------------------------------------------------------
    // CXML_ORDER_001 — InvoiceDetailOrder Structure
    // -----------------------------------------------------------------------
    {
      id: 'CXML_ORDER_001',
      name: 'InvoiceDetailOrder Structure',
      description: 'Each <InvoiceDetailOrder> must contain <InvoiceDetailOrderInfo> followed by one or more invoice line items (<InvoiceDetailItem> or <InvoiceDetailServiceItem>).',
      category: 'ORDER_STRUCTURE',
      pack: 'COUPA_CORE',
      severity: 'error',
      enabled: true,
      source: {
        type: 'COUPA_DOCUMENTATION',
        title: 'Coupa cXML Invoicing Guide',
        reference: 'InvoiceDetailOrder Structure & Line Elements',
        url: 'https://docs.coupa.com'
      },
      appliesTo: function (context) {
        return getStructuralInvoiceDetailRequest(context.xmlDocument) !== null;
      },
      validate: function (context) {
        var doc = context.xmlDocument;
        var invReq = getStructuralInvoiceDetailRequest(doc);
        if (!invReq) return [];
        var orders = getDirectElementChildren(invReq, 'InvoiceDetailOrder');

        if (orders.length === 0) {
          return [{
            code: 'CXML_ORDER_001',
            title: 'Missing InvoiceDetailOrder',
            message: 'The <InvoiceDetailRequest> must contain at least one <InvoiceDetailOrder> element.',
            path: '/cXML/Request/InvoiceDetailRequest/InvoiceDetailOrder',
            suggestion: 'Add an <InvoiceDetailOrder> element containing order info and line items.',
            correction: {
              expected: 'At least one <InvoiceDetailOrder> containing InvoiceDetailOrderInfo and line items',
              actual: '<InvoiceDetailOrder> is missing',
              suggestion: 'Add <InvoiceDetailOrder> containing <InvoiceDetailOrderInfo> and line items.',
              autoFixable: false
            }
          }];
        }

        var findings = [];

        for (var o = 0; o < orders.length; o++) {
          var order = orders[o];
          var oPath = '/cXML/Request/InvoiceDetailRequest/InvoiceDetailOrder' + (orders.length > 1 ? '[' + (o + 1) + ']' : '');
          var childNodes = getDirectElementChildren(order);

          var orderInfoIndex = -1;
          var lineCount = 0;
          var firstLineIndex = -1;

          for (var c = 0; c < childNodes.length; c++) {
            var cName = childNodes[c].nodeName;
            if (cName === 'InvoiceDetailOrderInfo') {
              if (orderInfoIndex === -1) {
                orderInfoIndex = c;
              }
            } else if (cName === 'InvoiceDetailItem' || cName === 'InvoiceDetailServiceItem') {
              lineCount++;
              if (firstLineIndex === -1) {
                firstLineIndex = c;
              }
            }
          }

          // Case A: Missing InvoiceDetailOrderInfo
          if (orderInfoIndex === -1) {
            findings.push({
              code: 'CXML_ORDER_001',
              title: 'Invalid InvoiceDetailOrder Structure',
              message: 'InvoiceDetailOrder must contain an <InvoiceDetailOrderInfo> element.',
              path: oPath,
              suggestion: 'Place <InvoiceDetailOrderInfo> as the first element inside <InvoiceDetailOrder>.',
              correction: {
                expected: 'InvoiceDetailOrderInfo followed by one or more InvoiceDetailItem / InvoiceDetailServiceItem',
                actual: 'InvoiceDetailOrderInfo is missing',
                suggestion: 'Place InvoiceDetailOrderInfo before invoice line elements.',
                autoFixable: false
              }
            });
            continue;
          }

          // Case B: Line items appear before InvoiceDetailOrderInfo
          if (firstLineIndex !== -1 && firstLineIndex < orderInfoIndex) {
            var firstLineTag = childNodes[firstLineIndex].nodeName;
            findings.push({
              code: 'CXML_ORDER_001',
              title: 'Invalid InvoiceDetailOrder Structure',
              message: 'InvoiceDetailOrderInfo must appear before invoice line elements. Found <' + firstLineTag + '> before <InvoiceDetailOrderInfo>.',
              path: oPath,
              suggestion: 'Move <InvoiceDetailOrderInfo> to the beginning of <InvoiceDetailOrder>, before all line items.',
              correction: {
                expected: 'InvoiceDetailOrderInfo followed by one or more InvoiceDetailItem / InvoiceDetailServiceItem',
                actual: firstLineTag + ' found before InvoiceDetailOrderInfo',
                suggestion: 'Place InvoiceDetailOrderInfo before invoice line elements.',
                autoFixable: false
              }
            });
          }

          // Case C: No line items found
          if (lineCount === 0) {
            findings.push({
              code: 'CXML_ORDER_001',
              title: 'Invalid InvoiceDetailOrder Structure',
              message: 'InvoiceDetailOrder must contain at least one line item (<InvoiceDetailItem> or <InvoiceDetailServiceItem>).',
              path: oPath,
              suggestion: 'Add one or more <InvoiceDetailItem> or <InvoiceDetailServiceItem> elements.',
              correction: {
                expected: 'InvoiceDetailOrderInfo followed by one or more InvoiceDetailItem / InvoiceDetailServiceItem',
                actual: 'No line items found in InvoiceDetailOrder',
                suggestion: 'Include at least one InvoiceDetailItem or InvoiceDetailServiceItem in InvoiceDetailOrder.',
                autoFixable: false
              }
            });
          }
        }

        return findings;
      }
    }
  ];

  // Expose rules list and helpers
  XMLValidator.ValidationRules = rules;
  XMLValidator.extractVersionContext = extractVersionContext;
  XMLValidator.extractStructuralObservations = extractStructuralObservations;

  // Auto-register rules into RuleEngine if RuleEngine is already loaded
  if (XMLValidator.RuleEngine && typeof XMLValidator.RuleEngine.registerMany === 'function') {
    XMLValidator.RuleEngine.clear();
    XMLValidator.RuleEngine.registerMany(rules);
  }

})();
