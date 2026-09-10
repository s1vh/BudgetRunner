# Budget Runner — Backlog

This file records future work that has already been identified, but **does not authorize its implementation**. The priority and scope of each entry must be confirmed before work begins. The complete workflow is defined in `CONTRIBUTING.md` and `CONTRIBUTING_Es.md`.

## Pending

### BR-BL-004 — Remediate npm dependency security advisories

**Status:** pending

**Priority:** high

**Detected:** August 27, 2026, with `npm --prefix backend audit` against the current lockfile.

The complete backend report records **0 critical, 2 high, and 10 moderate advisories**: 12 affected package nodes, not 12 independent vulnerabilities. When development dependencies are excluded with `--omit=dev`, **1 high and 8 moderate advisories** remain across 9 nodes in the production dependency tree.

The frontend review after adding TanStack Query records **0 critical, 3 high, and 1 moderate advisories** across four nodes. With `npm --prefix frontend audit --omit=dev`, only **1 high-severity production advisory** remains: `react-router@7.18.1`. TanStack Query 5.102.8 is not affected.

#### High severity

- **Production — `fast-xml-parser@5.10.0`:** repeated `DOCTYPE` declarations can reset entity-expansion limits and cause resource exhaustion. It enters through `firebase-functions@7.2.5 > firebase-admin@13.10.0 > @google-cloud/storage@7.21.0`. Versions `>=5.9.3 <5.10.1` are affected; npm identifies an available fix. Reference: [GHSA-8r6m-32jq-jx6q](https://github.com/advisories/GHSA-8r6m-32jq-jx6q).
- **Development — `nanoid@3.3.16`:** a custom generator with a zero size can enter an infinite loop. It enters through `vitest@4.1.10 > vite@8.1.4 > postcss@8.5.19`. Versions `<3.3.18` are affected; npm identifies an available fix. Reference: [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8).
- **Frontend production — `react-router@7.18.1`:** in RSC mode, certain actions can execute before a CSRF protection responds with 400. Versions `>=7.12.0 <7.18.2` are affected; npm identifies an available compatible fix. Budget Runner does not currently use RSC, but the direct dependency must be updated and verified. Reference: [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2).
- **Frontend development — `brace-expansion@5.0.0`:** two denial-of-service advisories caused by unbounded expansion affect the same node (`<5.0.9`). npm identifies an available fix. References: [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) and [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895).

#### Moderate severity

- **Production — `uuid@9.0.1`:** UUID v3/v5/v6 lacks a buffer bounds check when `buf` is provided. It enters through Google Cloud dependencies; versions `<11.1.1` are affected. Reference: [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
- **Development — `postcss@8.5.19`:** an attacker-controlled `sourceMappingURL` can read `.map` files when `from` is not defined. Versions `<=8.5.22` are affected. Reference: [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp).
- **Frontend — `postcss@8.5.19`:** the same moderate advisory appears in the frontend development tree and has an available fix.
- **Firebase/Google Cloud dependency-tree propagation:** npm also raises `firebase-functions`, `firebase-admin`, `@google-cloud/firestore`, `@google-cloud/storage`, `google-gax`, `gaxios`, `retry-request`, and `teeny-request` as moderate-severity nodes because they depend on the vulnerable packages above.

The remediation must not automatically apply `npm audit fix --force`: the full report proposes `firebase-functions@4.9.0`, which would be a major downgrade from `7.2.5` and could break the hybrid deployment. The work must first evaluate compatible fixed versions, transitive updates, or narrowly scoped `overrides`.

To resolve this entry:

- update dependencies and lockfiles without introducing incompatible downgrades;
- leave `npm audit` with no high or critical advisories and explicitly justify any remaining moderate advisory;
- repeat `npm audit --omit=dev` to distinguish production risk;
- pass lint, build, and the complete test suite with local PostgreSQL;
- validate Firebase Functions compilation and behavior before promoting the change to `main` and `prod`;
- when closing the entry, record the final versions, resolved advisories, verification, and any accepted risk.

### BR-BL-005 — Implement real Budget persistence

**Status:** pending

**Priority:** to be determined

Replace the frontend's demonstration budgets with the complete persistent vertical defined in `PRD.md`, `DATABASE.md`, `API.md`, and `GAME_SYSTEM.md`. The work will cover the API, PostgreSQL, the period scheduler, closures, rewards and penalties, as well as the frontend creation and tracking experience.

The implementation must include at least:

- per-user isolation and complete CRUD contracts;
- frequencies, time zones, pauses, resumptions, archiving, and derived periods;
- idempotent closures, concurrency, serializable transactions, and failure recovery;
- auditable calculation of compliance, Flux, SynthCoins, damage, and any compensating adjustment;
- migration from mock data without presenting fictitious budgets as persisted;
- selective invalidation of Dashboard, Budgets, and Gamification;
- unit, integration, scheduler, isolation, and calendar edge-case tests.

### BR-BL-007 — Audit session theft and reuse through cookies

**Status:** pending

**Priority:** high

**Exploratory test owner:** maintainer

Attempt to compromise a Budget Runner session owned by the tester through cookies and related mechanisms to identify debt in refresh tokens, rotation, revocation, `HttpOnly`, `Secure`, and `SameSite` attributes, session fixation or reuse, and indirect exposure through XSS or CSRF. Testing must be limited to the local environment or expressly authorized test accounts; it must never target real users or third-party infrastructure.

When addressing this entry, document the threat model, reproducible steps without secrets, observed evidence, and proposed mitigations. Any fix must be developed in an independent auxiliary branch created from `dev`.

## Resolved history

Completed entries are never deleted. They are moved to this section, marked as resolved, and expanded with:

- resolution date;
- a summary of the outcome and any relevant decision;
- pertinent branches, pull requests, or commits;
- verification performed;
- associated documentation or residual debt.

### BR-BL-003 — Revamp the Gamification visuals

**Status:** resolved

**Resolution date:** August 29, 2026

**Priority:** to be determined

**Working branch:** `codex/feature/cyberdeck-hud`, validated by the maintainer before promotion.

**Outcome:** the section now appears as **Cyberdeck** in the navigation and heading in all eight languages. Overview combines progression metrics and the technical diagram in a single tab. `WRIST CORE` remains untranslated, and each module visually links its card, dashed trace, and a specific part of the wireframe model.

Telemetry allows damaged modules to be repaired from their detail view, displays the SynthCoin cost, and immediately updates Energy and the balance. Intact and destroyed modules show the action as disabled; empty slots no longer open the detail view. The Repairs tab continues to provide the specialized listing.

In portrait orientation, the diagram replaces the wide canvas with compact cards in one or two columns and places a WebGL thumbnail below, without the core or connections. The original widescreen layout is retained in landscape orientation. Only the visible canvas is animated to avoid duplicate graphics work.

**Main commits:** `bd1a92f` (HUD integration and interactions) and `aca241c` (responsive portrait layout).

**Verification:** frontend build and lint, the automated code-splitting contract, and Chromium walkthroughs at 320, 390, 600, and 1280 pixels. Coordinated hover, absence of internal overflow in portrait orientation, modal parity, repair cost and application, disabled states, non-interactive empty slots, and absence of WebGL errors were verified.

**Residual debt:** none identified. The portrait visualization retains hover or focus highlighting, although selecting a card is the primary interaction on touch devices.

### BR-BL-002 — Fix the transparent title in Chrome/Chromium

**Status:** resolved

**Resolution date:** August 29, 2026

**Priority:** to be determined

**Outcome:** `frontend/public/media/BudgetRunner_logo.svg` was simplified, removing the inherited Illustrator structure based on masks and redundant layers. The asset now uses a normalized viewport and a single explicit clip to produce the transparent stripes crossing the words Budget and Runner, without a background or additional hidden raster layers.

**Commit:** `c753255`.

**Verification:** SVG inspection and maintainer visual validation in Chrome/Chromium browsers, with no subsequent reproduction of the original artifacts.

**Residual debt:** an automated Safari check was not run from Windows; the SVG now retains only broadly compatible primitives and attributes.

### BR-BL-006 — Add a SQL injection hardening layer

**Status:** resolved

**Resolution date:** August 27, 2026

**Priority:** high

**Working branch:** `codex/feature/sql-injection-hardening`, validated by the maintainer before promotion.

**Outcome:** all queries executed by routes and services use static SQL text and PostgreSQL parameters. The only dynamic filter builder was replaced with a fixed query containing nullable parameters. The API centrally inspects untrusted text, and the frontend applies the same detection to forms and the HTTP and mock repositories; a rejected transmission cancels requests, purges accessible caches, reloads the application, and displays a neutral Ultrawave notice without describing the countermeasure.

**Relevant decisions:** heuristic detection normalizes percent encoding, Unicode, invisible characters, comments, and several concatenation forms, but is considered defense in depth only. The primary guarantee remains that user values are not interpreted as SQL. Queries also have statement, lock, client, and idle-in-transaction timeouts.

**Commit and review:** `97b664f`; pull request `#5` into `dev`.

**Verification:** 39/39 tests, including authentication, searches, categories, concepts, notes, obfuscation, and false positives; verification that rejections do not alter rows; static invariant against SQL built at runtime; complete lint; production build; and code-splitting contract.

**Residual debt:** no textual detection can recognize every possible obfuscation and it must not be expanded as a substitute for parameterization. The offensive review of sessions and cookies remains separate under `BR-BL-007`.

### BR-BL-001 — Split data loading by functional area

**Status:** resolved

**Resolution date:** August 27, 2026

**Priority:** high

**Working branch:** `codex/feature/data-loading-splitting`, integrated into `dev` after maintainer validation.

**Outcome:** the private global snapshot of nine reads was removed and replaced with TanStack Query 5.102.8 using independent queries for profile, dashboard, transactions, categories, budgets, and each Gamification resource. Session restoration reuses the profile already fetched, and the HTTP and mock repositories share the same granular contract.

**Relevant decisions:**

- independent cache and loading/error states for each route and tab;
- selective invalidations that use the dashboard recalculated by financial mutations;
- Store code and inventory that can be prefetched through hover, focus, selection, or tour;
- immediate skeleton, accessible text after 700 ms, and a slow-provider warning after 3 s;
- retryable errors within the affected section without reloading the application;
- telemetry limited to the latest 200 requests, with normalized routes and no UUIDs or query strings.

**Main commits:** `567e956` (implementation) and `24e81ef` (architecture and test plan).

**Verification:** `npm test` with 13/13 tests, complete lint with no warnings, backend and frontend builds, automated chunk contract, and local walkthrough of Dashboard, Expenses, Budgets, Profile, Settings, and every Gamification tab. The maintainer validated the local experience before authorizing promotion.

**Documentation:** `FRONTEND_ARCHITECTURE.md` defines resources, cache, invalidations, thresholds, and metrics; `TEST_PLAN.md` records cases T-107 through T-111.

**Operational follow-up:** review `window.__BUDGET_RUNNER_API_METRICS__` after the next authorized deployment to observe Vercel and Neon and recalibrate thresholds only if real measurements justify it. This observation does not block resolution of the entry.
