# Phase 8A.1A Regression Suite

Open `phase-8a-regression.html` directly in Chrome or Edge. The suite uses only
local classic scripts and browser APIs, so it remains compatible with `file://`
and requires no Node.js, npm installation, build, or local server.

The suite loads and exercises the production Vanilla JavaScript parser,
analyzer, rule engine, production rule registry, and embedded reference catalog.
It verifies:

- all 11 Phase 8A baseline rules remain registered and enabled;
- all 17 production references parse, analyze, consider the complete production registry, execute every applicable rule, and
  produce no structural errors;
- all 23 reconstructed Phase 8A acceptance scenarios.

Successful aggregate output is:

```text
11/11 production rules baseline verified
17/17 references passed
23/23 Phase 8A scenarios passed
```

Every individual assertion is also displayed and written to the browser
console. No production XML or application source is changed by the suite.

## Phase 8A.1B-1 RuleEngine contract tests

Open `phase-8a-1b1-contract.html` directly in Chrome or Edge. This focused
suite verifies that malformed rule findings still receive the complete
normalized `correction` schema and that rule registration contracts reject
`source.type` values outside the RuleEngine's existing allowlist.

## Phase 8A.1B-2 XML scope and hierarchy tests

Open `phase-8a-1b2-scope.html` directly in Chrome or Edge. This focused suite
verifies that Credential rules inspect only direct Header partner Credentials,
that invoice-header and order rules resolve the structural
`/cXML/Request/InvoiceDetailRequest`, and that multiple direct invoice orders
continue to be validated individually.

## Phase 8A.1B-3 structural observation tests

Open `phase-8a-1b3-observations.html` directly in Chrome or Edge. This focused
suite verifies structurally scoped Sender SharedSecret detection, neutral
handling of an undeclared purpose, explicit PO/Contract/Mixed/None backing
states, preservation of multiple and empty associated payloadIDs, exclusion of
unrelated references, and descriptive UI wording.

## Phase 8B invoice body and line tests

Open `phase-8b-regression.html` directly in Chrome or Edge. This suite uses the
production parser, analyzer, RuleEngine, and registry to verify five Phase 8B
rules across 26 scenarios:

- mutually exclusive header and detailed invoice body modes;
- required `InvoiceDetailSummary` placement;
- detailed-item `invoiceLineNumber` and `quantity` attributes;
- detailed-item `UnitOfMeasure`, `UnitPrice`, and
  `InvoiceDetailItemReference` children;
- service-item `invoiceLineNumber`, independently of detailed-item rules.

The suite also protects intentional non-errors: optional detailed-item
`SubtotalAmount`, service quantity and pricing, purpose variants, tax, backing,
`PaymentTerm`, and `Extrinsic`.

Successful aggregate output is:

```text
26/26 Phase 8B scenarios passed
```

## Phase 8C scenario detection and applicability tests

Open `phase-8c-scenarios.html` directly in Chrome or Edge. The suite exercises
the production parser, analyzer, structural observations, `ScenarioResolver`,
and RuleEngine applicability contract without adding or changing validation
rules.

The focused coverage includes 24 deterministic classification cases across
purpose, body mode, line profile, backing, tax placement, and descriptive
features. Three additional cases verify declarative `APPLIES`,
`NOT_APPLICABLE`, and `UNKNOWN` results. The suite also discovers and classifies
all 17 active production references at runtime. For every reference it asserts
the approved purpose/body/line/backing/tax classification and independently
audits the structural OrderReference and MasterAgreementReference counts,
non-empty payloadID arrays, and empty backing-reference count. No template
metadata participates in classification.

Successful aggregate output is:

```text
28/28 Phase 8C tests passed; 17/17 references classified
```

Scenario detection and structural validation remain separate: a scenario is
descriptive context, not a finding, and non-applicable rules are not reported as
invoice errors.

`HIGH` confidence indicates deterministic confidence in the structural
observation only. It does not indicate Coupa acceptance or business validity.

## Coupa reference source integrity

Run `node tests/reference-source-integrity.mjs` from the repository root using
any development Node.js runtime. This development-only check compares the
decoded XML string for every entry in `data/templates.js` byte-for-byte with
its approved homonymous file under `reference-sources/`, including whitespace,
comments, line endings, and trailing content. It does not alter either source.

Successful aggregate output is:

```text
17/17 SOURCE MATCH
```

Open `reference-runtime-regression.html` to run every restored reference through
the production parser, analyzer, TemplateCatalog preflight, exact self-
comparison, all 19 registered rules (with scenario applicability honored), and ScenarioResolver. Expected output:

```text
17/17 approved references passed complete runtime checks
```

## Phase 8D scenario-specific structural rules

Open `phase-8d-scenario-rules.html` directly in Chrome or Edge. The suite
verifies the three evidence-confirmed scenario rules: header/detailed body-mode
indicator consistency, the header-invoice accounting-line restriction, and the
direct original-invoice DocumentReference required for delete operations. It
also protects deferred credit/debit memo, backing, tax-compliance, and service-
pricing behavior from accidental expansion.

Successful aggregate output is:

```text
16/16 Phase 8D scenarios passed
```

## Phase 9A correction planning tests

Open `phase-9a-corrections.html` directly in Chrome or Edge. The suite verifies
the conservative, read-only correction planning contract. Missing business
values remain `NOT_AUTOFIXABLE`; an existing misplaced
`InvoiceDetailOrderInfo` can produce a deterministic `MOVE_NODE` preview; no
planning operation mutates XML or exposes `SharedSecret`; repeated plans are
deterministic; and every one of the 19 production rules has an explicit
correction classification.

Successful aggregate output is:

```text
13/13 Phase 9A correction tests passed
```

Phase 9A does not apply correction operations. It provides suggestions and
read-only plans only.

## Phase 9B safe apply-fix tests

Open `phase-9b-apply-fix.html` directly in Chrome or Edge. The suite verifies
the four approved single-fix cases, exact-state stale-plan protection,
targeted text mutation, immediate revalidation behavior, exact one-level undo,
SharedSecret-safe previews, and rejection of manual or unsupported operations.

```text
18/18 Phase 9B apply-fix tests passed
```

Phase 9B intentionally provides no Fix All operation.

## Phase 10A realistic synthetic payload pack

`sample-payloads/` contains exactly five SIMPLE and five INTERMEDIATE fictitious
invoice XML documents plus a descriptive manifest. They are test fixtures, not
approved Coupa references, and are never loaded by the production application.

Open `phase-10a-realistic-payloads.html` through a local static test server so
the browser can load the separate XML fixture files. The harness sends each
payload through the production parser, analyzer, observations,
`ScenarioResolver`, `RuleEngine`, and `CorrectionEngine`. It also exercises the
two safe-correction demonstrations end to end.

```text
15/15 Phase 10A realistic payload checks passed; 10/10 payloads evaluated
```

## Phase 10B production-interface UAT

Open `phase-10b-uat.html` through a local static test server. The suite embeds
the real production `index.html` and runs all ten realistic payloads through
the visible user workflow. It verifies separate syntax and structure summaries,
findings, Invoice Details, XML Tree navigation and highlighting, safe correction
preview/apply/undo, edited-state invalidation, Format, Clear, responsive
containment, and basic accessible interaction semantics.

```text
14/14 Phase 10B UAT checks passed; 10/10 payloads passed production UI UAT
```
