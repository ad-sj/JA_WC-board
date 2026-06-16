# JA WC Board Frontend

This frontend is prepared for a GitHub Pages only deployment. The site is built as static assets, and match data is generated ahead of time into `public/data/dashboard.json` during the build.

## Local development

Use the live backend while developing:

```bash
cd /home/adam/Documents/JA_WC-board
npm run dev:backend
npm run dev:frontend
```

## Static Pages build

Generate the static dashboard payload and build the frontend:

```bash
cd /home/adam/Documents/JA_WC-board
npm run build:pages
```

That command does two things:

1. Builds the backend utilities and generates `frontend/public/data/dashboard.json`
2. Builds the Vite frontend from that static JSON

## GitHub Pages deployment

The repository includes a workflow at `.github/workflows/deploy-pages.yml` that:

1. Runs on pushes to `main`
2. Runs every 30 minutes
3. Can be started manually from the Actions tab
4. Generates fresh static dashboard data from the match result source
5. Builds the frontend and deploys `frontend/dist` to GitHub Pages

To enable it:

1. Push the workflow to GitHub
2. In repository settings, enable GitHub Pages and choose `GitHub Actions` as the source
3. Make sure Actions are allowed to run for the repository

The Vite base path is controlled by `VITE_BASE_PATH` so the same build works both for project Pages sites like `/JA_WC-board/` and root sites like `/`.

## Limitations

1. GitHub Pages is static hosting only. The Express backend is not deployed in this mode.
2. Data updates only when the GitHub Action runs. There is no always-on server.
3. The manual refresh API route is not part of the published Pages site.
4. GitHub scheduled workflows are not exact real-time timers. A 30-minute schedule may run later than expected.
5. If the upstream result CSV is missing scores or is delayed, the static site will reflect that delay.
6. Secrets or private APIs cannot be hidden in frontend code. Everything shipped to the browser is public.

## Notes

- The page now reads its data from `data/dashboard.json`, not from `http://localhost:4000` in production.
- The refresh timestamp shown in the UI is the static data generation time, not the browser load time.
