# CLAUDE.md — Radio Calico

Developer guidance for AI assistants working on this codebase.

## Project Overview

Radio Calico is a single-page web radio player. The Express backend serves static files and a ratings API. The frontend streams HLS audio directly from CloudFront and polls a separate CloudFront metadata endpoint for now-playing info.

## Key Files

| File | Role |
|------|------|
| `server.js` | Express app: static file serving, ratings API, DB pool |
| `public/app.js` | All client-side logic: HLS playback, metadata polling, ratings UI |
| `public/index.html` | Single-page UI shell |
| `public/style.css` | All styles |
| `Dockerfile` | Multi-stage build with `dev` and `prod` targets |
| `docker-compose.yml` | Production stack (app + db) |
| `docker-compose.dev.yml` | Dev overrides (source volume mount, DB port exposure) |

## Architecture

- The frontend communicates with two external services directly from the browser:
  - **Stream**: `https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8` (HLS via HLS.js)
  - **Metadata**: `https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json` (polled every 10 s)
- The backend only handles ratings persistence (`/api/ratings`) and a health check (`/api/health`).
- PostgreSQL schema is created automatically on startup (`ratings` table in `server.js`).
- Each listener is identified by a UUID stored in `localStorage` (`listenerId`).

## Running in Development

```bash
# With Docker (hot reload via node --watch, DB port exposed on 5432)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Without Docker
npm install && npm run dev
```

## Running in Production

```bash
docker compose up --build
```

## Environment Variables

All DB connection settings are read from environment variables with fallbacks to the defaults used in `docker-compose.yml`. See README.md for the full list.

## Creating Pull Requests

After creating a PR with `gh pr create`, always:

1. Wait for the `Claude Code Review` workflow to complete:
   ```bash
   gh run watch --repo smifffystuff/radiocalico
   ```
2. Fetch and display the review comment posted to the PR:
   ```bash
   gh api repos/smifffystuff/radiocalico/issues/<PR_NUMBER>/comments \
     --jq '.[] | select(.user.login == "claude[bot]") | .body'
   ```
3. Show the review content to the user before proceeding.

The code review runs automatically on every PR via `.github/workflows/claude-code-review.yml` and posts its findings as a PR comment.

## Conventions

- **No build step**: plain HTML/CSS/JS, no bundler, no transpilation.
- **No framework**: vanilla JS throughout the frontend.
- **Express 5**: note that Express 5 is in use — error handling and routing differ slightly from Express 4.
- **DB migrations**: there are none; the schema is a single `CREATE TABLE IF NOT EXISTS` in `server.js`. Add new tables the same way.
- **No test suite** exists yet.

## Docker Build Targets

| Target | CMD | Use case |
|--------|-----|----------|
| `dev`  | `node --watch server.js` | Local development with volume mount |
| `prod` | `node server.js` | Production deployment |

The `dev` compose override mounts the project root into `/app` and anonymises `node_modules` so the container's installed modules are not overwritten by the host directory.
