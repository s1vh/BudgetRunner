# Budget Runner — Backlog

This file records future work that has already been identified, but **does not authorize its implementation**. The priority and scope of each entry must be confirmed before work begins. The complete workflow is defined in `CONTRIBUTING.md` and `CONTRIBUTING_Es.md`.

## Pending

### BR-BL-005 — Implement real Budget persistence

**Status:** awaiting maintainer validation

**Priority:** high

**Working branch:** `codex/feature/budget-persistence-weekly-store`

**Relevant commits:** `423420a` (PostgreSQL schema, Budget engine, weekly store rotation, internal jobs and backend tests) and `cfe722c` (persistent Budget UI, real Dashboard projections, compensating adjustments and localized frontend integration).

**Prepared outcome:** the demonstration Budget list has been replaced with user-isolated PostgreSQL templates and immutable period snapshots. The API supports creation, reading, editing for the next period, pause, resume, archive and historical detail. Calendar boundaries use the account's IANA time zone, preserve monthly anchors and remain correct across DST. Due closures are serializable, idempotent and canonical across overlaps; they persist counted-transaction snapshots, auditable reward allocations, Flux, SynthCoins, penalties and Cyberdeck damage. Rewarded originals remain immutable and can be corrected once through a linked compensating transaction.

The Dashboard now derives balance, active committed capacity, the nearest close, a top-four-plus-Other category distribution and seven real monthly cashflow cycles from posted transactions in the primary currency. Monetary chart geometry uses exact amounts and integer display percentages sum to 100.

The Cyberdeck store now has one per-user rotation for each global half-open window from Sunday 02:00 UTC to the following Sunday 02:00 UTC. A persisted cryptographic seed selects six distinct eligible definitions without considering the user's equipment or needs; rarity and price are weighted by a level snapshot. The protected weekly job can pre-create rotations and `GET /game/store` is the idempotent lazy fallback. Active rotations from the former period-based model are expired during migration.

**Safety decisions:** tenant ownership is enforced with composite foreign keys throughout Budget, reward, store, penalty and damage relationships. Upgrade migrations retain compatibility triggers so the previous backend can keep writing during migrate-before-deploy and a binary rollback remains possible. Legacy invalid time zones are normalized to UTC across accounts, templates and period snapshots. Closure arithmetic is exact above `Number.MAX_SAFE_INTEGER` while PostgreSQL `BIGINT` remains the persisted monetary bound; a poison period is reported without blocking other accounts. Internal secrets reject byte-length mismatches safely.

**Verification:** backend and frontend lint, production builds and the frontend code-splitting contract pass. All **69 tests** pass against the local database, a database built from an empty schema and a temporary database reconstructed from the exact `prod` migrations. The production-path rehearsal covered legacy data backfills, old-writer compatibility after migration, idempotent reruns, ownership constraints, category-history protection and account cascade; both temporary databases were removed afterward. Browser QA against the real API covered Budget create/pause/resume/archive/history, live Dashboard updates, linked adjustments, six distinct store offers, the weekly expiry, desktop behavior and a 390 × 844 layout with no errors after a clean reload. Temporary QA financial records were removed.

**Maintainer validation:** review the app left open locally on the working branch. After approval, move this entry to resolved history and promote the three local commits to `main`. Production remains deferred to the end-of-day bundle; its runbook must execute the documented duplicate-rotation preflight, migrate before deploying the backend, configure both protected jobs, verify the Sunday 02:00 UTC schedule and then complete `BR-BL-009`.

### BR-BL-007 — Audit session theft and reuse through cookies

**Status:** pending

**Priority:** high

**Exploratory test owner:** maintainer

Attempt to compromise a Budget Runner session owned by the tester through cookies and related mechanisms to identify debt in refresh tokens, rotation, revocation, `HttpOnly`, `Secure`, and `SameSite` attributes, session fixation or reuse, and indirect exposure through XSS or CSRF. Testing must be limited to the local environment or expressly authorized test accounts; it must never target real users or third-party infrastructure.

When addressing this entry, document the threat model, reproducible steps without secrets, observed evidence, and proposed mitigations. Any fix must be developed in an independent auxiliary branch created from `dev`.

### BR-BL-009 — Complete the AI co-author history cleanup on `prod`

**Status:** awaiting the authorized production history update

**Priority:** low

**Working branch:** `prod`

**Recorded:** September 10, 2026

**Root cause:** commit `733a90c` included a Copilot co-author trailer even though M. Fieldins remained the human author and committer and Codex was the intended symbolic collaborator. A complete audit found no other Copilot attribution in the repository history.

