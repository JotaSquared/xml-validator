import { XMLAttributeNode, XMLNeutralNode, XMLStatistics } from '../types';

let nodeIdCounter = 0;

function generateNodeId(): string {
  return `xml_node_${++nodeIdCounter}`;
}

export function resetNodeIdCounter() {
  nodeIdCounter = 0;
}

/**
 * Builds the neutral JavaScript XML tree from a native DOM Element
 */
export function buildNeutralTree(
  element: Element,
  parentPath: string = '',
  depth: number = 0,
  siblingCounts: Map<string, number> = new Map()
): XMLNeutralNode {
  const tagName = element.tagName || element.nodeName;

  // Track sibling counts to assign [1], [2] when there are duplicates
  const currentCount = (siblingCounts.get(tagName) || 0) + 1;
  siblingCounts.set(tagName, currentCount);

  // We will determine final path after knowing if siblings exist or we format uniformly
  const id = generateNodeId();

  // Extract attributes
  const attributes: XMLAttributeNode[] = [];
  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes.push({
        name: attr.name,
        localName: attr.localName || attr.name,
        prefix: attr.prefix || null,
        value: attr.value,
      });
    }
  }

  // Extract direct text content (excluding nested child element texts)
  let directText = '';
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
      directText += child.nodeValue || '';
    }
  }
  directText = directText.trim();

  // Process child elements
  const children: XMLNeutralNode[] = [];
  const childElements: Element[] = [];

  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      childElements.push(child as Element);
    }
  }

  // Count occurrences of each tag among children to know which ones are repeated
  const childTagTotals = new Map<string, number>();
  for (const childEl of childElements) {
    const tag = childEl.tagName || childEl.nodeName;
    childTagTotals.set(tag, (childTagTotals.get(tag) || 0) + 1);
  }

  const childSiblingTracker = new Map<string, number>();
  for (const childEl of childElements) {
    const tag = childEl.tagName || childEl.nodeName;
    const countSoFar = (childSiblingTracker.get(tag) || 0) + 1;
    childSiblingTracker.set(tag, countSoFar);

    const totalWithThisTag = childTagTotals.get(tag) || 1;
    const isDuplicate = totalWithThisTag > 1;

    // Construct child path segment
    const segment = isDuplicate ? `${tag}[${countSoFar}]` : tag;
    const childPath = parentPath === '' ? `/${segment}` : `${parentPath}/${segment}`;

    const childNode = buildNeutralTree(childEl, childPath, depth + 1, new Map());
    childNode.isDuplicateSibling = isDuplicate;
    childNode.siblingIndex = countSoFar;
    childNode.path = childPath;
    children.push(childNode);
  }

  const path = parentPath || `/${tagName}`;

  return {
    id,
    name: tagName,
    localName: element.localName || tagName,
    prefix: element.prefix || null,
    namespaceURI: element.namespaceURI || null,
    path,
    attributes,
    text: directText,
    children,
    childCount: children.length,
    depth,
    isDuplicateSibling: false,
    siblingIndex: 1,
  };
}

/**
 * Calculates comprehensive metrics and statistics from raw text and tree
 */
export function calculateStatistics(
  rawXml: string,
  rootNode: XMLNeutralNode | null
): XMLStatistics {
  const lineCount = rawXml ? rawXml.split(/\r?\n/).length : 0;
  const characterCount = rawXml ? rawXml.length : 0;

  if (!rootNode) {
    return {
      totalElements: 0,
      totalAttributes: 0,
      maxDepth: 0,
      uniqueElementNames: 0,
      repeatedElementCount: 0,
      namespaceCount: 0,
      namespaces: [],
      totalErrors: 0,
      totalWarnings: 0,
      totalInfos: 0,
      characterCount,
      lineCount,
    };
  }

  let totalElements = 0;
  let totalAttributes = 0;
  let maxDepth = 0;
  const elementNamesSet = new Set<string>();
  const namespacesMap = new Map<string, string>();
  let repeatedElementCount = 0;

  function traverse(node: XMLNeutralNode) {
    totalElements++;
    totalAttributes += node.attributes.length;
    maxDepth = Math.max(maxDepth, node.depth);
    elementNamesSet.add(node.name);

    if (node.isDuplicateSibling) {
      repeatedElementCount++;
    }

    if (node.namespaceURI) {
      namespacesMap.set(node.prefix || 'default', node.namespaceURI);
    }

    // Also check xmlns attributes
    for (const attr of node.attributes) {
      if (attr.name === 'xmlns') {
        namespacesMap.set('default', attr.value);
      } else if (attr.name.startsWith('xmlns:')) {
        const pfx = attr.name.substring(6);
        namespacesMap.set(pfx, attr.value);
      }
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(rootNode);

  const namespaces = Array.from(namespacesMap.entries()).map(([prefix, uri]) => ({
    prefix,
    uri,
  }));

  return {
    totalElements,
    totalAttributes,
    maxDepth,
    uniqueElementNames: elementNamesSet.size,
    repeatedElementCount,
    namespaceCount: namespaces.length,
    namespaces,
    totalErrors: 0,
    totalWarnings: 0,
    totalInfos: 0,
    characterCount,
    lineCount,
  };
}

/**
 * Searches for a node by id in the neutral tree
 */
export function findNodeById(root: XMLNeutralNode | null, id: string): XMLNeutralNode | null {
  if (!root) return null;
  if (root.id === id) return root;

  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Searches for nodes matching a query string (tag name, path, attribute, or text)
 */
export function searchTree(root: XMLNeutralNode | null, query: string): XMLNeutralNode[] {
  if (!root || !query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: XMLNeutralNode[] = [];

  function traverse(node: XMLNeutralNode) {
    const matchName = node.name.toLowerCase().includes(q);
    const matchPath = node.path.toLowerCase().includes(q);
    const matchText = node.text.toLowerCase().includes(q);
    const matchAttr = node.attributes.some(
      a => a.name.toLowerCase().includes(q) || a.value.toLowerCase().includes(q)
    );

    if (matchName || matchPath || matchText || matchAttr) {
      results.push(node);
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(root);
  return results;
}
