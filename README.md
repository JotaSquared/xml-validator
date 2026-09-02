# XML Invoice Validator

Offline, browser-based inspection of cXML invoices against the evidence-backed structural behavior established through Phase 8B, with Phase 8C scenario detection. The production application is Vanilla JavaScript and can be opened directly from the repository with `file://`; it has no runtime package manager, build step, local server, or AI service dependency.

Passing this validator does not guarantee acceptance by Coupa. Transaction validity can also depend on buyer, supplier, and Coupa-instance configuration. Compliant Invoicing is outside this project's current scope.

## Release candidate baseline

- Production rules: **19**
- Approved references: **17**
- Reference source integrity: **17/17 exact matches**
- Synthetic end-to-end payloads: **10**
- Safe correction operations: **3 operation types**
- Runtime dependencies: **0**
- Runtime network requests: **0**
- Architecture: **HTML, CSS, and Vanilla JavaScript through `file://`**

This baseline describes locally verifiable behavior only. It does not claim
guaranteed Coupa compatibility or acceptance.

## Run the application

1. Clone or copy the repository.
2. Open `index.html` in a modern browser, including by double-clicking it or using a `file://` URL.
3. Paste, drop, or select a cXML file and run validation.

No installation or build command is required. All application assets and the reference catalog are local to the repository.

The visible workspace is organized into three focused views:

- **Validation Results** separates well-formed XML syntax from supported cXML/Coupa invoice-structure checks and presents actionable findings.
- **XML Tree** preserves the interactive document hierarchy and finding-to-node navigation.
- **Invoice Details** presents invoice ID/date, identities, purpose, currency, backing, line and tax profiles, and other safely detected business fields. Sensitive `SharedSecret` values are never displayed.

## Validation architecture

The application keeps three concerns logically separate:

1. **XML syntax validation** — `js/xmlParser.js` uses the browser's `DOMParser` to parse user input and reports malformed XML before structural processing.
2. **cXML/Coupa structural validation** — `js/xmlAnalyzer.js` produces the internal analysis model; `js/ruleEngine.js` executes the registered rules from `js/validationRules.js` and normalizes findings.
3. **Reference comparison** — `js/templateComparator.js` compares the analyzed input with a separately selected reference from the catalog. Comparison results are not structural findings.

Reference-comparison infrastructure remains logically separate but is not exposed in the simplified invoice-focused tab navigation.

`js/app.js` coordinates user input, parsing, analysis, scenario detection, validation, comparison, and rendering. `js/scenarioResolver.js` classifies the already parsed structural invoice into independent purpose, body, line, backing, and tax dimensions; it does not parse XML again or emit validation findings. `js/ui.js` consumes that normalized scenario instead of independently classifying the document. `js/treeRenderer.js` and `js/xmlFormatter.js` handle presentation. `js/templateCatalog.js` exposes the 17 active Coupa references embedded in `data/templates.js` without altering their XML content.

The production structural rule registry contains 19 rules. The Phase 8A baseline rules are:

- `CXML_ENV_001`
- `CXML_ENV_002`
- `CXML_ENV_003`
- `CXML_HEADER_001`
- `CXML_CREDENTIAL_001`
- `CXML_CREDENTIAL_002`
- `COUPA_INV_001`
- `CXML_INV_HEADER_001`
- `CXML_INV_HEADER_002`
- `CXML_INV_HEADER_003`
- `CXML_ORDER_001`

Phase 8B adds:

- `CXML_BODY_001` — rejects simultaneous direct `InvoiceDetailHeaderOrder` and `InvoiceDetailOrder` body modes.
- `CXML_BODY_002` — requires a direct `InvoiceDetailSummary` in the structural invoice request.
- `CXML_ITEM_001` — requires non-empty `invoiceLineNumber` and `quantity` attributes on each detailed item.
- `CXML_ITEM_002` — requires direct `UnitOfMeasure`, `UnitPrice`, and `InvoiceDetailItemReference` children on each detailed item.
- `CXML_SERVICE_001` — requires a non-empty `invoiceLineNumber` on each service item.

Phase 8D adds three evidence-confirmed scenario rules:

- `CXML_SCENARIO_001` — requires header and detailed body modes to agree with `isHeaderInvoice`.
- `CXML_SCENARIO_002` — rejects `isAccountingInLine` when the invoice is structurally a header invoice or declares `isHeaderInvoice="yes"`.
- `CXML_SCENARIO_003` — requires a direct, non-empty header `DocumentReference` when `operation="delete"`.

Phase 9A adds a conservative correction-planning foundation. Findings default
to `NOT_AUTOFIXABLE`; plans are read-only and never invent business values.
Only deterministic operations derived from existing document structure can be
previewed. No correction operation is applied in this phase.

Phase 9B allows one explicitly previewed safe plan to be applied. The applier
performs a narrowly targeted text edit, rejects stale plans, runs the complete
validation pipeline again, and provides one-level exact-text undo. Manual
findings have no apply control, and Fix All is not implemented.