**Prepared outcome:** the published histories of `main`, `dev`, `codex/feature/cyberdeck-hud`, and `firebase-mock-deployment` were atomically rewritten with force-with-lease. Rewritten commit `8af4174` replaces the Copilot trailer with the canonical `Co-authored-by: Codex <noreply@openai.com>` trailer. Rewritten commit `cd79b2a`, which prepared the Firebase-hosted mock release for the Devpost hackathon, records the same symbolic Codex co-authorship. Human authorship, commit trees, branch topology, commit counts, and merge counts were preserved.

**Verification:** a complete pre-rewrite bundle was created and verified at `.git/codex-backups/pre-copilot-cleanup-733a90c.bundle`; the rewritten published refs contain no Copilot attribution and the two intended Codex trailers; old and new branch tips have identical trees; and `git fsck` reported no structural errors. Remote `prod` intentionally remains at `203d372` to avoid an unauthorized deployment, while the tree-identical rewritten history is prepared locally at `b07382d`.

**Remaining action:** update `prod` only as part of the authorized end-of-day production bundle, verify the resulting remote history and deployment, and then move this entry to resolved history.

### BR-BL-012 — Prevent Flux and streak farming through overlapping Budgets

**Status:** pending product decision

**Priority:** high

The current documented model intentionally permits overlapping global and category Budgets and grants the fixed completion Flux plus one weekly or monthly streak increment for every successful close, including a zero-spend close. A user can therefore create multiple empty or very generous Budgets for the same interval and farm progression even though SynthCoin allocations remain protected against duplication.

Before implementation, define whether completion Flux and streaks belong to each Budget, each canonical calendar cycle, or only to a qualifying close. The chosen rule must preserve legitimate overlapping constraints, remain deterministic under concurrent closure and include a migration policy for existing history. Candidate controls include one streak transition per user/frequency/window, a capped Flux pool per canonical window, and an explicit minimum participation rule. This entry does not authorize changing the current behavior.

### BR-BL-013 — Adopt a lossless monetary wire format

**Status:** pending

**Priority:** medium

The closure engine now uses exact integer arithmetic and isolates aggregates that exceed PostgreSQL `BIGINT`, but the public API DTOs and frontend domain still represent minor units as JavaScript `number`. Individual writes are restricted to safe integers; sufficiently large historical aggregates, balances or direct database imports could nevertheless lose display precision when converted for Dashboard and Budget reads.

Define and migrate to a lossless end-to-end contract, preferably decimal strings for minor units with a shared parser/formatter and explicit range errors. The change must cover transactions, Budget snapshots, Dashboard aggregates, SynthCoin balances, purchases and repairs without silently clamping money. Add compatibility/versioning tests before enabling values outside the current safe display range.

## Resolved history

Completed entries are never deleted. They are moved to this section, marked as resolved, and expanded with:

- resolution date;
- a summary of the outcome and any relevant decision;
- pertinent branches, pull requests, or commits;
- verification performed;
- associated documentation or residual debt.

### BR-BL-011 — Add an optional desktop neon cursor

**Status:** resolved

**Resolution date:** September 10, 2026

**Priority:** low

**Working branch:** `dev`, validated by the maintainer and promoted to `main` in merge commit `86ac79e`.

**Relevant commits:** `e8af793` (initial optional cursor), `36b49a5` (tail-free triangular silhouette), and `1395b76` (thicker softened neon geometry).

**Outcome:** desktop devices with a fine pointer now use a lightweight, tail-free triangular SVG cursor. Its hollow silhouette combines a thicker magenta-to-violet-to-cyan neon outline, a soft outer fade, subtly rounded vertices, an asymmetric color blend, a lightly translucent glass core, and an exact hotspot at the leading tip. The feature is enabled by default for new and existing profiles and can be disabled through a Settings switch translated into all eight supported languages. Its value participates in the existing unsaved-changes workflow and persists through both the HTTP repository and the local mock experience.

**Implementation decision:** the protected application shell reflects the preference on the document root so the cursor also covers portaled dialogs and help layers. Its CSS is guarded by `(hover: hover) and (pointer: fine)`, leaving touch devices unchanged. Text fields retain the text cursor and disabled controls retain their unavailable cursor. Migration `005_custom_cursor_preference.sql` backfills `customCursor: true` without overwriting other preference keys and updates the database default.

**Verification:** complete backend and frontend lint and builds, the frontend code-splitting contract, and all 39 PostgreSQL-backed tests passed after applying the migration locally. UI smoke testing covered the enabled default, disabled and enabled persistence across reloads, correct cursor application, preserved text and disabled-control cursors, and all eight localized toggle variants. The maintainer confirmed that the final softened triangular design matched the requested result before merging it to `main`.

