# Generated Artifacts Policy

## Why
Tracked generated outputs (`dist/`, `*.tsbuildinfo`, temporary build caches) create noisy diffs, harder reviews, and higher merge risk.

## Policy
- Do not commit generated build outputs.
- Keep generated artifacts ignored by git.
- Run `check:generated` before merge from both app packages:
  - `backend`: `npm run check:generated`
  - `frontend`: `npm run check:generated`

## Included in Guard
- Any path under `dist/`
- `*.tsbuildinfo`
- TypeScript temporary build-info files under `.tmp/`
- Pure deletion-only cleanup of already tracked generated files is allowed.

## If Existing Tracked Generated Files Already Exist
If these files are currently tracked, untrack once and keep local copies:

```bash
git rm -r --cached backend/dist frontend/dist
git rm --cached backend/dist/tsconfig.build.tsbuildinfo
git commit -m "chore: untrack generated build artifacts"
```

After untracking, future generated files stay local and out of review.
