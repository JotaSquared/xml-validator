import { ValidationContext, ValidationFinding, ValidationRule, XMLNeutralNode } from '../types';

/**
 * Rule: XML Declaration Check
 */
export const ruleXmlDeclaration: ValidationRule = {
  id: 'rule_xml_declaration',
  name: 'Verificación de Declaración XML',
  description: 'Comprueba si el documento incluye la declaración estándar <?xml version="1.0" encoding="UTF-8"?>',
  category: 'DECLARATION',
  enabled: true,
  validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const trimmed = context.rawXml.trim();

    if (!trimmed.startsWith('<?xml')) {
      findings.push({
        id: 'finding_decl_missing',
        severity: 'info',
        code: 'XML_DECL_001',
        category: 'DECLARATION',
        title: 'Declaración XML no encontrada en cabecera',
        message: 'El documento no comienza con la directiva estándar <?xml version="1.0" encoding="UTF-8"?>.',
        path: '/',
        line: 1,
        suggestion: 'Se recomienda incluir la declaración XML al inicio para especificar versión y codificación UTF-8.',
      });
    } else {
      // Check encoding
      const encodingMatch = trimmed.match(/<\?xml[^>]*encoding=["']([^"']+)["']/i);
      if (!encodingMatch) {
        findings.push({
          id: 'finding_decl_encoding',
          severity: 'info',
          code: 'XML_DECL_002',
          category: 'DECLARATION',
          title: 'Codificación (encoding) no especificada en declaración XML',
          message: 'La declaración XML no especifica el atributo encoding="UTF-8".',
          path: '/',
          line: 1,
          suggestion: 'Añadir encoding="UTF-8" para evitar discrepancias de interpretación de caracteres especiales.',
        });
      }
    }

    return findings;
  },
};

/**
 * Rule: Root Element Check
 */
export const ruleRootElement: ValidationRule = {
  id: 'rule_root_element',
  name: 'Validación de Elemento Raíz',
  description: 'Verifica la existencia y estructura del elemento raíz',
  category: 'STRUCTURE',
  enabled: true,
  validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    if (!context.neutralTree) {
      return findings;
    }

    const root = context.neutralTree;
    if (!root.name) {
      findings.push({
        id: 'finding_root_noname',
        severity: 'error',
        code: 'XML_ROOT_001',
        category: 'STRUCTURE',
        title: 'Elemento raíz sin nombre válido',
        message: 'No se ha detectado una etiqueta de nodo raíz válida en el documento.',
        path: '/',
        suggestion: 'Asegurar que el documento cuente con un elemento contenedor raíz único.',
      });
    }

    return findings;
  },
};

/**
 * Rule: Empty Elements Detection
 */
export const ruleEmptyElements: ValidationRule = {
  id: 'rule_empty_elements',
  name: 'Detección de Elementos Vacíos',
  description: 'Identifica elementos hoja que no contienen texto ni atributos y están vacíos',
  category: 'STRUCTURE',
  enabled: true,
  validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    if (!context.neutralTree) return findings;

    function checkNode(node: XMLNeutralNode) {
      // If no children, no text, and no attributes
      if (node.children.length === 0 && node.text === '' && node.attributes.length === 0) {
        findings.push({
          id: `finding_empty_el_${node.id}`,
          severity: 'warning',
          code: 'XML_EMPTY_NODE',
          category: 'STRUCTURE',
          title: `Elemento vacío detectado: <${node.name}>`,
          message: `El nodo "${node.name}" en la ruta "${node.path}" no contiene ningún valor ni atributos.`,
          path: node.path,
          suggestion: 'Verificar si el sistema emisor omitió el valor requerido o si el elemento debe eliminarse.',
        });
      }

      for (const child of node.children) {
        checkNode(child);
      }
    }

    checkNode(context.neutralTree);
    return findings;
  },
};

/**
 * Rule: Empty Attribute Values
 */
export const ruleEmptyAttributes: ValidationRule = {
  id: 'rule_empty_attributes',
  name: 'Detección de Atributos Vacíos',
  description: 'Detecta atributos definidos con valor en blanco (ej. attr="")',
  category: 'ATTRIBUTE',
  enabled: true,
  validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    if (!context.neutralTree) return findings;

    function checkNode(node: XMLNeutralNode) {
      for (const attr of node.attributes) {
        if (attr.value === '') {
          findings.push({
            id: `finding_empty_attr_${node.id}_${attr.name}`,
            severity: 'warning',
            code: 'XML_ATTR_EMPTY',
            category: 'ATTRIBUTE',
            title: `Atributo vacío "${attr.name}" en <${node.name}>`,
            message: `El atributo "${attr.name}" en el nodo "${node.name}" está vacío (${attr.name}="").`,
            path: node.path,
            suggestion: 'Revisar si el atributo requiere un identificador o valor no vacío.',
          });
        }
      }

      for (const child of node.children) {
        checkNode(child);
      }
    }

    checkNode(context.neutralTree);
    return findings;
  },
};

/**
 * Rule: Namespace Consistency and Unbound Prefixes
 */
export const ruleNamespaceBinding: ValidationRule = {
  id: 'rule_namespace_binding',
  name: 'Consistencia de Namespaces y Prefijos',
  description: 'Verifica que elementos con prefijos (ej. cac:Element) tengan su namespace URI asociado',
  category: 'NAMESPACE',
  enabled: true,
  validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    if (!context.neutralTree) return findings;

    function checkNode(node: XMLNeutralNode) {
      if (node.prefix && !node.namespaceURI) {
        findings.push({
          id: `finding_unbound_prefix_${node.id}`,
          severity: 'error',
          code: 'XML_NS_UNBOUND',
          category: 'NAMESPACE',
          title: `Prefijo sin namespace vinculado: "${node.prefix}"`,
          message: `El elemento <${node.name}> utiliza el prefijo "${node.prefix}:" sin haber declarado xmlns:${node.prefix} en este elemento o en sus ancestros.`,
          path: node.path,
          suggestion: `Declarar el namespace correspondiente añadiendo el atributo xmlns:${node.prefix}="URI_DEL_SCHEMA".`,
        });
      }

      for (const child of node.children) {
        checkNode(child);
      }
    }

    checkNode(context.neutralTree);
    return findings;
  },
};

/**
 * Rule: Suspicious Control Characters
 */
export const ruleSuspiciousCharacters: ValidationRule = {
  id: 'rule_suspicious_characters',
  name: 'Detección de Caracteres de Control Invisibles',
  description: 'Busca caracteres ASCII de control no imprimibles (ej. bytes nulos o escapes) que pueden corromper parsers',
  category: 'SYNTAX',
  enabled: true,
  validate(context: ValidationContext): ValidationFinding[] {
    const findings: ValidationFinding[] = [];
    const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
    const matches = context.rawXml.match(controlCharRegex);

    if (matches && matches.length > 0) {
      findings.push({
        id: 'finding_control_chars',
        severity: 'error',
        code: 'XML_CTRL_CHAR',
        category: 'SYNTAX',
        title: `Se detectaron ${matches.length} caracteres de control no válidos`,
        message: 'El XML contiene caracteres no imprimibles (ASCII 0-31) que causan errores de integración en servidores ERP.',
        suggestion: 'Limpiar caracteres de control o sanitizar la salida del sistema origen.',
      });
    }

    return findings;
  },
};

export const DEFAULT_VALIDATION_RULES: ValidationRule[] = [
  ruleXmlDeclaration,
  ruleRootElement,
  ruleEmptyElements,
  ruleEmptyAttributes,
  ruleNamespaceBinding,
  ruleSuspiciousCharacters,
];