**Residual debt:** inclusion in the authorized end-of-day `prod` bundle remains part of the consolidated production promotion; no cursor-specific implementation debt was identified.

### BR-BL-010 — Warn before leaving Settings with unsaved preferences

**Status:** resolved

**Resolution date:** September 10, 2026

**Priority:** low

**Working branch:** `dev`, validated by the maintainer.

**Relevant commits:** `e049efe` (localized navigation guard) and `9d9d990` (viewport-centered responsive dialog).

**Outcome:** Settings detects real differences between the persisted preference switches and profile values. Internal navigation, including browser back and forward actions, opens an accessible confirmation dialog with localized “Save and leave” and “Discard and leave” actions. The warning remains centered in the visible viewport at desktop and mobile sizes, respects device safe areas, and scrolls internally when vertical space is constrained. Saving continues only after persistence succeeds; failures retain the draft and display a localized error. Discarding restores the saved profile values. Reloading or closing the tab is protected by the browser-native unsaved-changes prompt. The immediately persisted language selector does not create a false dirty state, and its current locale controls the confirmation copy in all eight supported languages.

**Implementation decision:** the application uses React Router's data router so navigation blocking relies on the supported router state machine instead of intercepting links or patching browser history. The centered warning is portaled to the document root so the page entrance transform and scroll position cannot alter its viewport positioning. Existing route paths, lazy feature boundaries, authentication, and layout nesting are preserved.

**Verification:** frontend lint, production build, and the code-splitting contract passed. Local UI smoke tests confirmed save-and-leave persistence, discard-and-leave restoration, browser Back protection, navigation without a prompt after returning to the saved value, all eight localized dialog variants, centered placement at 1280×800, 390×844, and 320×480, and no console errors. The maintainer validated the final presentation.

**Residual debt:** none identified. Promotion to `main` and production remains deferred to the maintainer's release flow.

### BR-BL-008 — Polish inactive Cyberdeck slots and navigation logo glare

**Status:** resolved

**Resolution date:** September 10, 2026

**Priority:** low

**Working branch:** `dev`, validated by the maintainer before promotion to `main`.

**Main commits:** `de97a95` (inactive Cyberdeck states), `03ee8fb` (lagged navigation-logo glare), and `aff10f3` (application-wide ambient pointer glow); promoted to `main` by merge commit `3011634`.

**Outcome:** empty and destroyed Cyberdeck modules no longer accept pointer or keyboard selection and cannot activate card, connector, or wireframe highlighting. Destroyed modules render a genuinely empty integrity track without the residual zero-length SVG stroke. Empty slots show only their localized “No module” message plus the slot identity and number, omitting Energy, Power, Shield, and the integrity track in both landscape and portrait layouts. The ambient layer adds a restrained, lagged glow that follows the pointer across the application. Over the desktop navigation logo, the same interaction becomes brighter through a lens flare and brief red/cyan glitch echoes while the original artwork remains continuously visible. Both pointer effects follow the existing Ambient effects preference and suppress their motion when reduced motion is active.

**Verification:** frontend lint, production build, and the code-splitting contract passed. Local UI smoke testing confirmed the linked inactive states, empty integrity rendering, logo legibility without layout shift, pointer tracking across views, and coordinated enable/disable behavior through Ambient effects. The maintainer validated the finished experience before merging it into `main`.

**Residual debt:** none identified. Production promotion remains intentionally deferred to the end-of-day bundle.

### BR-BL-004 — Remediate npm dependency security advisories

**Status:** resolved

**Resolution date:** September 10, 2026

**Priority:** high

**Working branch:** `codex/fix/npm-security-advisories`, validated by the maintainer before integration into `dev`.

**Commit:** `29fb694`.

**Root cause:** both lockfiles retained vulnerable transitive releases despite compatible patched ranges. In addition, `firebase-functions@7.2.5` resolved an implicit Firebase Admin 13 peer whose older Google Cloud Storage and Firestore trees contained vulnerable `fast-xml-parser` and `uuid` nodes. New Vitest, `qs`, Browserslist, and baseline-browser-mapping advisories had also appeared since the original August audit.

**Outcome:** backend direct floors are now `firebase-functions@^7.3.2`, explicit `firebase-admin@^14.3.0`, and `vitest@^4.1.11`; frontend floors are `react-router@^7.18.3` and `vite@^8.3.0`. Compatible transitive versions were refreshed in both lockfiles. Narrow overrides move only `gaxios@6` and `teeny-request@9` to `uuid@11.1.1`; both consumers use the compatible `uuid.v4()` API. No forced audit fix, global override, or Firebase downgrade was used.

