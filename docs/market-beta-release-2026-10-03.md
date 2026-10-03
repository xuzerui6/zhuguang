# Market beta release closure, 2026-10-03

## Changes

- `app/mobile/mobile.css`: six sport categories use six stable grid columns.
- `tests/product-readiness.test.ts`: regression coverage for the mobile category row.
- `native/mobile/www`: regenerated signed Android code30 web resources.
- `package.json`, `package-lock.json`: targeted Next.js update from 16.3.4 to 16.3.8.
- `scripts/prepare-web-worker-build.mjs`: include additional SSR modules and inline the generated RSC asset manifest.
- `tests/rendered-html.test.mjs`: deployment preparation regression checks.
- `web:worker:deploy`: always deploy the generated configuration including the canonical-domain wrapper.

## Evidence

- Latest full run: 145 unit/API tests passed, one real-clock test skipped in the regular suite; 15 rendering tests passed.
- Separate 31-minute session test completed with two token rotations before the final packaging changes.
- Strict TypeScript, ESLint, production build, native readiness, Debug/Release Android Lint and diff checks passed.
- Production dependency audit: zero vulnerabilities on 2026-10-03. This does not claim the development dependency tree is vulnerability-free.
- Prior five-viewport matrix: 632 checks, zero failures. Android code30 was installed without clearing data and the six-category row was visually verified.
- Production API health is healthy; public Android latest remains code25 because code30 is a 10% rollout.
- Web version: `5d6e1d36-907c-4a19-9fdc-60c378ddbb1c`.
- API version: `b79d86eb-039b-4d3d-ac42-e10fc0fbeaae`.
- An incomplete web deployment returned 500 and was rolled back immediately. Deployment with the generated configuration subsequently passed homepage, directory, login, download and canonical redirect smoke checks.

## Android and miniapp

- Android: `com.zhuguang.coachos`, 1.3.15 / code30, 6,934,834 bytes.
- APK SHA-256: `bfeb5dbf3f91171d1101d7b8db3df2fa38b0a0c382a4987b84ce68a87190adb2`.
- Certificate SHA-256: `b33cc97431db88bf0702aed79274d8f2bd5ed8814db8bb747b4c1963ea04347b`.
- code30 published at 10%, non-forced, minimum supported code5; code29 paused. No automatic rollout increase is scheduled.
- WeChat development version 1.3.14 uploaded successfully. Formal review and publication remain pending; experience-version selection is performed in the platform by the owner.

## Database and rollback

- No additional migration in this closure. Existing incremental migrations remain unchanged.
- Roll back the web Worker to `8922efa3-9f15-4d4c-afe7-4954ffb8e7ef` if needed; retain database records and incremental schema.
- Pause code30 distribution if device failures occur. Do not uninstall, erase app data or force an installed-device downgrade.
- R2 stays private. Online transactions, fulfillment V2, support evidence and public metrics stay disabled.

## Remaining verification

- Seven-day rollout stability and API error-rate evidence are not yet available; keep code30 at 10% until that gate is met.
- Development dependencies have audit findings requiring a separate targeted compatibility review.
- WeChat filing is pending; formal publication is not completed.
- Live payments, insurance and unsupported service promises remain outside this release.
