# Bypass

A daily code-matrix puzzle in the browser. Pick codes from a 6×6 grid, alternating between column and row, and fit all three target sequences into an 8-slot buffer. Same daily puzzle for everyone (UTC), plus unlimited training.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/bypass/
npm run build    # type-check + build to dist/
npm run preview  # serve the built dist/
```

## Deploy (GitHub Pages)

Every push to `main` builds and publishes the site via `.github/workflows/deploy.yml`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The site is served at `https://<user>.github.io/bypass/`. If you rename the repository, update `base` in `vite.config.ts` to `/<new-name>/`.
