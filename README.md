# cantica-web

React SPA for the Cantica prompt registry — browse, search, fork, and manage AI prompts in the browser.

Built with **Vite + React + TypeScript + Tailwind CSS**.

When the API runs with the security shim (`CANTICA_SECURITY_SHIM`), admins get
security screens at `/admin/security` (users · activation · flags · directory
mappings · API tokens), rendered from the shared
[`@cantica/secure-ui`](../cantica-secure/ui/) library.

---

## Development

```bash
# Install dependencies
task install      # or: npm install

# Start dev server (proxies /v1 to the API at :8042)
task dev          # or: npm run dev

# Production build
task build        # or: npm run build

# Preview production build locally
task preview
```

The dev server runs at `http://localhost:5173`. API requests to `/v1` are proxied to the Cantica API at `http://localhost:8042`.

Start the API first:

```bash
cd ../cantica-api && task serve
```

---

## Tasks

| Task | Description |
| --- | --- |
| `task install` | Install npm dependencies |
| `task dev` | Start Vite dev server with API proxy |
| `task build` | Production build to `dist/` |
| `task preview` | Preview production build |
| `task lint` | Run ESLint |
| `task check` | Lint + build |
| `task clean` | Remove `dist/` and Vite cache |
| `task clean:all` | Remove `dist/`, cache, and `node_modules/` |

---

## Docker

```bash
docker build -t cantica-web .
docker run -p 80:80 cantica-web
```

The image uses nginx to serve the built SPA and proxy `/v1` to the API.
Configure the upstream API host via the `CANTICA_API_URL` build arg if needed.

---

## Project structure

```text
src/
├── components/   UI components
├── pages/        Route-level page components
├── hooks/        Custom React hooks
├── lib/          API client and utilities
└── main.tsx      Entry point
```
