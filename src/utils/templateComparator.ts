import { StructuralDiffItem, XMLNeutralNode } from '../types';
import { parseXML } from './xmlParser';
import { buildNeutralTree, resetNodeIdCounter } from './xmlAnalyzer';

/**
 * Normalizes an XPath route by stripping specific sibling indices for pattern matching
 * e.g. /cXML/Request/InvoiceDetailRequest/InvoiceDetailOrder/InvoiceDetailItem[2]/UnitPrice
 *   -> /cXML/Request/InvoiceDetailRequest/InvoiceDetailOrder/InvoiceDetailItem/UnitPrice
 */
function normalizePath(path: string): string {
  return path.replace(/\[\d+\]/g, '');
}

/**
 * Extracts a map of normalized paths to sample nodes from a neutral tree
 */
function collectStructureMap(root: XMLNeutralNode): Map<string, { node: XMLNeutralNode; count: number; attrNames: Set<string> }> {
  const map = new Map<string, { node: XMLNeutralNode; count: number; attrNames: Set<string> }>();

  function traverse(node: XMLNeutralNode) {
    const normPath = normalizePath(node.path);
    const existing = map.get(normPath);

    const currentAttrs = new Set(node.attributes.map(a => a.name));

    if (existing) {
      existing.count++;
      currentAttrs.forEach(a => existing.attrNames.add(a));
    } else {
      map.set(normPath, {
        node,
        count: 1,
        attrNames: currentAttrs,
      });
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(root);
  return map;
}

/**
 * Compares an actual document tree against a template XML string
 */
export function compareWithTemplate(
  actualTree: XMLNeutralNode | null,
  templateXml: string
): { diffs: StructuralDiffItem[]; templateTree: XMLNeutralNode | null; error?: string } {
  if (!actualTree) {
    return {
      diffs: [],
      templateTree: null,
      error: 'El documento actual no tiene un árbol XML válido.',
    };
  }

  const parsedTemplate = parseXML(templateXml);
  if (!parsedTemplate.success || !parsedTemplate.xmlDoc) {
    return {
      diffs: [],
      templateTree: null,
      error: 'La plantilla de referencia contiene errores de sintaxis XML y no se pudo parsear.',
    };
  }

  resetNodeIdCounter();
  const templateTree = buildNeutralTree(parsedTemplate.xmlDoc.documentElement);

  const actualMap = collectStructureMap(actualTree);
  const templateMap = collectStructureMap(templateTree);

  const diffs: StructuralDiffItem[] = [];

  // 1. Check for elements present in template but MISSING in actual
  for (const [normPath, templateInfo] of templateMap.entries()) {
    if (!actualMap.has(normPath)) {
      diffs.push({
        type: 'MISSING_ELEMENT',
        severity: 'warning',
        path: normPath,
        elementName: templateInfo.node.name,
        description: `Elemento de referencia <${templateInfo.node.name}> no encontrado en la estructura de la factura actual.`,
        templateValue: templateInfo.node.text ? `Texto de ejemplo: "${templateInfo.node.text}"` : undefined,
      });
    } else {
      // 2. Check for missing attributes on common elements
      const actualInfo = actualMap.get(normPath)!;
      for (const attrName of templateInfo.attrNames) {
        if (!actualInfo.attrNames.has(attrName)) {
          diffs.push({
            type: 'ATTRIBUTE_MISMATCH',
            severity: 'info',
            path: normPath,
            elementName: templateInfo.node.name,
            description: `Atributo "${attrName}" presente en plantilla pero no encontrado en el elemento <${templateInfo.node.name}>.`,
          });
        }
      }
    }
  }

  // 3. Check for EXTRA elements present in actual but not in template (informational)
  for (const [normPath, actualInfo] of actualMap.entries()) {
    if (!templateMap.has(normPath)) {
      diffs.push({
        type: 'EXTRA_ELEMENT',
        severity: 'info',
        path: normPath,
        elementName: actualInfo.node.name,
        description: `Elemento adicional <${actualInfo.node.name}> presente en la factura pero no contemplado en la plantilla de referencia.`,
        actualValue: actualInfo.node.text ? `Valor: "${actualInfo.node.text}"` : undefined,
      });
    }
  }

  return {
    diffs,
    templateTree,
  };
}
