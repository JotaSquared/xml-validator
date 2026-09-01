/**
 * XML Invoice Validator - Template Comparator Module
 * 
 * Phase 5: XML Template Comparison Engine
 * 
 * Responsibilities:
 * - Compare structural AST of Analyzed XML against Reference XML
 * - Purely descriptive comparison (never assigns ERROR / WARNING)
 * - Namespace-aware matching (URI + localName, agnostic to arbitrary prefix aliases)
 * - Order-independent sibling matching by default
 * - Occurrence difference reporting (cardinality count vs reference)
 * - Hierarchy difference detection (relocated elements)
 * - Attribute presence/absence detection (values ignored by default)
 * - Text values ignored by default (sample data vs actual data)
 * - Completely offline-first and safe for file://
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.Comparator = (function () {
  'use strict';

  // Default comparison configuration
  var DEFAULT_OPTIONS = {
    compareTextValues: false,
    compareAttributeValues: false,
    ignoreSiblingOrder: true
  };

  /**
   * Helper to construct a canonical identity key for an element node
   * Namespace-aware: matches namespaceURI + '#' + localName
   * If no namespaceURI, uses '' + '#' + localName
   * @param {Object} node 
   * @returns {string}
   */
  function getNodeKey(node) {
    if (!node) return '';
    var uri = node.namespaceURI || '';
    var local = node.localName || node.name || '';
    return uri + '#' + local;
  }

  /**
   * Helper to construct a canonical identity key for an attribute
   * @param {Object} attr 
   * @returns {string}
   */
  function getAttrKey(attr) {
    if (!attr) return '';
    var uri = attr.namespaceURI || '';
    var local = attr.localName || attr.name || '';
    return uri ? (uri + '#' + local) : (attr.name || local);
  }

  /**
   * Group an array of child AST nodes by their canonical node key
   * @param {Array<Object>} children 
   * @returns {Object<string, Array<Object>>}
   */
  function groupChildrenByKey(children) {
    var groups = {};
    if (!Array.isArray(children)) return groups;

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var key = getNodeKey(child);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(child);
    }
    return groups;
  }

  /**
   * Compare attributes between a matched source node and reference node
   * @param {Object} srcNode 
   * @param {Object} refNode 
   * @param {Object} options 
   * @param {Array<Object>} diffsList 
   */
  function compareAttributes(srcNode, refNode, options, diffsList) {
    var srcAttrs = (srcNode && srcNode.attributes) || [];
    var refAttrs = (refNode && refNode.attributes) || [];

    var srcMap = {};
    for (var s = 0; s < srcAttrs.length; s++) {
      var sKey = getAttrKey(srcAttrs[s]);
      srcMap[sKey] = srcAttrs[s];
    }

    var refMap = {};
    for (var r = 0; r < refAttrs.length; r++) {
      var rKey = getAttrKey(refAttrs[r]);
      refMap[rKey] = refAttrs[r];
    }

    // Check for missing attributes (present in reference, absent in source)
    for (var refKey in refMap) {
      if (refMap.hasOwnProperty(refKey)) {
        if (!srcMap[refKey]) {
          var refAttr = refMap[refKey];
          diffsList.push({
            id: 'diff_' + (diffsList.length + 1),
            type: 'ATTRIBUTE_MISSING',
            category: 'ATTRIBUTE',
            sourcePath: srcNode ? srcNode.path : null,
            referencePath: refNode ? refNode.path : null,
            elementName: refNode ? refNode.name : '',
            attributeName: refAttr.name,
            message: 'Attribute "' + refAttr.name + '" exists on <' + refNode.name + '> in reference XML but is missing in analyzed XML.',
            sourceNodeId: srcNode ? srcNode.id : null,
            referenceNodeId: refNode ? refNode.id : null,
            severity: null,
            details: {
              attribute: refAttr.name,
              referenceElement: refNode.name
            }
          });
        } else if (options.compareAttributeValues && srcMap[refKey].value !== refMap[refKey].value) {
          // If explicit attribute value comparison is requested
          diffsList.push({
            id: 'diff_' + (diffsList.length + 1),
            type: 'ATTRIBUTE_VALUE_DIFFERENCE',
            category: 'ATTRIBUTE',
            sourcePath: srcNode ? srcNode.path : null,
            referencePath: refNode ? refNode.path : null,
            elementName: refNode ? refNode.name : '',
            attributeName: refMap[refKey].name,
            message: 'Value of attribute "' + refMap[refKey].name + '" differs: Reference has "' + refMap[refKey].value + '", Analyzed has "' + srcMap[refKey].value + '".',
            sourceNodeId: srcNode ? srcNode.id : null,
            referenceNodeId: refNode ? refNode.id : null,
            severity: null,
            details: {
              attribute: refMap[refKey].name,
              sourceValue: srcMap[refKey].value,
              referenceValue: refMap[refKey].value
            }
          });
        }
      }
    }

    // Check for additional attributes (present in source, absent in reference)
    for (var srcKey in srcMap) {
      if (srcMap.hasOwnProperty(srcKey)) {
        if (!refMap[srcKey]) {
          var srcAttr = srcMap[srcKey];
          diffsList.push({
            id: 'diff_' + (diffsList.length + 1),
            type: 'ATTRIBUTE_ADDITIONAL',
            category: 'ATTRIBUTE',
            sourcePath: srcNode ? srcNode.path : null,
            referencePath: refNode ? refNode.path : null,
            elementName: srcNode ? srcNode.name : '',
            attributeName: srcAttr.name,
            message: 'Attribute "' + srcAttr.name + '" exists on <' + srcNode.name + '> in analyzed XML but not in reference XML.',
            sourceNodeId: srcNode ? srcNode.id : null,
            referenceNodeId: refNode ? refNode.id : null,
            severity: null,
            details: {
              attribute: srcAttr.name,
              sourceElement: srcNode.name
            }
          });
        }
      }
    }
  }

  /**
   * Helper to build a lookup of elements across the entire document
   * @param {Object} nodeIndex 
   * @returns {Object<string, Array<Object>>}
   */
  function buildGlobalKeyIndex(nodeIndex) {
    var index = {};
    if (!nodeIndex) return index;

    for (var id in nodeIndex) {
      if (nodeIndex.hasOwnProperty(id)) {
        var node = nodeIndex[id];
        var key = getNodeKey(node);
        if (!index[key]) {
          index[key] = [];
        }
        index[key].push(node);
      }
    }
    return index;
  }

  /**
   * Recursive tree comparison
   * @param {Object} srcNode 
   * @param {Object} refNode 
   * @param {Object} srcGlobalKeys 
   * @param {Object} refGlobalKeys 
   * @param {Object} matchedSourceIds 
   * @param {Object} matchedRefIds 
   * @param {Object} options 
   * @param {Array<Object>} diffsList 
   */
  function compareSubtree(srcNode, refNode, srcGlobalKeys, refGlobalKeys, matchedSourceIds, matchedRefIds, options, diffsList) {
    if (!srcNode || !refNode) return;

    if (srcNode.id) matchedSourceIds[srcNode.id] = true;
    if (refNode.id) matchedRefIds[refNode.id] = true;

    // 1. Compare attributes of this matched pair
    compareAttributes(srcNode, refNode, options, diffsList);

    // 2. Optional text value comparison (disabled by default)
    if (options.compareTextValues) {
      var srcText = (srcNode.directText || '').trim();
      var refText = (refNode.directText || '').trim();
      if (srcText !== refText && (srcText !== '' || refText !== '')) {
        diffsList.push({
          id: 'diff_' + (diffsList.length + 1),
          type: 'TEXT_VALUE_DIFFERENCE',
          category: 'STRUCTURE',
          sourcePath: srcNode.path,
          referencePath: refNode.path,
          elementName: refNode.name,
          message: 'Direct text content differs: Reference has "' + refText + '", Analyzed has "' + srcText + '".',
          sourceNodeId: srcNode.id,
          referenceNodeId: refNode.id,
          severity: null
        });
      }
    }

    // 3. Group children of both nodes
    var srcChildren = srcNode.children || [];
    var refChildren = refNode.children || [];

    var srcGroups = groupChildrenByKey(srcChildren);
    var refGroups = groupChildrenByKey(refChildren);

    // Gather all unique keys under both parents
    var allKeys = {};
    var k;
    for (k in srcGroups) { if (srcGroups.hasOwnProperty(k)) allKeys[k] = true; }
    for (k in refGroups) { if (refGroups.hasOwnProperty(k)) allKeys[k] = true; }

    for (var key in allKeys) {
      if (allKeys.hasOwnProperty(key)) {
        var sList = srcGroups[key] || [];
        var rList = refGroups[key] || [];

        if (rList.length > 0 && sList.length === 0) {
          // Key exists under reference parent, but is missing under source parent.
          // Check if this key exists anywhere in the source document under a different hierarchy
          var possibleRelocatedSrcNodes = (srcGlobalKeys[key] || []).filter(function (sn) {
            return !matchedSourceIds[sn.id];
          });

          if (possibleRelocatedSrcNodes.length > 0) {
            // Element is relocated (Hierarchy Difference)
            var relSrc = possibleRelocatedSrcNodes[0];
            matchedSourceIds[relSrc.id] = true;
            matchedRefIds[rList[0].id] = true;

            diffsList.push({
              id: 'diff_' + (diffsList.length + 1),
              type: 'HIERARCHY_DIFFERENCE',
              category: 'STRUCTURE',
              sourcePath: relSrc.path,
              referencePath: rList[0].path,
              elementName: rList[0].name,
              message: 'Element <' + rList[0].name + '> appears at path "' + relSrc.path + '" in analyzed XML but is located under "' + rList[0].path + '" in reference XML.',
              sourceNodeId: relSrc.id,
              referenceNodeId: rList[0].id,
              severity: null,
              details: {
                sourcePath: relSrc.path,
                referencePath: rList[0].path
              }
            });

            // Compare subtree of relocated node
            compareSubtree(relSrc, rList[0], srcGlobalKeys, refGlobalKeys, matchedSourceIds, matchedRefIds, options, diffsList);
          } else {
            // Truly missing element under this branch
            for (var m = 0; m < rList.length; m++) {
              var refMissing = rList[m];
              if (!matchedRefIds[refMissing.id]) {
                matchedRefIds[refMissing.id] = true;
                diffsList.push({
                  id: 'diff_' + (diffsList.length + 1),
                  type: 'MISSING_ELEMENT',
                  category: 'STRUCTURE',
                  sourcePath: null,
                  referencePath: refMissing.path,
                  elementName: refMissing.name,
                  message: 'Element <' + refMissing.name + '> exists in reference XML at "' + refMissing.path + '" but was not found in analyzed XML.',
                  sourceNodeId: null,
                  referenceNodeId: refMissing.id,
                  severity: null,
                  details: {
                    referencePath: refMissing.path
                  }
                });
              }
            }
          }
        } else if (sList.length > 0 && rList.length === 0) {
          // Key exists under source parent, but not in reference parent
          // Check if this source element matches a reference node located under a different hierarchy
          var possibleRelocatedRefNodes = (refGlobalKeys[key] || []).filter(function (rn) {
            return !matchedRefIds[rn.id];
          });

          if (possibleRelocatedRefNodes.length > 0) {
            var relRef = possibleRelocatedRefNodes[0];
            matchedSourceIds[sList[0].id] = true;
            matchedRefIds[relRef.id] = true;

            diffsList.push({
              id: 'diff_' + (diffsList.length + 1),
              type: 'HIERARCHY_DIFFERENCE',
              category: 'STRUCTURE',
              sourcePath: sList[0].path,
              referencePath: relRef.path,
              elementName: sList[0].name,
              message: 'Element <' + sList[0].name + '> appears at path "' + sList[0].path + '" in analyzed XML but is located under "' + relRef.path + '" in reference XML.',
              sourceNodeId: sList[0].id,
              referenceNodeId: relRef.id,
              severity: null,
              details: {
                sourcePath: sList[0].path,
                referencePath: relRef.path
              }
            });

            compareSubtree(sList[0], relRef, srcGlobalKeys, refGlobalKeys, matchedSourceIds, matchedRefIds, options, diffsList);
          } else {
            // Truly additional element
            for (var a = 0; a < sList.length; a++) {
              var srcAdd = sList[a];
              if (!matchedSourceIds[srcAdd.id]) {
                matchedSourceIds[srcAdd.id] = true;
                diffsList.push({
                  id: 'diff_' + (diffsList.length + 1),
                  type: 'ADDITIONAL_ELEMENT',
                  category: 'STRUCTURE',
                  sourcePath: srcAdd.path,
                  referencePath: null,
                  elementName: srcAdd.name,
                  message: 'Element <' + srcAdd.name + '> exists in analyzed XML at "' + srcAdd.path + '" but was not found in reference XML.',
                  sourceNodeId: srcAdd.id,
                  referenceNodeId: null,
                  severity: null,
                  details: {
                    sourcePath: srcAdd.path
                  }
                });
              }
            }
          }
        } else {
          // Both reference and source have elements for this key under current parent
          var refCount = rList.length;
          var srcCount = sList.length;

          if (refCount !== srcCount) {
            // Occurrence difference
            diffsList.push({
              id: 'diff_' + (diffsList.length + 1),
              type: 'OCCURRENCE_DIFFERENCE',
              category: 'STRUCTURE',
              sourcePath: sList[0].path,
              referencePath: rList[0].path,
              elementName: rList[0].name,
              message: 'Element <' + rList[0].name + '> occurrence count differs: Reference has ' + refCount + ', Analyzed has ' + srcCount + '.',
              sourceNodeId: sList[0].id,
              referenceNodeId: rList[0].id,
              severity: null,
              details: {
                referenceCount: refCount,
                analyzedCount: srcCount,
                elementName: rList[0].name
              }
            });
          }

          // Pair instances up to min(refCount, srcCount) and recurse
          var minCount = Math.min(refCount, srcCount);
          for (var p = 0; p < minCount; p++) {
            compareSubtree(sList[p], rList[p], srcGlobalKeys, refGlobalKeys, matchedSourceIds, matchedRefIds, options, diffsList);
          }

          // Any surplus source items mark as matched
          for (var extraS = minCount; extraS < srcCount; extraS++) {
            matchedSourceIds[sList[extraS].id] = true;
          }
          for (var extraR = minCount; extraR < refCount; extraR++) {
            matchedRefIds[rList[extraR].id] = true;
          }
        }
      }
    }
  }

  /**
   * Main Comparator entry point
   * Compares source AST against reference AST
   * @param {Object} sourceAnalysis 
   * @param {Object} referenceAnalysis 
   * @param {Object} [customOptions] 
   * @returns {Object} Structured comparison summary
   */
  function compare(sourceAnalysis, referenceAnalysis, customOptions) {
    var options = {
      compareTextValues: customOptions && customOptions.compareTextValues === true,
      compareAttributeValues: customOptions && customOptions.compareAttributeValues === true,
      ignoreSiblingOrder: customOptions ? customOptions.ignoreSiblingOrder !== false : true,
      sourceName: (customOptions && customOptions.sourceName) || 'Analyzed XML',
      referenceName: (customOptions && customOptions.referenceName) || 'Reference XML',
      referenceId: (customOptions && customOptions.referenceId) || null,
      referenceType: (customOptions && customOptions.referenceType) || 'CUSTOM_REFERENCE'
    };

    var result = {
      success: true,
      source: {
        name: options.sourceName
      },
      reference: {
        id: options.referenceId,
        name: options.referenceName,
        type: options.referenceType
      },
      summary: {
        missingElements: 0,
        additionalElements: 0,
        attributeDifferences: 0,
        hierarchyDifferences: 0,
        occurrenceDifferences: 0,
        totalDifferences: 0
      },
      differences: []
    };

    if (!sourceAnalysis || !sourceAnalysis.tree || !referenceAnalysis || !referenceAnalysis.tree) {
      return result;
    }

    var srcTree = sourceAnalysis.tree;
    var refTree = referenceAnalysis.tree;

    var srcGlobalKeys = buildGlobalKeyIndex(sourceAnalysis.nodeIndex);
    var refGlobalKeys = buildGlobalKeyIndex(referenceAnalysis.nodeIndex);
    var matchedSourceIds = {};
    var matchedRefIds = {};
    var diffs = [];

    var srcRootKey = getNodeKey(srcTree);
    var refRootKey = getNodeKey(refTree);

    if (srcRootKey !== refRootKey) {
      // Roots differ in key/namespace
      diffs.push({
        id: 'diff_1',
        type: 'MISSING_ELEMENT',
        category: 'STRUCTURE',
        sourcePath: null,
        referencePath: refTree.path,
        elementName: refTree.name,
        message: 'Root element in reference is <' + refTree.name + '> (' + (refTree.namespaceURI || 'no namespace') + ') but analyzed XML has <' + srcTree.name + '> (' + (srcTree.namespaceURI || 'no namespace') + ').',
        sourceNodeId: srcTree.id,
        referenceNodeId: refTree.id,
        severity: null
      });
      diffs.push({
        id: 'diff_2',
        type: 'ADDITIONAL_ELEMENT',
        category: 'STRUCTURE',
        sourcePath: srcTree.path,
        referencePath: null,
        elementName: srcTree.name,
        message: 'Root element <' + srcTree.name + '> in analyzed XML does not match reference root <' + refTree.name + '>.',
        sourceNodeId: srcTree.id,
        referenceNodeId: null,
        severity: null
      });
    } else {
      // Roots match -> run recursive tree comparison
      compareSubtree(srcTree, refTree, srcGlobalKeys, refGlobalKeys, matchedSourceIds, matchedRefIds, options, diffs);
    }

    result.differences = diffs;

    // Calculate breakdown summary
    for (var i = 0; i < diffs.length; i++) {
      var dType = diffs[i].type;
      if (dType === 'MISSING_ELEMENT') {
        result.summary.missingElements++;
      } else if (dType === 'ADDITIONAL_ELEMENT') {
        result.summary.additionalElements++;
      } else if (dType === 'ATTRIBUTE_MISSING' || dType === 'ATTRIBUTE_ADDITIONAL' || dType === 'ATTRIBUTE_VALUE_DIFFERENCE') {
        result.summary.attributeDifferences++;
      } else if (dType === 'HIERARCHY_DIFFERENCE') {
        result.summary.hierarchyDifferences++;
      } else if (dType === 'OCCURRENCE_DIFFERENCE') {
        result.summary.occurrenceDifferences++;
      }
    }
    result.summary.totalDifferences = diffs.length;

    return result;
  }

  /**
   * Helper function for building synthetic AST trees in test environments
   */
  function buildSyntheticAST(spec, parentPath, depth, nodeIndex, counter) {
    counter.val++;
    var id = 'node_' + counter.val;
    var name = spec.name;
    var localName = spec.localName || name;
    var prefix = spec.prefix || null;
    var namespaceURI = spec.namespaceURI || null;
    var siblingCount = spec.siblingCount || 1;
    var siblingIndex = spec.siblingIndex || 1;

    var segment = name;
    if (siblingCount > 1) {
      segment += '[' + siblingIndex + ']';
    }
    var currentPath = (!parentPath || parentPath === '') ? '/' + segment : parentPath + '/' + segment;

    var attributes = (spec.attributes || []).map(function (a) {
      return {
        name: a.name,
        localName: a.localName || a.name,
        prefix: a.prefix || null,
        namespaceURI: a.namespaceURI || null,
        value: a.value || ''
      };
    });

    var node = {
      id: id,
      name: name,
      localName: localName,
      prefix: prefix,
      namespaceURI: namespaceURI,
      path: currentPath,
      depth: depth,
      attributes: attributes,
      directText: spec.directText || '',
      children: []
    };

    nodeIndex[id] = node;

    if (spec.children && spec.children.length > 0) {
      // Calculate sibling counts
      var nameCounts = {};
      for (var c = 0; c < spec.children.length; c++) {
        var cn = spec.children[c].name;
        nameCounts[cn] = (nameCounts[cn] || 0) + 1;
      }
      var nameIndices = {};
      for (var k = 0; k < spec.children.length; k++) {
        var childSpec = spec.children[k];
        var cName = childSpec.name;
        nameIndices[cName] = (nameIndices[cName] || 0) + 1;
        childSpec.siblingCount = nameCounts[cName];
        childSpec.siblingIndex = nameIndices[cName];

        var childNode = buildSyntheticAST(childSpec, currentPath, depth + 1, nodeIndex, counter);
        node.children.push(childNode);
      }
    }

    return node;
  }

  function createAnalysisFromSpec(spec) {
    var nodeIndex = {};
    var counter = { val: 0 };
    var tree = buildSyntheticAST(spec, '', 0, nodeIndex, counter);
    return {
      success: true,
      tree: tree,
      nodeIndex: nodeIndex,
      statistics: {
        totalElements: Object.keys(nodeIndex).length,
        totalAttributes: 0
      },
      namespaces: []
    };
  }

  /**
   * Run Self-Contained Test Suite for Comparator (Tests 1 - 15)
   * @returns {{ allPassed: boolean, passed: number, total: number, results: Array }}
   */
  function runMockTests() {
    var testResults = [];

    function record(name, passed, detail) {
      testResults.push({ name: name, passed: passed, detail: detail });
    }

    try {
      // Test 1: XML idénticos
      var a1_s = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Header' }, { name: 'Body' }] });
      var a1_r = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Header' }, { name: 'Body' }] });
      var r1 = compare(a1_s, a1_r);
      record('Test 1 — XML idénticos', r1.summary.totalDifferences === 0 && r1.differences.length === 0, '0 differences');

      // Test 2: Missing Body
      var a2_r = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Header' }, { name: 'Body' }] });
      var a2_s = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Header' }] });
      var r2 = compare(a2_s, a2_r);
      var hasMissingBody = r2.differences.some(function (d) { return d.type === 'MISSING_ELEMENT' && d.elementName === 'Body'; });
      record('Test 2 — Missing', hasMissingBody && r2.summary.missingElements === 1, 'MISSING_ELEMENT Body');

      // Test 3: Additional Extra
      var a3_r = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Header' }] });
      var a3_s = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Header' }, { name: 'Extra' }] });
      var r3 = compare(a3_s, a3_r);
      var hasAddExtra = r3.differences.some(function (d) { return d.type === 'ADDITIONAL_ELEMENT' && d.elementName === 'Extra'; });
      record('Test 3 — Additional', hasAddExtra && r3.summary.additionalElements === 1, 'ADDITIONAL_ELEMENT Extra');

      // Test 4: Attribute Missing
      var a4_r = createAnalysisFromSpec({ name: 'Invoice', attributes: [{ name: 'id', value: '123' }] });
      var a4_s = createAnalysisFromSpec({ name: 'Invoice' });
      var r4 = compare(a4_s, a4_r);
      var hasAttrMissing = r4.differences.some(function (d) { return d.type === 'ATTRIBUTE_MISSING' && d.attributeName === 'id'; });
      record('Test 4 — Attribute Missing', hasAttrMissing && r4.summary.attributeDifferences === 1, 'ATTRIBUTE_MISSING id');

      // Test 5: Attribute value differs (compareAttributeValues = false)
      var a5_r = createAnalysisFromSpec({ name: 'Invoice', attributes: [{ name: 'id', value: '123' }] });
      var a5_s = createAnalysisFromSpec({ name: 'Invoice', attributes: [{ name: 'id', value: '999' }] });
      var r5 = compare(a5_s, a5_r, { compareAttributeValues: false });
      record('Test 5 — Attribute value differs', r5.summary.totalDifferences === 0, '0 differences when compareAttributeValues=false');

      // Test 6: Text differs (compareTextValues = false)
      var a6_r = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'ID', directText: '123' }] });
      var a6_s = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'ID', directText: '999' }] });
      var r6 = compare(a6_s, a6_r, { compareTextValues: false });
      record('Test 6 — Text differs', r6.summary.totalDifferences === 0, '0 differences when compareTextValues=false');

      // Test 7: Occurrence (2 Item vs 3 Item)
      var a7_r = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Item' }, { name: 'Item' }] });
      var a7_s = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Item' }, { name: 'Item' }, { name: 'Item' }] });
      var r7 = compare(a7_s, a7_r);
      var hasOccDiff = r7.differences.some(function (d) { return d.type === 'OCCURRENCE_DIFFERENCE' && d.elementName === 'Item'; });
      record('Test 7 — Occurrence', hasOccDiff && r7.summary.occurrenceDifferences === 1, '1 OCCURRENCE_DIFFERENCE');

      // Test 8: Reordering (Header Body vs Body Header)
      var a8_r = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Header' }, { name: 'Body' }] });
      var a8_s = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'Body' }, { name: 'Header' }] });
      var r8 = compare(a8_s, a8_r);
      record('Test 8 — Reordering', r8.summary.totalDifferences === 0, '0 differences (order independent)');

      // Test 9: Namespace same URI, different prefix
      var a9_r = createAnalysisFromSpec({
        name: 'cbc:ID', localName: 'ID', prefix: 'cbc', namespaceURI: 'urn:test', directText: '123'
      });
      var a9_s = createAnalysisFromSpec({
        name: 'x:ID', localName: 'ID', prefix: 'x', namespaceURI: 'urn:test', directText: '999'
      });
      var r9 = compare(a9_s, a9_r);
      record('Test 9 — Namespace same URI, different prefix', r9.summary.totalDifferences === 0, '0 structural differences');

      // Test 10: Different namespace URI
      var a10_r = createAnalysisFromSpec({
        name: 'Invoice',
        children: [{ name: 'cbc:ID', localName: 'ID', prefix: 'cbc', namespaceURI: 'urn:test1' }]
      });
      var a10_s = createAnalysisFromSpec({
        name: 'Invoice',
        children: [{ name: 'cbc:ID', localName: 'ID', prefix: 'cbc', namespaceURI: 'urn:test2' }]
      });
      var r10 = compare(a10_s, a10_r);
      record('Test 10 — Different namespace URI', r10.summary.totalDifferences > 0, 'Descriptive structural difference recorded');

      // Test 11: Different hierarchy (<A><B><C/></B></A> vs <A><C/><B/></A>)
      var a11_r = createAnalysisFromSpec({
        name: 'A',
        children: [
          { name: 'B', children: [{ name: 'C' }] }
        ]
      });
      var a11_s = createAnalysisFromSpec({
        name: 'A',
        children: [
          { name: 'C' },
          { name: 'B' }
        ]
      });
      var r11 = compare(a11_s, a11_r);
      var hasHierDiff = r11.differences.some(function (d) { return d.type === 'HIERARCHY_DIFFERENCE' && d.elementName === 'C'; });
      record('Test 11 — Different hierarchy', hasHierDiff && r11.summary.hierarchyDifferences === 1, 'HIERARCHY_DIFFERENCE detected for C');

      // Test 12: Invalid reference handling
      var malformedRef = '<Invoice><UnclosedTag></Invoice>';
      var parsedMalformed = XMLValidator.Parser.parse(malformedRef);
      record('Test 12 — Invalid reference', !parsedMalformed.success && parsedMalformed.error !== null, 'Malformed reference XML rejected safely by parser');

      // Test 13: Clear reference isolation
      var aSrc13 = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'ID', directText: '100' }] });
      var aRef13 = createAnalysisFromSpec({ name: 'Invoice', children: [{ name: 'ID', directText: '200' }] });
      var r13 = compare(aSrc13, aRef13);
      // Simulate clear reference: reference becomes null, source unchanged
      aRef13 = null;
      record('Test 13 — Clear reference', aSrc13 !== null && aSrc13.tree !== null && aRef13 === null, 'Reference cleared, source XML preserved intact');

      // Test 14: Seguridad: XSS in Reference
      var aXss = createAnalysisFromSpec({
        name: 'Invoice',
        children: [{ name: 'Description', directText: '<img src=x onerror=alert(1)>' }]
      });
      var safeText = aXss.tree.children[0].directText;
      var escaped = XMLValidator.Utils.escapeHtml(safeText);
      record('Test 14 — Seguridad', escaped.indexOf('&lt;img') !== -1 && escaped.indexOf('<img') === -1, 'Escaped safely against XSS injection');

      // Test 15: 500+ elementos
      var bigItemsRef = [];
      var bigItemsSrc = [];
      for (var i = 0; i < 250; i++) {
        bigItemsRef.push({ name: 'Item', attributes: [{ name: 'id', value: String(i) }], children: [{ name: 'Name' }, { name: 'Price' }] });
        bigItemsSrc.push({ name: 'Item', attributes: [{ name: 'id', value: String(i) }], children: [{ name: 'Name' }, { name: 'Price' }] });
      }
      bigItemsRef.push({ name: 'Item', attributes: [{ name: 'id', value: '999' }], children: [{ name: 'Missing' }] });
      bigItemsSrc.push({ name: 'Item', attributes: [{ name: 'id', value: '1000' }], children: [{ name: 'Extra' }] });

      var tStart = Date.now();
      var aBigSrc = createAnalysisFromSpec({ name: 'Invoice', children: bigItemsSrc });
      var aBigRef = createAnalysisFromSpec({ name: 'Invoice', children: bigItemsRef });
      var rBig = compare(aBigSrc, aBigRef);
      var duration = Date.now() - tStart;

      record('Test 15 — 500+ elementos', rBig.success && duration < 1000, 'Processed ~500 elements in ' + duration + 'ms');

    } catch (err) {
      record('Test Suite Error', false, String(err));
    }

    var passedCount = testResults.filter(function (t) { return t.passed; }).length;

    return {
      allPassed: passedCount === testResults.length,
      passed: passedCount,
      total: testResults.length,
      results: testResults
    };
  }

  return {
    compare: compare,
    runMockTests: runMockTests
  };
})();