Detailed-item `SubtotalAmount` is not treated as universally required. Service-item quantity and pricing are also not generalized: service pricing evolved across cXML versions, including the move from `UnitOfMeasure`/`UnitPrice` toward `UnitRate`, and applicability can depend on the service type. Those candidates remain deferred until version-aware requirements are approved.

Structural observations describe detected document characteristics such as invoice purpose, backing type, invoice-line counts, tax placement, and Sender `SharedSecret` presence. They do not add validation findings or new Coupa requirements.

Scenario detection is descriptive, not validation. A detected purpose, body mode, line profile, backing state, tax profile, or feature does not by itself pass or fail an invoice. The normalized scenario is supplied to `RuleEngine` as context for evidence-backed applicability filters. Declarative applicability evaluates to `APPLIES`, `NOT_APPLICABLE`, or `UNKNOWN`; non-applicable rules are skipped and are never rendered as findings. Phase 8D uses this context only for the three confirmed structural relationships above.

Backing classification is based only on non-empty supported associations under structural `InvoiceDetailOrderInfo` elements: `PO` means at least one non-empty `OrderReference/DocumentReference/@payloadID` and no non-empty contract association; `CONTRACT` means at least one non-empty `MasterAgreementReference/DocumentReference/@payloadID` and no non-empty PO association; `MIXED` means both; `NONE` means neither. Empty backing references are retained separately in `backingDetails` and as `EMPTY_BACKING_REFERENCE`; they do not become validation errors. `NONE` does not assert that an invoice is a valid unbacked invoice.

`confidence: HIGH` means only that the classification was deterministically derived from the observed structural XML. It does not express Coupa acceptance, scenario validity, transactional validity, or business validity.

## Repository layout

```text
index.html                 Application entry point
css/styles.css             Application styles
data/templates.js          Embedded 17-reference Coupa catalog
js/                        Vanilla JavaScript production modules
tests/                     Browser-native regression harness and documentation
AGENTS.md                  Project constraints and development policy
```

## Privacy and external dependencies

XML processing occurs in the browser. The application does not upload documents and does not use `fetch`, XMLHttpRequest, WebSocket, analytics, Gemini, or another AI service. Theme preference is the only application value stored in `localStorage`. Source URLs shown with rules or references are descriptive links and are not fetched during validation.

The parser does not download or validate remote DTDs. Structural validation implements only the registered, evidence-backed rules; it is not a complete cXML schema validator and does not model every deployment-specific Coupa requirement.

## Known scope limitations

The validator intentionally excludes:

- Coupa-instance transactional validation;
- Compliant Invoicing;
- country-specific tax compliance;
- buyer, supplier, and invoice business-state validation;
- remote DTD/schema validation and external-system lookups.

Passing syntax and supported structural checks means only that no implemented
local rule found an issue. It is not a guarantee of business validity or Coupa
acceptance.

## Regression tests

The browser-native suites exercise the same production parser, analyzer, rule engine, registry, observations, and embedded references used by the application:

- `tests/phase-8a-regression.html` — the 11-rule Phase 8A baseline, all 17 references against the complete registry, and 23 Phase 8A scenarios.
- `tests/phase-8a-1b1-contract.html` — 2 RuleEngine contract tests.
- `tests/phase-8a-1b2-scope.html` — 7 XML scope and hierarchy tests.
- `tests/phase-8a-1b3-observations.html` — 12 structural observation tests.
- `tests/phase-8b-regression.html` — five Phase 8B rules and 26 body/line scenarios, including explicit deferred and excluded cases.
- `tests/phase-8c-scenarios.html` — 24 scenario-detection cases, three applicability-contract cases, and structural integrity assertions for all 17 active references, including backing element counts, non-empty payload arrays, and empty backing references.
- `tests/phase-8d-scenario-rules.html` — 16 scenario-specific rule and deferral cases.
- `tests/phase-9a-corrections.html` — 13 conservative correction-schema, planning, immutability, confidentiality, and determinism cases.
- `tests/phase-9b-apply-fix.html` — 18 preview, targeted mutation, stale-plan, revalidation, confidentiality, and undo cases.
- `tests/phase-10a-realistic-payloads.html` — five SIMPLE and five INTERMEDIATE fictitious end-to-end invoice payloads, including valid, invalid, safe-correction, and undo demonstrations.
- `tests/phase-10b-uat.html` — production-interface acceptance coverage for all ten realistic payloads, three visible views, correction workflow, responsive containment, and basic accessibility.

Historical browser suites through Phase 9B can be opened directly with
`file://`. Phase 10A and Phase 10B load separate fixture files and therefore run
through a temporary development-only static server. This test-server
requirement is not a production runtime requirement. Each suite prints
individual results and a final aggregate. See `tests/README.md` for coverage
details and expected output.
