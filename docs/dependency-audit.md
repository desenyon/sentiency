# Dependency audit — 2026-10-09

The audits below were explicitly authorized to send dependency metadata to npm. Counts are dated registry results for the committed lockfile, not a guarantee of security. Parent packages count as findings as well as their affected dependencies.

## Results

| Stage | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: |
| Initial audit | 14 | 2 | 1 | 17 |
| Compatible updates within existing ranges | 10 | 2 | 0 | 12 |
| Tested tooling migrations | **2** | **0** | **0** | **2** |
| Production-only audit (`npm audit --omit=dev`) | **0** | **0** | **0** | **0** |

No critical findings were reported. The full dependency tree is **not clean**. The two remaining affected packages are `image-size` and its parent `pptxgenjs`, covering two image parser advisories described below.

## Supported migrations and compatibility evidence

- **Tailwind 3.4.19 → 4.3.3**, using `@tailwindcss/postcss` 4.3.3. All three CSS entry points import a common stylesheet; source scanning remains restricted to `src/`, and the existing JavaScript theme is loaded explicitly. The old `braces`, `micromatch`, `chokidar`, `fast-glob`, `postcss-nested`, and selector-parser 6.x paths are removed. The separate Autoprefixer package is replaced by v4's built-in processing, following the [official migration guide](https://tailwindcss.com/docs/upgrade-guide).
- Preserve the established sRGB palette, fonts, custom shadows and animations. Use explicit small radius/blur names and retain prior preflight defaults. Keep engine-list separators above subsequent rows to avoid v4's changed `divide-y` geometry. Chromium comparison against the previous build found identical layout coordinates for all **92 settings and 84 sidebar elements**; the same-machine screenshots were visually inspected. This is not a pixel-perfect guarantee across operating systems or all UI states.
- A browser regression exposed missing border/ring defaults inside shadow CSS because Chromium does not initialize those `@property` declarations there. A small PostCSS adapter derives the non-inherited `--tw-*` initial values from the generated declarations and applies them in the shadow base layer. A real shadow-tree browser test verifies borders, rings, palette, radius, padding and backdrop blur.
- **copy-webpack-plugin 12.0.2 → 14.0.0**, resolving `serialize-javascript` **7.1.2** and replacing the old glob dependency chain. Version 14's Node 20.9+ requirement is within this repository's Node 22.14+ baseline. Our copy patterns do not use the removed glob options from version 13. See the upstream [v13 changes](https://github.com/webpack/copy-webpack-plugin/releases/tag/v13.0.0) and [v14 changes](https://github.com/webpack/copy-webpack-plugin/releases/tag/v14.0.0).
- A development watch regression builds a temporary source copy, verifies byte-for-byte copying of manifest, HTML and four icons, then observes a newly added utility and public asset in a subsequent build. The test uses polling for portability; it does not assert every platform's native filesystem watcher behavior. A production build and real unpacked-extension browser tests exercise the shipped bundle too.
- The historical presentation generator remains available. Its optional `SENTIENCY_DECK_OUTPUT` destination enables a smoke test without overwriting the tracked deck. The test generates **14 slides and 12 embedded images**, checks ZIP CRCs, parses all XML and verifies internal relationship targets. JSZip is declared directly for archive validation. No visual PowerPoint/LibreOffice rendering is claimed.

No `npm audit fix --force`, transitive dependency overrides, or feature removal was used.

## Minimal remaining findings

`pptxgenjs` **4.0.1** declares `image-size` **^1.2.1**, currently resolving **1.2.1**. As of this audit, 4.0.1 is the latest stable published PptxGenJS release. The reported issues are:

| Advisory | Affected operation | Fixed version outside the parent's range |
| --- | --- | --- |
| [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) | Infinite loops in JXL/HEIF image parsers; denial of service | image-size 2.0.3+ |
| [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | Infinite loop in the ICNS parser; denial of service | image-size 2.0.3+ |

npm suggests PptxGenJS 4.0.0, but inspection of that published tarball found `image-size: ^1.1.1`. That range still permits the affected 1.2.1 version, and older 1.x is also within the ICNS advisory range. Downgrading would not establish remediation and would lose [4.0.1 fixes](https://github.com/gitbrent/PptxGenJS/releases/tag/v4.0.1). The fixed image-size 2.x line changes its filesystem API and is outside either parent range. It was not forced into the dependency tree.

These dependencies are used for the local historical deck generator, not imported into the runtime extension or its explicit image upload path. The current generator supplies dimensions and uses repository-owned PNG/JPEG images. Inspection of the installed PptxGenJS CJS/ESM bundles found no active image-size import; the old size helper is commented out. This limits the observed exposure, but does not resolve the installed-package findings or guarantee future versions behave the same way. Avoid untrusted presentation images until the parent ships a supported fixed dependency or a separately tested generator replacement is adopted.

CI installs with `--no-audit` and verifies functionality; it does not label the documented residual findings as clean. Re-run the authorized full and production-only audits when dependencies or registry advisories change.
