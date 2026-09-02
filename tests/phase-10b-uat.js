(async function () {
  'use strict';
  var results = [];
  function assert(v, m) { if (!v) throw new Error(m); }
  async function record(name, fn) { try { await fn(); results.push({ name: name, passed: true }); } catch (e) { results.push({ name: name, passed: false, detail: e.message || String(e) }); } }
  function wait() { return new Promise(function (resolve) { setTimeout(resolve, 0); }); }
  var frame = document.getElementById('production_app');
  await new Promise(function (resolve) { frame.addEventListener('load', resolve, { once: true }); });
  var manifest = await fetch('sample-payloads/manifest.json').then(function (r) { return r.json(); });
  var app = frame.contentWindow, doc = frame.contentDocument;
  var requiredDetails = ['Document Type','Purpose','Invoice ID','Invoice Date','Currency','Supplier Identity','Buyer Identity','Shared Secret','Backing Observed','Order References','Contract References','Line Count','Standard Line Count','Service Line Count','Tax Profile','Payment Terms','Extrinsics','Requester','MatchReference'];
  for (var i = 0; i < manifest.length; i++) {
    var entry = manifest[i];
    var source = await fetch('sample-payloads/' + entry.filename).then(function (r) { return r.text(); });
    await record(entry.id + ' production-interface acceptance', async function () {
      var editor = doc.getElementById('xml_editor_textarea');
      editor.value = source; editor.dispatchEvent(new Event('input', { bubbles: true }));
      doc.getElementById('btn_validate').click(); await wait();
      var validationText = doc.getElementById('tab_pane_validation').textContent;
      if (entry.expectedSyntaxStatus === 'ERROR') {
        assert(validationText.indexOf('XML is not well-formed') >= 0, 'Malformed syntax summary missing');
        assert(validationText.indexOf('Not evaluated') >= 0, 'Structural not-evaluated state missing');
        assert(doc.getElementById('tab_pane_details').textContent.indexOf('InvoiceDetailRequest') < 0, 'Malformed document received classifications');
      } else {
        assert(validationText.indexOf('XML Syntax: Well-formed') >= 0, 'Syntax success missing');
        entry.expectedRuleIds.forEach(function (id) { assert(validationText.indexOf(id) >= 0, 'Expected finding missing: ' + id); });
        if (entry.intentionallyValid) assert(validationText.indexOf('No supported structural issues') >= 0, 'Concise success state missing');
        doc.getElementById('tab_btn_details').click();
        var detailText = doc.getElementById('tab_pane_details').textContent.toLowerCase();
        requiredDetails.forEach(function (label) { assert(detailText.indexOf(label.toLowerCase()) >= 0, 'Invoice Details missing ' + label); });
        doc.getElementById('tab_btn_validation').click();
        var viewButton = doc.querySelector('.finding-btn-view-node');
        if (viewButton) {
          viewButton.click();
          assert(doc.getElementById('tab_btn_tree').classList.contains('active'), 'View in Tree did not switch tabs');
          assert(doc.querySelector('.tree-node-row.selected-node'), 'View in Tree did not highlight the finding node');
        }
      }
      var safe = Boolean(entry.expectedSafeCorrection);
      assert(Boolean(doc.querySelector('.finding-btn-preview-fix')) === safe, 'Correction control mismatch');
      assert(!doc.body.textContent.match(/Fully Coupa Valid|Guaranteed Coupa Acceptance|100% Compliant/i), 'Overclaim detected');
    });
  }
  await record('Initial, edit, Format, Clear, and button semantics', async function () {
    var source = await fetch('sample-payloads/simple-01-valid-po.xml').then(function (r) { return r.text(); });
    var editor = doc.getElementById('xml_editor_textarea'); editor.value = source; editor.dispatchEvent(new Event('input', { bubbles: true }));
    doc.getElementById('btn_validate').click(); await wait();
    editor.value += ' '; editor.dispatchEvent(new Event('input', { bubbles: true }));
    var editedText = doc.getElementById('tab_pane_validation').textContent;
    assert(editedText.indexOf('NO SUPPORTED ISSUES') < 0 && editedText.indexOf('CXML_') < 0 && !doc.querySelector('.finding-btn-preview-fix'), 'Edited state retained stale results');
    doc.getElementById('btn_format').click(); assert(editor.value.length > 0, 'Format removed XML');
    doc.getElementById('btn_clear').click(); assert(editor.value === '', 'Clear did not empty editor');
    ['btn_load_xml','btn_validate','btn_format','btn_clear'].forEach(function (id) { assert(doc.getElementById(id) && doc.getElementById(id).tagName === 'BUTTON', id + ' is not a button'); });
    assert(doc.querySelectorAll('.tab-button').length === 3, 'Visible tab count changed');
  });
  await record('Responsive containment at desktop and narrow widths', async function () {
    var widths = [1366, 1920, 760];
    for (var w = 0; w < widths.length; w++) {
      frame.style.width = widths[w] + 'px'; await wait();
      assert(doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1, 'Page overflow at ' + widths[w] + 'px');
    }
  });
  await record('Preview, Apply, revalidation, and one-level Undo production workflow', async function () {
    var source = await fetch('sample-payloads/intermediate-03-misplaced-order-info.xml').then(function (r) { return r.text(); });
    var editor = doc.getElementById('xml_editor_textarea'); editor.value = source; editor.dispatchEvent(new Event('input', { bubbles: true }));
    doc.getElementById('btn_validate').click(); await wait();
    var previewButton = doc.querySelector('.finding-btn-preview-fix'); assert(previewButton, 'Preview Fix missing'); previewButton.click(); await wait();
    var preview = doc.querySelector('.finding-fix-preview');
    assert(/Rule ID:/.test(preview.textContent) && /Exact operation:/.test(preview.textContent) && /No business values/.test(preview.textContent), 'Preview is incomplete');
    var applyButton = preview.querySelector('.finding-btn-apply-fix'); assert(applyButton, 'Apply Fix missing after preview'); applyButton.click(); await wait();
    assert(doc.getElementById('tab_pane_validation').textContent.indexOf('CXML_ORDER_001') < 0, 'Finding remained after revalidation');
    assert(editor.value !== source && editor.value.indexOf('INV-TEST-103') >= 0 && editor.value.indexOf('PO-TEST-103') >= 0, 'Correction changed unrelated values');
    assert(doc.body.textContent.indexOf('Correction applied and XML revalidated.') >= 0, 'Apply confirmation missing');
    var undo = Array.prototype.filter.call(doc.querySelectorAll('button'), function (button) { return button.textContent.trim() === 'Undo Last Fix'; })[0];
    assert(undo, 'Undo Last Fix missing'); undo.click(); await wait();
    assert(editor.value === source && doc.getElementById('tab_pane_validation').textContent.indexOf('CXML_ORDER_001') >= 0, 'Undo did not restore exact XML and revalidate');
  });
  await record('Keyboard focus and accessible interaction semantics', function () {
    var buttons = doc.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) assert((buttons[i].textContent || buttons[i].getAttribute('aria-label') || buttons[i].title || '').trim(), 'Unlabelled button');
    assert(doc.querySelectorAll('.tab-button[role="tab"]').length === 3, 'Tab roles missing');
    assert(doc.querySelectorAll('.tab-button[role="tab"] button').length === 0, 'Nested interactive tab control');
    var focusRule = Array.prototype.some.call(doc.styleSheets, function (sheet) { try { return Array.prototype.some.call(sheet.cssRules, function (rule) { return String(rule.selectorText || '').indexOf(':focus-visible') >= 0; }); } catch (e) { return false; } });
    assert(focusRule, 'Visible keyboard focus rule missing');
  });
  var passed = results.filter(function (r) { return r.passed; }).length;
  document.getElementById('suite_status').textContent = passed === results.length ? 'PASS' : 'FAIL';
  document.getElementById('aggregate_output').textContent = passed + '/' + results.length + ' Phase 10B UAT checks passed; ' + results.slice(0, 10).filter(function (r) { return r.passed; }).length + '/10 payloads passed production UI UAT';
  var list = document.getElementById('test_results'); results.forEach(function (r) { var li = document.createElement('li'); li.textContent = (r.passed ? 'PASS — ' : 'FAIL — ') + r.name + (r.detail ? ': ' + r.detail : ''); list.appendChild(li); });
})().catch(function (e) { document.getElementById('suite_status').textContent = 'FAIL'; document.getElementById('aggregate_output').textContent = e.message || String(e); });