**Verification:** clean backend and frontend `npm ci`; full and `--omit=dev` audits for both projects with **0 vulnerabilities**; **39/39 PostgreSQL-backed tests**; root lint and production build; frontend code-splitting contract; and a local smoke test confirming that the compiled Firebase `api` export remains a callable GCF v2 function in `europe-west1` with successful PostgreSQL readiness.

**Residual debt:** backend installation still prints an upstream deprecation notice for `glob@10.5.0`, reached through `firebase-admin > @google-cloud/firestore > google-gax > rimraf`. npm reports no advisory for the resolved tree, so an unsupported forced major override was rejected. The fix is present on `main`; inclusion in the end-of-day `prod` bundle remains a separate approval.

### BR-BL-003 — Revamp the Gamification visuals

**Status:** resolved

**Resolution date:** August 29, 2026

**Priority:** to be determined

**Working branch:** `codex/feature/cyberdeck-hud`, validated by the maintainer before promotion.

**Outcome:** the section now appears as **Cyberdeck** in the navigation and heading in all eight languages. Overview combines progression metrics and the technical diagram in a single tab. `WRIST CORE` remains untranslated, and each module visually links its card, dashed trace, and a specific part of the wireframe model.

Telemetry allows damaged modules to be repaired from their detail view, displays the SynthCoin cost, and immediately updates Energy and the balance. Intact and destroyed modules show the action as disabled; empty slots no longer open the detail view. The Repairs tab continues to provide the specialized listing.

In portrait orientation, the diagram replaces the wide canvas with compact cards in one or two columns and places a WebGL thumbnail below, without the core or connections. The original widescreen layout is retained in landscape orientation. Only the visible canvas is animated to avoid duplicate graphics work.

**Main commits:** `d2137c0` (HUD integration and interactions) and `90e4b99` (responsive portrait layout).

**Verification:** frontend build and lint, the automated code-splitting contract, and Chromium walkthroughs at 320, 390, 600, and 1280 pixels. Coordinated hover, absence of internal overflow in portrait orientation, modal parity, repair cost and application, disabled states, non-interactive empty slots, and absence of WebGL errors were verified.

**Residual debt:** none identified. The portrait visualization retains hover or focus highlighting, although selecting a card is the primary interaction on touch devices.

### BR-BL-002 — Fix the transparent title in Chrome/Chromium

**Status:** resolved

**Resolution date:** August 29, 2026

**Priority:** to be determined

**Outcome:** `frontend/public/media/BudgetRunner_logo.svg` was simplified, removing the inherited Illustrator structure based on masks and redundant layers. The asset now uses a normalized viewport and a single explicit clip to produce the transparent stripes crossing the words Budget and Runner, without a background or additional hidden raster layers.

**Commit:** `234322c`.

**Verification:** SVG inspection and maintainer visual validation in Chrome/Chromium browsers, with no subsequent reproduction of the original artifacts.

**Residual debt:** an automated Safari check was not run from Windows; the SVG now retains only broadly compatible primitives and attributes.

### BR-BL-006 — Add a SQL injection hardening layer

**Status:** resolved

**Resolution date:** August 27, 2026

**Priority:** high

**Working branch:** `codex/feature/sql-injection-hardening`, validated by the maintainer before promotion.

**Outcome:** all queries executed by routes and services use static SQL text and PostgreSQL parameters. The only dynamic filter builder was replaced with a fixed query containing nullable parameters. The API centrally inspects untrusted text, and the frontend applies the same detection to forms and the HTTP and mock repositories; a rejected transmission cancels requests, purges accessible caches, reloads the application, and displays a neutral Ultrawave notice without describing the countermeasure.

**Relevant decisions:** heuristic detection normalizes percent encoding, Unicode, invisible characters, comments, and several concatenation forms, but is considered defense in depth only. The primary guarantee remains that user values are not interpreted as SQL. Queries also have statement, lock, client, and idle-in-transaction timeouts.

**Commit and review:** `65584c0`; pull request `#5` into `dev`.

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

**Main commits:** `2ddda70` (implementation) and `45dc275` (architecture and test plan).

**Verification:** `npm test` with 13/13 tests, complete lint with no warnings, backend and frontend builds, automated chunk contract, and local walkthrough of Dashboard, Expenses, Budgets, Profile, Settings, and every Gamification tab. The maintainer validated the local experience before authorizing promotion.

**Documentation:** `FRONTEND_ARCHITECTURE.md` defines resources, cache, invalidations, thresholds, and metrics; `TEST_PLAN.md` records cases T-107 through T-111.

**Operational follow-up:** review `window.__BUDGET_RUNNER_API_METRICS__` after the next authorized deployment to observe Vercel and Neon and recalibrate thresholds only if real measurements justify it. This observation does not block resolution of the entry.
