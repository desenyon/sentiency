# Privacy and reliability upgrade

Baseline: `3bd2928eb8186c75385e5e8f8662750ec341c72b`.

## Invariants

- Exclude credential fields and authentication forms before reading clipboard or field content, and recheck targets before dispatch and mutation.
- Automatic engines and remote transmission require explicit settings. A key alone does not enable transmission.
- Keep raw transient analysis in the extension's isolated world. Persist allowlisted metadata only; never broadcast raw input through page window events.
- Cancel eligible paste synchronously using cached engine settings. Deduplicate paste/beforeinput pairs and preserve the original selection in a transaction. A delayed result must not overwrite intervening edits.
- Mode changes replace the transaction's own insertion; block restores the pre-paste selection. Fully removed content stays removed. Treat uncertain scans explicitly.
- Validate model shape, confidence, offsets, and turn indices. Bound requests with a deadline; do not turn unavailable, malformed, or refused results into a clean verdict.
- Serialize storage mutations through the MV3 worker; acknowledge only completed writes. Minimize existing stored records on startup.
- Accumulate DOM mutation roots, serialize scans, and check identity/content before applying results. Preserve DOM structure during remediation.
- Map trajectory indices from the final twelve turns back to the original conversation snapshot.

## Verification

Use synthetic fixtures, unit/integration tests with mocked Chrome APIs and Gemini, and a Chromium MV3 extension smoke test with intercepted Gemini traffic. CI must lint, test, build, and run the browser suite. Never use personal browser data or a live API key. Preserve function exports and storage helpers with adapters where behavior can remain safe.
