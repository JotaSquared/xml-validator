# XML Invoice Validator — Codex Project Instructions

## Project architecture

- Use Vanilla JavaScript.
- Do not migrate the project to React, Vue, Angular or another framework.
- Do not introduce runtime dependencies unless explicitly requested.
- The application must continue working offline.
- The application must remain compatible with direct execution through file://.
- Preserve the current architecture unless a change is explicitly approved.

## XML reference integrity

- Existing Coupa XML reference files are source-of-truth reference artifacts.
- Do not modify existing XML reference content unless explicitly instructed.
- Metadata changes must never silently alter XML source files.
- Preserve the existing reference catalog.
- Existing valid reference XML files must not be modified merely to make validation rules pass.

## Validation principles

- Do not invent Coupa requirements.
- Production validation rules require approved evidence.
- Keep XML Syntax Validation, cXML/Coupa Structural Validation and Reference Comparison logically separated.
- Do not claim that passing local validation guarantees acceptance by Coupa.
- Full transactional validity may depend on buyer, supplier or Coupa instance configuration.
- Compliant Invoicing is outside the current project scope.

## Phase discipline

- The repository entered Codex after completion of Phase 8A.
- The stable pre-Codex baseline is tagged:

  fase-8A-baseline

- Do not implement future phases unless explicitly requested.
- Implement only the requested phase or subphase.
- Do not anticipate functionality from later phases.

## Phase 8A expected state

Phase 8A introduced the cXML / Coupa Structural Validation Core.

The expected production rule registry contains 11 structural rules:

- CXML_ENV_001
- CXML_ENV_002
- CXML_ENV_003
- CXML_HEADER_001
- CXML_CREDENTIAL_001
- CXML_CREDENTIAL_002
- COUPA_INV_001
- CXML_INV_HEADER_001
- CXML_INV_HEADER_002
- CXML_INV_HEADER_003
- CXML_ORDER_001

The project is expected to contain 17 active Coupa reference templates.

## Change safety

Before modifying existing functionality:

1. Inspect the relevant implementation.
2. Identify existing behavior that may be affected.
3. Preserve backwards compatibility unless explicitly instructed otherwise.
4. Run available tests after changes.
5. Report regressions, uncertainties or unsupported assumptions.
6. Do not silently weaken a validation rule to make a test pass.

## Git discipline

- Keep changes focused on the requested task.
- Avoid unrelated refactoring.
- Do not commit automatically unless explicitly instructed.
- Do not push automatically unless explicitly instructed.