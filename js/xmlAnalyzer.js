/**
 * XML Invoice Validator - XML Analyzer Module
 * 
 * Objective structural analysis:
 * - Neutral AST-like tree representation
 * - Unique node ID assignment (node_1, node_2, ...)
 * - Precise XPath-like paths with sibling repetition indices
 * - Attribute extraction and namespace preservation
 * - Direct text extraction (differentiating direct text/CDATA from descendants)
 * - Calculation of structural statistics (elements, attributes, depth, repeated groups)
 * - In-memory node index for O(1) selection lookup
 * 
 * 100% standalone, zero external dependencies, file:// compatible.
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.Analyzer = (function () {
  'use strict';

  var nodeIdCounter = 0;

  /**
   * Extract direct text and CDATA content from immediate child nodes only
   * (Does NOT aggregate text from descendant elements)
   * @param {Element} domElement 
   * @returns {string}
   */
  function extractDirectText(domElement) {
    if (!domElement || !domElement.childNodes) return '';

    var directParts = [];
    var childNodes = domElement.childNodes;

    for (var i = 0; i < childNodes.length; i++) {
      var child = childNodes[i];
      // 3 = TEXT_NODE, 4 = CDATA_SECTION_NODE
      if (child.nodeType === 3 || child.nodeType === 4) {
        var val = child.nodeValue;
        if (val) {
          directParts.push(val);
        }
      }
    }

    return directParts.join('').trim();
  }

  /**
   * Extract attributes from a DOM element
   * @param {Element} domElement 
   * @returns {Array<{ name: string, localName: string, prefix: string|null, namespaceURI: string|null, value: string }>}
   */
  function extractAttributes(domElement) {
    var attrs = [];
    if (!domElement || !domElement.attributes) return attrs;

    var domAttrs = domElement.attributes;
    for (var i = 0; i < domAttrs.length; i++) {
      var attr = domAttrs[i];
      attrs.push({
        name: attr.name,
        localName: attr.localName || attr.name,
        prefix: attr.prefix || null,
        namespaceURI: attr.namespaceURI || null,
        value: attr.value
      });
    }

    return attrs;
  }

  /**
   * Collect all declared namespaces in an element and register into global list
   * @param {Element} domElement 
   * @param {Array<{ prefix: string|null, uri: string }>} namespacesList 
   * @param {Object.<string, boolean>} seenUris 
   */
  function collectNamespaces(domElement, namespacesList, seenUris) {
    if (!domElement || !domElement.attributes) return;

    var attrs = domElement.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      var name = attr.name;
      var val = attr.value;

      if (name === 'xmlns') {
        var key = 'default:' + val;
        if (!seenUris[key]) {
          seenUris[key] = true;
          namespacesList.push({ prefix: null, uri: val });
        }
      } else if (name.indexOf('xmlns:') === 0) {
        var prefix = name.substring(6);
        var pKey = prefix + ':' + val;
        if (!seenUris[pKey]) {
          seenUris[pKey] = true;
          namespacesList.push({ prefix: prefix, uri: val });
        }
      }
    }
  }

  /**
   * Recursive tree builder creating neutral node models
   * 
   * @param {Element} domElement Current DOM element
   * @param {string} parentPath Path of the parent element
   * @param {number} depth 0-indexed depth (Root element = depth 0)
   * @param {number} siblingIndex 1-based index among same-name siblings under this parent
   * @param {number} siblingCount Total count of same-name siblings under this parent
   * @param {Object} context Context object holding nodeIndex and stats accumulators
   * @returns {Object} Neutral tree node
   */
  function buildNeutralNode(domElement, parentPath, depth, siblingIndex, siblingCount, context) {
    nodeIdCounter++;
    var currentId = 'node_' + nodeIdCounter;

    var nodeName = domElement.nodeName;
    var localName = domElement.localName || nodeName;
    var prefix = domElement.prefix || null;
    var namespaceURI = domElement.namespaceURI || null;

    // Calculate XPath-like path:
    // If multiple siblings with this name exist under this parent: append [siblingIndex]
    // If only one child with this name exists under this parent: no index
    var pathSegment = nodeName;
    if (siblingCount > 1) {
      pathSegment += '[' + siblingIndex + ']';
    }

    var currentPath = parentPath === '' ? '/' + pathSegment : parentPath + '/' + pathSegment;

    // Direct text & attributes
    var directText = extractDirectText(domElement);
    var attributes = extractAttributes(domElement);

    // Update global statistics
    context.stats.totalElements++;
    context.stats.totalAttributes += attributes.length;
    if (depth > context.stats.maxDepth) {
      context.stats.maxDepth = depth;
    }
    if (directText !== '') {
      context.stats.totalTextNodes++;
    }

    // Name frequency
    context.stats.elementNameFrequency[nodeName] = (context.stats.elementNameFrequency[nodeName] || 0) + 1;

    // Collect namespaces
    collectNamespaces(domElement, context.namespaces, context.seenNamespaces);

    // Process element children (filter out comments, whitespace, processing instructions)
    var childElements = [];
    var childNodes = domElement.childNodes;
    for (var i = 0; i < childNodes.length; i++) {
      if (childNodes[i].nodeType === 1) { // Node.ELEMENT_NODE
        childElements.push(childNodes[i]);
      }
    }

    // Group child elements by tag name to determine counts and repetition
    var nameCounts = {};
    for (var j = 0; j < childElements.length; j++) {
      var cName = childElements[j].nodeName;
      nameCounts[cName] = (nameCounts[cName] || 0) + 1;
    }

    // Count repeated element groups under this parent:
    // A repeatedElementGroup occurs whenever a parent has > 1 child of the exact same name
    for (var tag in nameCounts) {
      if (nameCounts.hasOwnProperty(tag)) {
        if (nameCounts[tag] > 1) {
          context.stats.repeatedElementGroups++;
        }
      }
    }

    // Track running index for each tag name
    var nameRunningIndex = {};
    var children = [];

    for (var k = 0; k < childElements.length; k++) {
      var childDom = childElements[k];
      var chName = childDom.nodeName;
      var sCount = nameCounts[chName];
      nameRunningIndex[chName] = (nameRunningIndex[chName] || 0) + 1;
      var sIndex = nameRunningIndex[chName];

      var childNode = buildNeutralNode(
        childDom,
        currentPath,
        depth + 1,
        sIndex,
        sCount,
        context
      );
      children.push(childNode);
    }

    var neutralNode = {
      id: currentId,
      name: nodeName,
      localName: localName,
      prefix: prefix,
      namespaceURI: namespaceURI,
      path: currentPath,
      depth: depth,
      siblingIndex: siblingIndex,
      siblingCount: siblingCount,
      isRepeatedSibling: siblingCount > 1,
      attributes: attributes,
      directText: directText,
      childCount: children.length,
      hasElementChildren: children.length > 0,
      children: children
    };

    // Register into in-memory node index for O(1) lookup
    context.nodeIndex[currentId] = neutralNode;

    return neutralNode;
  }

  /**
   * Main analysis entry point
   * 
   * @param {Document} xmlDocument Valid Document from XMLValidator.Parser
   * @returns {{
   *   success: boolean,
   *   tree: Object|null,
   *   statistics: {
   *     totalElements: number,
   *     totalAttributes: number,
   *     maxDepth: number,
   *     uniqueElementNames: number,
   *     repeatedElementGroups: number,
   *     totalTextNodes: number,
   *     elementNameFrequency: Object.<string, number>
   *   }|null,
   *   nodeIndex: Object.<string, Object>|null,
   *   namespaces: Array<{ prefix: string|null, uri: string }>,
   *   error: Object|null
   * }}
   */
  function analyze(xmlDocument) {
    if (!xmlDocument || !xmlDocument.documentElement) {
      return {
        success: false,
        tree: null,
        statistics: null,
        nodeIndex: null,
        namespaces: [],
        error: {
          code: 'XML_ANALYZER_001',
          title: 'Invalid XML Document',
          message: 'No valid XML Document tree was provided to the analyzer.'
        }
      };
    }

    try {
      nodeIdCounter = 0;

      var context = {
        nodeIndex: {},
        namespaces: [],
        seenNamespaces: {},
        stats: {
          totalElements: 0,
          totalAttributes: 0,
          maxDepth: 0,
          uniqueElementNames: 0,
          repeatedElementGroups: 0,
          totalTextNodes: 0,
          elementNameFrequency: {}
        }
      };

      var rootEl = xmlDocument.documentElement;
      var rootNode = buildNeutralNode(rootEl, '', 0, 1, 1, context);

      // Compute unique element names count
      var uniqueCount = 0;
      for (var key in context.stats.elementNameFrequency) {
        if (context.stats.elementNameFrequency.hasOwnProperty(key)) {
          uniqueCount++;
        }
      }
      context.stats.uniqueElementNames = uniqueCount;

      return {
        success: true,
        tree: rootNode,
        statistics: context.stats,
        nodeIndex: context.nodeIndex,
        namespaces: context.namespaces,
        error: null
      };

    } catch (e) {
      return {
        success: false,
        tree: null,
        statistics: null,
        nodeIndex: null,
        namespaces: [],
        error: {
          code: 'XML_ANALYZER_002',
          title: 'Analysis Exception',
          message: 'An error occurred during structural analysis: ' + (e && e.message ? e.message : String(e))
        }
      };
    }
  }

  return {
    analyze: analyze
  };
})();
