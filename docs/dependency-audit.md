# Dependency audit — 2026-10-09

The npm audit was run after explicit approval to send dependency metadata to npm. The previously rejected audit command was retried once and succeeded in producing a report; its nonzero exit status indicated advisory findings, not an execution denial.

## Results and changes

- Initial full-tree audit: **17** affected-package findings (14 high, 2 moderate, 1 low; no critical).
- Ran `npm audit fix --ignore-scripts --no-fund` using the existing version ranges. No `--force`, major-version overrides, or breaking tool migrations were used.
- Compatible updates changed 29 installed packages, including Babel core/SystemJS transform, Browserslist and related browser mapping data, brace-expansion, fast-uri, and a compatible PostCSS selector-parser dependency.
- Follow-up full-tree audit: **12** affected-package findings (**10 high, 2 moderate**; no low or critical).
- Separate `npm audit --omit=dev`: **0 findings** in the production dependency tree.

Audit totals include affected parent packages and do not represent twelve distinct remotely exploitable extension bugs. Conversely, a zero production-tree report is not a guarantee of application security or a reason to ignore build-tool advisories.

## Remaining development-tool findings

| Dependency family | Current path/use | Why left for a separate migration |
| --- | --- | --- |
| `braces` through micromatch, fast-glob, chokidar, globby | Tailwind and asset-copy tooling; pattern parsing during local builds/watch | npm recommends Tailwind 4 / copy-webpack-plugin 14; these are breaking tool migrations. The current braces line has no compatible fix reported. |
| `postcss-selector-parser` 6.x through postcss-nested/Tailwind | CSS compilation | The compatible 6.x line remains affected by the reported quadratic parsing advisory; the safe 7.x dependency used elsewhere was updated. Moving the Tailwind path requires separate compatibility work. |
| `serialize-javascript` 6.x through copy-webpack-plugin 12 | Build-plugin serialization | npm recommends a major copy-webpack-plugin upgrade; no forced transitive major override was applied. |
| `image-size` 1.x through pptxgenjs 4.0.1 | Historical presentation generator | Fixed image-size 2.x is outside the parent's declared range; npm proposes changing pptxgenjs. The extension's image upload does not use this package. |

These tools currently process repository-owned source, configuration, and assets; they are not imported into the runtime extension code. Their advisories still matter when building untrusted source/assets or accepting untrusted contributions. Do not feed arbitrary third-party patterns, configuration, or presentation images into the build tooling. Address the major tool migrations in a separate change with CSS/build/presentation compatibility coverage.

The audit can change as the registry publishes new advisories. The committed lockfile and the verification run accompanying this change identify what was tested. CI continues to install with `--no-audit`; it verifies deterministic build/runtime regressions rather than silently treating this documented residual advisory set as clean.
