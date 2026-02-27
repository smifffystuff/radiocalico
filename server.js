const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const port = 3000;

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "radiocalico",
  password: "radiocalico",
  database: "radiocalico",
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Create ratings table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    listener_id TEXT NOT NULL,
    rating SMALLINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(artist, title, listener_id)
  )
`).catch(err => console.error("Failed to create ratings table:", err.message));

// Health check endpoint that verifies DB connectivity
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS time");
    res.json({ status: "ok", db_time: result.rows[0].time });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Get ratings for a song
app.get("/api/ratings", async (req, res) => {
  const { artist, title, listener_id } = req.query;
  if (!artist || !title) {
    return res.status(400).json({ error: "artist and title are required" });
  }
  try {
    const countsResult = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END), 0) AS thumbs_up,
        COALESCE(SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END), 0) AS thumbs_down
      FROM ratings WHERE artist = $1 AND title = $2`,
      [artist, title]
    );
    let user_rating = 0;
    if (listener_id) {
      const userResult = await pool.query(
        "SELECT rating FROM ratings WHERE artist = $1 AND title = $2 AND listener_id = $3",
        [artist, title, listener_id]
      );
      if (userResult.rows.length > 0) {
        user_rating = userResult.rows[0].rating;
      }
    }
    const row = countsResult.rows[0];
    res.json({
      thumbs_up: Number(row.thumbs_up),
      thumbs_down: Number(row.thumbs_down),
      user_rating,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit or update a rating
app.post("/api/ratings", async (req, res) => {
  const { artist, title, listener_id, rating } = req.body;
  if (!artist || !title || !listener_id || (rating !== 1 && rating !== -1)) {
    return res.status(400).json({ error: "artist, title, listener_id, and rating (1 or -1) are required" });
  }
  try {
    await pool.query(
      `INSERT INTO ratings (artist, title, listener_id, rating)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (artist, title, listener_id)
       DO UPDATE SET rating = $4, created_at = NOW()`,
      [artist, title, listener_id, rating]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
