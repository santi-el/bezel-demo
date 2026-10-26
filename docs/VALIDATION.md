# Publication validation

Checked on October 26, 2026, in a separate clean checkout on macOS arm64 with Node.js 25.2.1 and npm. The CI workflow uses Node.js 22; its remote result must be checked separately.

## Results

- `npm ci --prefix stake-local-mobile`: passed; installed 517 packages from the committed lockfile.
- `npm run typecheck`: passed.
- `npm test`: **93 passed, 0 failed, 0 skipped**.
- `CI=1 EXPO_NO_TELEMETRY=1 npm --prefix stake-local-mobile run export:mobile`: passed for both Android and iOS.
- `git diff --check`: passed.
- Application source, tests, configuration and assets were compared with the working project; publication preparation did not change application behavior.

These checks verify types, domain/service behavior, source preservation and bundle generation. They do not establish interactive touch correctness, layout quality, real-device networking, or production readiness. A full native two-account walkthrough remains unverified in this publication pass.

## Dependency audit

The clean installation reported **13 affected packages: 1 low, 4 moderate, 7 high and 1 critical**. These are npm audit package counts, including transitive/propagated findings, rather than 13 independently confirmed exploitable application flaws.

The critical finding is in transitive `shell-quote`; other findings include Expo CLI dependencies, `node-forge`, `ws`, `picomatch`, `yaml`, `zod`, `@babel/core` and navigation/query parsing dependencies. This publication pass retains the existing lockfile. Dependency remediation and retesting remain outstanding; no claim of production security is made. Do not run `npm audit fix --force` blindly: the audit currently proposes an Expo SDK downgrade for some findings.

Reproduce the report with `npm audit --prefix stake-local-mobile`. Advisory results may change over time.

## Publication review

Reviewed all three original commits (52 historical blobs), current source, external endpoint references and tracked filenames for credentials or private configuration. No credential patterns or private configuration files were identified. This review is not a guarantee that all sensitive data or vulnerabilities have been detected. Original commit authorship metadata is retained with the history.

Dependencies, Expo state, generated bundles, local environment files, source backup archives and machine-specific README paths are excluded from the publishing tree. The original `6f975e9` baseline remains available for UI preservation tests.
