import { ValidationFinding, XMLDeclarationInfo } from '../types';

export interface ParseResult {
  success: boolean;
  xmlDoc: Document | null;
  declaration: XMLDeclarationInfo | null;
  errorFinding: ValidationFinding | null;
}

/**
 * Extracts XML declaration attributes if present at the start of the string
 */
export function extractDeclaration(xmlText: string): XMLDeclarationInfo | null {
  const match = xmlText.match(/^\s*<\?xml\s+([^?]+)\?>/i);
  if (!match) return null;

  const raw = match[0];
  const body = match[1];

  const versionMatch = body.match(/version=["']([^"']+)["']/i);
  const encodingMatch = body.match(/encoding=["']([^"']+)["']/i);
  const standaloneMatch = body.match(/standalone=["']([^"']+)["']/i);

  return {
    raw,
    version: versionMatch ? versionMatch[1] : undefined,
    encoding: encodingMatch ? encodingMatch[1] : undefined,
    standalone: standaloneMatch ? standaloneMatch[1] : undefined,
  };
}

/**
 * Robust cross-browser parsererror detector & extractor
 */
export function extractParserError(
  xmlDoc: Document,
  rawXml: string
): ValidationFinding | null {
  // Check for parsererror element in various namespaces / hierarchies
  const parserErrorElements = xmlDoc.getElementsByTagName('parsererror');
  const isRootError = xmlDoc.documentElement && xmlDoc.documentElement.nodeName.toLowerCase() === 'parsererror';

  if (parserErrorElements.length === 0 && !isRootError) {
    return null;
  }

  const errorNode = isRootError ? xmlDoc.documentElement : parserErrorElements[0];
  const errorText = errorNode.textContent || errorNode.innerHTML || 'Unknown XML parse error';

  let line: number | null = null;
  let column: number | null = null;
  let cleanMessage = errorText.trim();
  let snippet: string | null = null;

  // 1. Chrome / Chromium regex patterns
  // Example: "error on line 5 at column 22: Opening and ending tag mismatch: Credential line 4 and From"
  const chromeMatch = errorText.match(/error on line\s+(\d+)\s+at column\s+(\d+):\s*(.*)/i);
  if (chromeMatch) {
    line = parseInt(chromeMatch[1], 10);
    column = parseInt(chromeMatch[2], 10);
    cleanMessage = chromeMatch[3].trim();
  }

  // 2. Firefox regex patterns
  // Example: "XML Parsing Error: mismatched tag. Expected: </foo>.\nLocation: http://... line 5, column 12:\n..."
  if (!line) {
    const ffMatch = errorText.match(/line\s+(\d+),\s*column\s+(\d+)/i);
    if (ffMatch) {
      line = parseInt(ffMatch[1], 10);
      column = parseInt(ffMatch[2], 10);
    }
  }

  // 3. Fallback generic line extractor
  if (!line) {
    const genericLineMatch = errorText.match(/(?:line|línea)\s*[:#]?\s*(\d+)/i);
    if (genericLineMatch) {
      line = parseInt(genericLineMatch[1], 10);
    }
  }

  // Extract snippet from raw XML around the reported line
  if (line !== null && line > 0) {
    const lines = rawXml.split(/\r?\n/);
    const startIdx = Math.max(0, line - 2);
    const endIdx = Math.min(lines.length, line + 2);
    snippet = lines
      .slice(startIdx, endIdx)
      .map((l, i) => {
        const lineNum = startIdx + i + 1;
        const pointer = lineNum === line ? ' > ' : '   ';
        return `${pointer}${lineNum.toString().padStart(3, ' ')} | ${l}`;
      })
      .join('\n');
  }

  // Translate technical jargon into clear TSE suggestions
  let suggestion = 'Revisa la estructura de apertura y cierre de etiquetas, y la sintaxis general del documento.';
  let title = 'Error de sintaxis XML (Malformed XML)';

  if (/tag mismatch|mismatched tag/i.test(cleanMessage)) {
    title = 'Etiquetas XML no coincidentes o mal cerradas';
    suggestion = 'Verifica que cada etiqueta de apertura tenga su correspondiente etiqueta de cierre en el orden y jerarquía correcta.';
  } else if (/unclosed token|not well-formed/i.test(cleanMessage)) {
    title = 'Token o etiqueta sin cerrar en el XML';
    suggestion = 'Comprueba si faltan caracteres ">" o "</" al final del elemento indicado.';
  } else if (/attribute/i.test(cleanMessage)) {
    title = 'Error en atributos XML';
    suggestion = 'Revisa que todos los atributos tengan comillas dobles válidas y valores asignados.';
  } else if (/entity/i.test(cleanMessage)) {
    title = 'Entidad de caracteres no definida o no escapada';
    suggestion = 'Caracteres especiales como "&" o "<" dentro del texto deben escaparse como &amp; o &lt;.';
  } else if (/duplicate attribute/i.test(cleanMessage)) {
    title = 'Atributo duplicado en elemento XML';
    suggestion = 'Un elemento no puede declarar el mismo atributo más de una vez.';
  }

  return {
    id: 'finding_syntax_parsererror',
    severity: 'error',
    code: 'XML_SYNTAX_001',
    category: 'SYNTAX',
    title,
    message: cleanMessage || 'El documento XML no pudo ser parseado debido a un error de sintaxis.',
    line,
    column,
    snippet,
    suggestion,
    technicalDetails: errorText,
  };
}

/**
 * Main safe XML Parser function
 */
export function parseXML(xmlText: string): ParseResult {
  const trimmed = (xmlText || '').trim();

  if (!trimmed) {
    return {
      success: false,
      xmlDoc: null,
      declaration: null,
      errorFinding: {
        id: 'finding_empty_xml',
        severity: 'error',
        code: 'XML_EMPTY_001',
        category: 'SYNTAX',
        title: 'Documento XML vacío',
        message: 'No se ha proporcionado ningún contenido XML para analizar.',
        suggestion: 'Pega una factura XML en el editor o carga un archivo .xml usando "Load XML".',
      },
    };
  }

  const declaration = extractDeclaration(xmlText);

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

    const parserError = extractParserError(xmlDoc, xmlText);
    if (parserError) {
      return {
        success: false,
        xmlDoc: null,
        declaration,
        errorFinding: parserError,
      };
    }

    return {
      success: true,
      xmlDoc,
      declaration,
      errorFinding: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      xmlDoc: null,
      declaration,
      errorFinding: {
        id: 'finding_parser_exception',
        severity: 'error',
        code: 'XML_PARSER_EXCEPTION',
        category: 'SYSTEM',
        title: 'Fallo crítico del analizador de navegador',
        message: 'El analizador DOMParser del navegador arrojó una excepción inesperada.',
        suggestion: 'Comprueba si el texto contiene caracteres binarios o una codificación no compatible.',
        technicalDetails: errorMsg,
      },
    };
  }
}
