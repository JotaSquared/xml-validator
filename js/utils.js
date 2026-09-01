/**
 * XML Invoice Validator - Utilities Module
 * 
 * General helper functions used across modules.
 * Fully standalone - zero external dependencies.
 */
window.XMLValidator = window.XMLValidator || {};

XMLValidator.Utils = (function () {
  'use strict';

  /**
   * Escape HTML special characters for safe rendering
   * @param {string} str 
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Count lines in a string
   * @param {string} text 
   * @returns {number}
   */
  function countLines(text) {
    if (!text) return 1;
    let count = 1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') count++;
    }
    return count;
  }

  /**
   * Count characters in a string
   * @param {string} text 
   * @returns {number}
   */
  function countCharacters(text) {
    return text ? text.length : 0;
  }

  return {
    escapeHtml: escapeHtml,
    countLines: countLines,
    countCharacters: countCharacters
  };
})();
