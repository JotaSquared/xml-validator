/**
 * Formats/indents XML safely without modifying values, comments, or CDATA
 */
export function formatXML(xmlText: string, indentSize: number = 2): { success: boolean; formatted: string; error?: string } {
  if (!xmlText || !xmlText.trim()) {
    return { success: true, formatted: '' };
  }

  const indentStr = ' '.repeat(indentSize);
  let formatted = '';
  let indentLevel = 0;

  // Split XML into tokens by tags, comments, CDATA, declarations
  const reg = /(<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<[^>]+>|[^<]+)/g;
  const tokens = xmlText.match(reg);

  if (!tokens) {
    return { success: true, formatted: xmlText };
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (!token) continue;

    // Comment
    if (token.startsWith('<!--')) {
      formatted += (formatted ? '\n' : '') + indentStr.repeat(indentLevel) + token;
    }
    // CDATA
    else if (token.startsWith('<![CDATA[')) {
      formatted += (formatted ? '\n' : '') + indentStr.repeat(indentLevel) + token;
    }
    // Declaration / Processing Instruction
    else if (token.startsWith('<?')) {
      formatted += (formatted ? '\n' : '') + token;
    }
    // Closing tag </tag>
    else if (token.startsWith('</')) {
      indentLevel = Math.max(0, indentLevel - 1);
      formatted += (formatted ? '\n' : '') + indentStr.repeat(indentLevel) + token;
    }
    // Self-closing tag <tag ... />
    else if (token.startsWith('<') && token.endsWith('/>')) {
      formatted += (formatted ? '\n' : '') + indentStr.repeat(indentLevel) + token;
    }
    // Opening tag <tag ...>
    else if (token.startsWith('<') && !token.startsWith('<!')) {
      // Check if the next token is text and followed immediately by matching closing tag
      const nextToken = tokens[i + 1] ? tokens[i + 1].trim() : '';
      const thirdToken = tokens[i + 2] ? tokens[i + 2].trim() : '';
      const tagNameMatch = token.match(/^<([^\s>]+)/);
      const tagName = tagNameMatch ? tagNameMatch[1] : '';

      if (
        tagName &&
        nextToken &&
        !nextToken.startsWith('<') &&
        thirdToken === `</${tagName}>`
      ) {
        // Keep simple leaf element on single line: <Name>Value</Name>
        formatted += (formatted ? '\n' : '') + indentStr.repeat(indentLevel) + `${token}${nextToken}${thirdToken}`;
        i += 2; // skip next and third
      } else {
        formatted += (formatted ? '\n' : '') + indentStr.repeat(indentLevel) + token;
        indentLevel++;
      }
    }
    // Pure text node
    else {
      formatted += (formatted ? '\n' : '') + indentStr.repeat(indentLevel) + token;
    }
  }

  return { success: true, formatted };
}
