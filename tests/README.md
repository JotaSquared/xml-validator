# Phase 8A.1A Regression Suite

Open `phase-8a-regression.html` directly in Chrome or Edge. The suite uses only
local classic scripts and browser APIs, so it remains compatible with `file://`
and requires no Node.js, npm installation, build, or local server.

The suite loads and exercises the production Vanilla JavaScript parser,
analyzer, rule engine, Phase 8A rule registry, and embedded reference catalog.
It verifies:

- exactly 11 expected production rules are registered and enabled;
- all 17 production references parse, analyze, execute all 11 rules, and
  produce no structural errors;
- all 23 reconstructed Phase 8A acceptance scenarios.

Successful aggregate output is:

```text
11 production rules verified
17/17 references passed
23/23 Phase 8A scenarios passed
```

Every individual assertion is also displayed and written to the browser
console. No production XML or application source is changed by the suite.
