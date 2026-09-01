/**
 * XML Invoice Validator - XML Formatter Module
 * 
 * Safe non-destructive indentation and formatting.
 * Implementation will be integrated in subsequent phases.
 */
/**
 * XML Invoice Validator - XML Formatter Module
 * 
 * Safe, non-destructive indentation and formatting.
 * Preserves XML declarations, comments, CDATA blocks, attributes, and text values.
 * Only formats syntactically valid XML.
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.Formatter = (function () {
  'use strict';

  /**
   * Safely format XML text with 2-space indentation
   * Only executes if the document is syntactically valid.
   * 
   * @param {string} xmlText 
   * @returns {{ success: boolean, formattedXml: string|null, error: string|null }}
   */
  function format(xmlText) {
    if (!xmlText || xmlText.trim() === '') {
      return {
        success: false,
        formattedXml: null,
        error: 'Cannot format empty content.'
      };
    }

    // 1. Verify XML syntax with Parser first
    var parseResult = XMLValidator.Parser.parse(xmlText);
    if (!parseResult.success) {
      return {
        success: false,
        formattedXml: null,
        error: 'Cannot format malformed XML. Validate or correct the XML syntax before formatting.'
      };
    }

    try {
      var formatted = formatTokens(xmlText);
      return {
        success: true,
        formattedXml: formatted,
        error: null
      };
    } catch (e) {
      return {
        success: false,
        formattedXml: null,
        error: 'Formatting failed: ' + (e && e.message ? e.message : String(e))
      };
    }
  }

  /**
   * Tokenize and indent XML while protecting CDATA, Comments, and Declarations
   * @param {string} xml 
   * @returns {string}
   */
  function formatTokens(xml) {
    var cdataBlocks = [];
    var commentBlocks = [];

    // Step 1: Stash CDATA blocks to preserve internal formatting exactly
    var placeholderXml = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, function (match) {
      var token = '___CDATA_TOKEN_' + cdataBlocks.length + '___';
      cdataBlocks.push(match);
      return token;
    });

    // Step 2: Stash XML Comments
    placeholderXml = placeholderXml.replace(/<!--[\s\S]*?-->/g, function (match) {
      var token = '___COMMENT_TOKEN_' + commentBlocks.length + '___';
      commentBlocks.push(match);
      return token;
    });

    // Step 3: Normalize whitespace around tags
    // Separate tags onto new lines while preserving inner tag text
    var reg = /(>)(<)(\/*)/g;
    var rawFormatted = placeholderXml.replace(reg, '$1\r\n$2$3');
    var lines = rawFormatted.split(/\r\n|\r|\n/);
    var indentLevel = 0;
    var indentStr = '  '; // 2 spaces
    var outputLines = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      // Check if line is closing tag: </tag>
      if (line.match(/^<\//)) {
        if (indentLevel > 0) indentLevel--;
        outputLines.push(repeatStr(indentStr, indentLevel) + line);
      }
      // Check if line has both opening and closing tag: <tag>text</tag> or <tag attr="val">text</tag>
      else if (line.match(/^<[^!?/][^>]*>[^<]+<\/[^>]+>$/)) {
        outputLines.push(repeatStr(indentStr, indentLevel) + line);
      }
      // Check if line is self-closing tag: <tag/> or <tag attr="val" />
      else if (line.match(/^<[^>]*\/>/)) {
        outputLines.push(repeatStr(indentStr, indentLevel) + line);
      }
      // Check if line is XML declaration or Processing instruction: <?xml ... ?>
      else if (line.match(/^<\?[\s\S]*\?>$/) || line.match(/^<!DOCTYPE[\s\S]*>$/i)) {
        outputLines.push(repeatStr(indentStr, indentLevel) + line);
      }
      // Check if line is opening tag: <tag> or <tag attr="val">
      else if (line.match(/^<[^!?/][^>]*>$/)) {
        outputLines.push(repeatStr(indentStr, indentLevel) + line);
        indentLevel++;
      }
      // Generic line (text or placeholder)
      else {
        outputLines.push(repeatStr(indentStr, indentLevel) + line);
      }
    }

    var result = outputLines.join('\n');

    // Step 4: Restore Comment blocks
    result = result.replace(/___COMMENT_TOKEN_(\d+)___/g, function (_, idx) {
      return commentBlocks[parseInt(idx, 10)] || '';
    });

    // Step 5: Restore CDATA blocks
    result = result.replace(/___CDATA_TOKEN_(\d+)___/g, function (_, idx) {
      return cdataBlocks[parseInt(idx, 10)] || '';
    });

    return result;
  }

  function repeatStr(str, count) {
    var res = '';
    for (var i = 0; i < count; i++) {
      res += str;
    }
    return res;
  }

  return {
    format: format
  };
})();

