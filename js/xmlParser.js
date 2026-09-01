/**
 * XML Invoice Validator - XML Parser Module
 * 
 * Objective XML syntax parsing, parsererror detection, error extraction,
 * line/column resolution, snippet generation, and metadata extraction.
 * 
 * 100% standalone, zero external dependencies, file:// compatible.
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.Parser = (function () {
  'use strict';

  /**
   * Extract XML declaration information from raw text
   * @param {string} xmlText 
   * @returns {{ hasXmlDeclaration: boolean, declaration: { version: string|null, encoding: string|null, standalone: string|null }|null }}
   */
  function extractXmlDeclaration(xmlText) {
    if (!xmlText) {
      return { hasXmlDeclaration: false, declaration: null };
    }

    // Look for <?xml ... ?> at the start (ignoring leading whitespace and BOM)
    var match = xmlText.match(/^\s*<\?xml\s+([^?]+)\?>/i);
    if (!match) {
      return { hasXmlDeclaration: false, declaration: null };
    }

    var declContent = match[1];
    var versionMatch = declContent.match(/version\s*=\s*["']([^"']+)["']/i);
    var encodingMatch = declContent.match(/encoding\s*=\s*["']([^"']+)["']/i);
    var standaloneMatch = declContent.match(/standalone\s*=\s*["']([^"']+)["']/i);

    return {
      hasXmlDeclaration: true,
      declaration: {
        version: versionMatch ? versionMatch[1] : '1.0',
        encoding: encodingMatch ? encodingMatch[1] : null,
        standalone: standaloneMatch ? standaloneMatch[1] : null
      }
    };
  }

  /**
   * Extract namespaces declared on the root element
   * @param {Element} rootElement 
   * @returns {Array<{ prefix: string|null, uri: string }>}
   */
  function extractRootNamespaces(rootElement) {
    var namespaces = [];
    if (!rootElement || !rootElement.attributes) {
      return namespaces;
    }

    var attrs = rootElement.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      var name = attr.name;
      var value = attr.value;

      if (name === 'xmlns') {
        namespaces.push({
          prefix: null,
          uri: value
        });
      } else if (name.indexOf('xmlns:') === 0) {
        namespaces.push({
          prefix: name.substring(6),
          uri: value
        });
      }
    }

    return namespaces;
  }

  /**
   * Robust detection of DOMParser error in parsed XML document
   * Handles Chromium (Chrome, Edge), Firefox, WebKit, and variations.
   * @param {Document} xmlDoc 
   * @returns {Element|null} The parsererror element if found, or null.
   */
  function detectParserError(xmlDoc) {
    if (!xmlDoc) return null;

    // Check if root element is parsererror
    if (xmlDoc.documentElement) {
      var rootTag = xmlDoc.documentElement.nodeName.toLowerCase();
      if (rootTag === 'parsererror' || rootTag.indexOf('parsererror') !== -1) {
        return xmlDoc.documentElement;
      }

      // Check namespace for Mozilla/Chromium parsererror
      var ns = xmlDoc.documentElement.namespaceURI;
      if (ns && ns.indexOf('parsererror') !== -1) {
        return xmlDoc.documentElement;
      }
    }

    // Check for parsererror inside the document
    var errors = xmlDoc.getElementsByTagName('parsererror');
    if (errors && errors.length > 0) {
      return errors[0];
    }

    // Try querySelector if available
    try {
      if (typeof xmlDoc.querySelector === 'function') {
        var queryError = xmlDoc.querySelector('parsererror');
        if (queryError) return queryError;
      }
    } catch (e) {
      // Ignore querySelector exceptions on edge XML namespaces
    }

    return null;
  }

  /**
   * Extract line and column numbers from parser error text
   * @param {string} errorText 
   * @returns {{ line: number|null, column: number|null }}
   */
  function extractErrorLocation(errorText) {
    if (!errorText || typeof errorText !== 'string') {
      return { line: null, column: null };
    }

    // Pattern 1: Chromium / WebKit (Chrome, Edge) -> "error on line 12 at column 8" or "line 12 at column 8"
    var match1 = errorText.match(/line\s+(\d+)\s+at\s+column\s+(\d+)/i);
    if (match1) {
      return {
        line: parseInt(match1[1], 10),
        column: parseInt(match1[2], 10)
      };
    }

    // Pattern 2: "on line 12" and "column 8" separately
    var lineMatch = errorText.match(/(?:on\s+line|line\s+number|line)\s*[:=]?\s*(\d+)/i);
    var colMatch = errorText.match(/(?:at\s+column|column\s+number|column|col)\s*[:=]?\s*(\d+)/i);

    var line = lineMatch ? parseInt(lineMatch[1], 10) : null;
    var column = colMatch ? parseInt(colMatch[1], 10) : null;

    return {
      line: line && !isNaN(line) && line > 0 ? line : null,
      column: column && !isNaN(column) && column > 0 ? column : null
    };
  }

  /**
   * Generate contextual code snippet around the error line (2 lines before, error line, 2 lines after)
   * @param {string} xmlText 
   * @param {number|null} errorLine 1-indexed line number
   * @returns {{ startLine: number, endLine: number, errorLine: number, lines: Array<{ lineNumber: number, text: string, isError: boolean }> }|null}
   */
  function generateErrorSnippet(xmlText, errorLine) {
    if (!xmlText || !errorLine || typeof errorLine !== 'number' || errorLine < 1) {
      return null;
    }

    var allLines = xmlText.split(/\r\n|\r|\n/);
    var totalLines = allLines.length;

    if (errorLine > totalLines && totalLines > 0) {
      errorLine = totalLines;
    }

    var startLine = Math.max(1, errorLine - 2);
    var endLine = Math.min(totalLines, errorLine + 2);

    var snippetLines = [];
    for (var i = startLine; i <= endLine; i++) {
      snippetLines.push({
        lineNumber: i,
        text: allLines[i - 1] !== undefined ? allLines[i - 1] : '',
        isError: i === errorLine
      });
    }

    return {
      startLine: startLine,
      endLine: endLine,
      errorLine: errorLine,
      lines: snippetLines
    };
  }

  /**
   * Map parser error text to TSE-friendly titles and actionable suggestions
   * @param {string} technicalText 
   * @returns {{ title: string, message: string, suggestion: string }}
   */
  function generateTseFriendlyDiagnostic(technicalText) {
    var text = (technicalText || '').toLowerCase();

    if (text.indexOf('mismatch') !== -1 || text.indexOf('opening and ending tag') !== -1) {
      return {
        title: 'Tag Name Mismatch',
        message: 'The opening tag does not match the closing tag name or nesting structure.',
        suggestion: 'Verify that opening and closing tags match in name and letter casing, and that inner child tags are closed first.'
      };
    }

    if (text.indexOf('premature end') !== -1 || text.indexOf('unclosed') !== -1 || text.indexOf('end of data') !== -1) {
      return {
        title: 'Unclosed Element / Premature End of File',
        message: 'An XML tag was opened but never closed before the document ended.',
        suggestion: 'Check for missing closing tags (e.g. </Invoice>) or elements that should be self-closing (e.g. <Tag/>).'
      };
    }

    if (text.indexOf('attribute') !== -1 || text.indexOf('unquoted') !== -1 || text.indexOf('quote') !== -1) {
      return {
        title: 'Attribute Syntax Error',
        message: 'An attribute has an invalid format or missing quotes.',
        suggestion: 'Ensure all attribute values are enclosed in matching double or single quotes (e.g. name="value").'
      };
    }

    if (text.indexOf('&') !== -1 || text.indexOf('entity') !== -1 || text.indexOf('reference') !== -1) {
      return {
        title: 'Unescaped Character / Entity Error',
        message: 'The document contains raw unescaped characters such as ampersands or angle brackets.',
        suggestion: 'Replace raw "&" with "&amp;", "<" with "&lt;", or place raw content inside a <![CDATA[...]]> section.'
      };
    }

    return {
      title: 'Malformed XML Document',
      message: 'The XML document could not be parsed successfully due to a syntax violation.',
      suggestion: 'Review the XML syntax and structure, especially opening and closing tags near the reported location.'
    };
  }

  /**
   * Main parsing entry point
   * @param {string} xmlText 
   * @returns {{
   *   success: boolean,
   *   document: Document|null,
   *   error: {
   *     code: string,
   *     title: string,
   *     message: string,
   *     line: number|null,
   *     column: number|null,
   *     snippet: Object|null,
   *     suggestion: string,
   *     technicalDetails: string
   *   }|null,
   *   metadata: {
   *     hasXmlDeclaration: boolean,
   *     declaration: { version: string|null, encoding: string|null, standalone: string|null }|null,
   *     root: { name: string, localName: string, prefix: string|null, namespaceURI: string|null }|null,
   *     namespaces: Array<{ prefix: string|null, uri: string }>
   *   }
   * }}
   */
  function parse(xmlText) {
    // 1. Validate input text
    if (typeof xmlText !== 'string' || xmlText.trim() === '') {
      return {
        success: false,
        document: null,
        error: {
          code: 'XML_INPUT_001',
          title: 'Empty XML Content',
          message: 'No XML content was provided to validate.',
          line: null,
          column: null,
          snippet: null,
          suggestion: "Paste XML invoice content into the editor or click 'Load XML' to select an XML file.",
          technicalDetails: 'Input string is empty or contains only whitespace characters.'
        },
        metadata: {
          hasXmlDeclaration: false,
          declaration: null,
          root: null,
          namespaces: []
        }
      };
    }

    // 2. Extract XML Declaration metadata
    var declInfo = extractXmlDeclaration(xmlText);

    try {
      // 3. Execute native DOMParser
      var parser = new DOMParser();
      var xmlDoc = parser.parseFromString(xmlText, 'application/xml');

      // 4. Detect parsererror
      var parserErrorEl = detectParserError(xmlDoc);

      if (parserErrorEl) {
        var rawTechnicalDetails = parserErrorEl.textContent || parserErrorEl.innerText || 'Unknown XML parser error';
        var loc = extractErrorLocation(rawTechnicalDetails);
        var snippet = generateErrorSnippet(xmlText, loc.line);
        var diag = generateTseFriendlyDiagnostic(rawTechnicalDetails);

        return {
          success: false,
          document: null,
          error: {
            code: 'XML_SYNTAX_001',
            title: diag.title,
            message: diag.message,
            line: loc.line,
            column: loc.column,
            snippet: snippet,
            suggestion: diag.suggestion,
            technicalDetails: rawTechnicalDetails.trim()
          },
          metadata: {
            hasXmlDeclaration: declInfo.hasXmlDeclaration,
            declaration: declInfo.declaration,
            root: null,
            namespaces: []
          }
        };
      }

      // 5. Successful parse: extract root and namespace metadata
      var rootEl = xmlDoc.documentElement;
      var rootInfo = null;
      var namespaces = [];

      if (rootEl) {
        rootInfo = {
          name: rootEl.nodeName,
          localName: rootEl.localName || rootEl.nodeName,
          prefix: rootEl.prefix || null,
          namespaceURI: rootEl.namespaceURI || null
        };
        namespaces = extractRootNamespaces(rootEl);
      }

      return {
        success: true,
        document: xmlDoc,
        error: null,
        metadata: {
          hasXmlDeclaration: declInfo.hasXmlDeclaration,
          declaration: declInfo.declaration,
          root: rootInfo,
          namespaces: namespaces
        }
      };

    } catch (e) {
      // 6. Catch any unexpected system/browser exceptions
      var exceptionMessage = e && e.message ? e.message : String(e);
      return {
        success: false,
        document: null,
        error: {
          code: 'XML_SYSTEM_001',
          title: 'Unexpected Parser Failure',
          message: 'An unexpected exception occurred during XML document parsing.',
          line: null,
          column: null,
          snippet: null,
          suggestion: 'Check if the document contains non-printable or corrupted binary characters.',
          technicalDetails: exceptionMessage
        },
        metadata: {
          hasXmlDeclaration: declInfo.hasXmlDeclaration,
          declaration: declInfo.declaration,
          root: null,
          namespaces: []
        }
      };
    }
  }

  return {
    parse: parse,
    extractXmlDeclaration: extractXmlDeclaration,
    extractErrorLocation: extractErrorLocation,
    generateErrorSnippet: generateErrorSnippet,
    detectParserError: detectParserError
  };
})();

