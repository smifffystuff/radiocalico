# Radio Calico

A web-based lossless internet radio player. Streams live audio via HLS, displays now-playing metadata, and lets listeners rate tracks with thumbs up/down.

## Features

- HLS lossless audio stream via CloudFront
- Live now-playing metadata (artist, title, album, tags, source quality)
- Recently played track list
- Per-listener thumbs up/down ratings (stored in PostgreSQL)
- Keyboard shortcut: `Space` to toggle play/pause

## Stack

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | Vanilla JS, HTML, CSS   |
| Backend  | Node.js 22, Express 5   |
| Database | PostgreSQL 16           |
| Audio    | HLS.js                  |

## Running with Docker

### Production

```bash
npm run docker:prod
```

The app will be available at `http://localhost:3000`.

### Development

Source code is mounted as a volume so changes reload automatically via `node --watch`.

```bash
npm run docker:dev
```

The PostgreSQL port is also exposed on `localhost:5432` in dev mode for direct DB access.

### Stopping

```bash
docker compose down
```

To also remove the database volume (destroys all ratings data):

```bash
docker compose down -v
```

## Running Locally (without Docker)

Prerequisites: Node.js 22+, PostgreSQL 16+

```bash
# Install dependencies
npm install

# Start a local Postgres instance and set environment variables
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=radiocalico
export DB_PASSWORD=radiocalico
export DB_NAME=radiocalico

# Development (hot reload)
npm run dev

# Production
npm start
```

## Environment Variables

| Variable      | Default      | Description              |
|---------------|--------------|--------------------------|
| `PORT`        | `3000`       | HTTP port the app listens on |
| `DB_HOST`     | `localhost`  | PostgreSQL host          |
| `DB_PORT`     | `5432`       | PostgreSQL port          |
| `DB_USER`     | `radiocalico`| PostgreSQL user          |
| `DB_PASSWORD` | `radiocalico`| PostgreSQL password      |
| `DB_NAME`     | `radiocalico`| PostgreSQL database name |

## API Endpoints

| Method | Path           | Description                        |
|--------|----------------|------------------------------------|
| `GET`  | `/api/health`  | Health check — returns DB time     |
| `GET`  | `/api/ratings` | Get ratings for a track            |
| `POST` | `/api/ratings` | Submit or update a listener rating |

### GET /api/ratings

Query params: `artist`, `title`, `listener_id` (optional)

```json
{ "thumbs_up": 4, "thumbs_down": 1, "user_rating": 1 }
```

### POST /api/ratings

```json
{ "artist": "...", "title": "...", "listener_id": "...", "rating": 1 }
```

`rating` must be `1` (thumbs up) or `-1` (thumbs down).

## Project Structure

```
radiocalico/
├── server.js              # Express app and API routes
├── package.json
├── Dockerfile             # Multi-stage build (dev + prod targets)
├── docker-compose.yml     # Production stack (app + db)
├── docker-compose.dev.yml # Development overrides
└── public/
    ├── index.html         # Single-page player UI
    ├── app.js             # Client-side audio, metadata, ratings logic
    └── style.css          # Styles
```
