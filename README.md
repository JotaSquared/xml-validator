# XML Invoice Validator

Offline, browser-based inspection of cXML invoices against the structural behavior established in Phase 8A. The production application is Vanilla JavaScript and can be opened directly from the repository with `file://`; it has no runtime package manager, build step, local server, or AI service dependency.

Passing this validator does not guarantee acceptance by Coupa. Transaction validity can also depend on buyer, supplier, and Coupa-instance configuration. Compliant Invoicing is outside this project's current scope.

## Run the application

1. Clone or copy the repository.
2. Open `index.html` in a modern browser, including by double-clicking it or using a `file://` URL.
3. Paste, drop, or select a cXML file and run validation.

No installation or build command is required. All application assets and the reference catalog are local to the repository.

## Validation architecture

The application keeps three concerns logically separate:

1. **XML syntax validation** — `js/xmlParser.js` uses the browser's `DOMParser` to parse user input and reports malformed XML before structural processing.
2. **cXML/Coupa structural validation** — `js/xmlAnalyzer.js` produces the internal analysis model; `js/ruleEngine.js` executes the registered rules from `js/validationRules.js` and normalizes findings.
3. **Reference comparison** — `js/templateComparator.js` compares the analyzed input with a separately selected reference from the catalog. Comparison results are not structural findings.

`js/app.js` coordinates user input, parsing, analysis, validation, comparison, and rendering. `js/ui.js`, `js/treeRenderer.js`, and `js/xmlFormatter.js` handle presentation. `js/templateCatalog.js` exposes the 17 active Coupa references embedded in `data/templates.js` without altering their XML content.

The production structural rule registry contains exactly these 11 rules:

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

Structural observations describe detected document characteristics such as invoice purpose, backing type, invoice-line counts, tax placement, and Sender `SharedSecret` presence. They do not add validation findings or new Coupa requirements.

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

## Regression tests

The browser-native suites exercise the same production parser, analyzer, rule engine, registry, observations, and embedded references used by the application:

- `tests/phase-8a-regression.html` — 11 production rules, all 17 references, and 23 Phase 8A scenarios.
- `tests/phase-8a-1b1-contract.html` — 2 RuleEngine contract tests.
- `tests/phase-8a-1b2-scope.html` — 7 XML scope and hierarchy tests.
- `tests/phase-8a-1b3-observations.html` — 12 structural observation tests.

Open each HTML file directly with `file://`. Each suite prints individual results and a final aggregate. See `tests/README.md` for coverage details and expected output.
