# Contributing to Budget Runner

[Versión en español](CONTRIBUTING_Es.md)

This file is the canonical reference for repository workflow and branch promotion. Product behaviour and requirements belong in `PRD.md`; deployment details belong in `DEPLOYMENT_FREE_TIER.md`.

## Branch roles

### `dev`: primary development branch

- Develop new features and bug fixes in `dev`.
- For work that benefits from isolation, create a short-lived topic branch from `dev`, such as `feature/...` or `fix/...`.
- Merge completed topic work back into `dev` after appropriate verification.

### `main`: stable branch

- Keep `main` in a stable, releasable state.
- Update it from `dev` when a complete feature or coherent set of fixes is ready.
- A completed feature or urgent fix may also be promoted from a secondary development branch when necessary.
- If an urgent fix reaches `main` without passing through `dev`, make sure the same fix is incorporated into `dev` so the branches do not regress.

### `prod`: deployment branch

- Keep the configuration and dependencies required by the hybrid Firebase, Vercel, and Neon deployment in `prod`.
- Deploy releases only from `prod`.
- Once the deployment setup is complete, do not use `prod` for regular feature or bug-fix development.
- Update `prod` only from `main`. When resolving promotion conflicts, preserve the deployment-specific configuration unless the incoming stable change intentionally replaces it.
- Do not merge deployment-only changes back into `main` or `dev` unless they have been reviewed and made environment-independent.

## Promotion flow

```text
topic branch (optional, created from dev)
                    │
                    ▼
                   dev ──────► main ──────► prod ──────► deployment
```

The normal path is `dev` → `main` → `prod`. Topic branches normally return to `dev`; direct promotion to `main` is reserved for a completed feature or an urgent fix that justifies it.

## Readiness checklist

Before promoting a change:

- Confirm that the feature or fix is complete and internally coherent.
- Run the tests, linting, and builds appropriate to the affected area.
- Update user-facing and technical documentation when behaviour or operations change.
- Check that no credentials, local environment files, generated deployment metadata, or unrelated work are included.
- When updating `prod`, confirm that its hybrid-deployment configuration still works and that the release is being prepared from `main`.

Publishing to a remote repository and deploying are separate, explicit actions. A local merge or commit does not authorize either one.
