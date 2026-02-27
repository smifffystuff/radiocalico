const STREAM_URL = "https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8";
const METADATA_URL = "https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json";
const METADATA_POLL_MS = 10000;

const audio = document.getElementById("audioEl");
const btnPlay = document.getElementById("btnPlay");
const playIcon = document.getElementById("playIcon");
const volumeSlider = document.getElementById("volumeSlider");
const volumeIcon = document.getElementById("volumeIcon");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const elapsedTime = document.getElementById("elapsedTime");
const trackArtist = document.getElementById("trackArtist");
const trackTitle = document.getElementById("trackTitle");
const trackAlbum = document.getElementById("trackAlbum");
const trackTags = document.getElementById("trackTags");
const streamSource = document.getElementById("streamSource");
const streamDetail = document.getElementById("streamDetail");
const recentList = document.getElementById("recentList");
const coverImg = document.getElementById("coverImg");

const COVER_URL = "https://d3d4yli4hf5bmh.cloudfront.net/cover.jpg";

const btnThumbsUp = document.getElementById("btnThumbsUp");
const btnThumbsDown = document.getElementById("btnThumbsDown");
const thumbsUpCount = document.getElementById("thumbsUpCount");
const thumbsDownCount = document.getElementById("thumbsDownCount");

// Listener identity
let listenerId = localStorage.getItem("listenerId");
if (!listenerId) {
  listenerId = crypto.randomUUID();
  localStorage.setItem("listenerId", listenerId);
}

let currentArtist = "";
let currentTitle = "";
let ratingBusy = false;

async function fetchRatings() {
  if (!currentArtist || !currentTitle) return;
  try {
    const params = new URLSearchParams({ artist: currentArtist, title: currentTitle, listener_id: listenerId });
    const res = await fetch("/api/ratings?" + params);
    if (!res.ok) return;
    const data = await res.json();
    thumbsUpCount.textContent = data.thumbs_up;
    thumbsDownCount.textContent = data.thumbs_down;
    btnThumbsUp.classList.toggle("active", data.user_rating === 1);
    btnThumbsDown.classList.toggle("active", data.user_rating === -1);
  } catch (e) {
    console.error("fetchRatings error:", e);
  }
}

async function submitRating(rating) {
  if (ratingBusy || !currentArtist || !currentTitle) return;
  ratingBusy = true;
  btnThumbsUp.disabled = true;
  btnThumbsDown.disabled = true;
  try {
    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist: currentArtist, title: currentTitle, listener_id: listenerId, rating }),
    });
    if (!res.ok) {
      console.error("submitRating HTTP error:", res.status, await res.text());
    }
    await fetchRatings();
  } catch (e) {
    console.error("submitRating error:", e);
  } finally {
    ratingBusy = false;
    btnThumbsUp.disabled = false;
    btnThumbsDown.disabled = false;
  }
}

btnThumbsUp.addEventListener("click", () => submitRating(1));
btnThumbsDown.addEventListener("click", () => submitRating(-1));

let hls = null;
let isPlaying = false;
let elapsedSeconds = 0;
let timerInterval = null;
let metadataInterval = null;
let lastTrackKey = null;

// --- Timer ---
function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function startTimer() {
  if (timerInterval) return;
  elapsedSeconds = 0;
  elapsedTime.textContent = formatTime(0);
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    elapsedTime.textContent = formatTime(elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// --- Metadata ---
function formatSampleRate(hz) {
  return (hz / 1000).toFixed(1).replace(/\.0$/, "") + " kHz";
}

function updateNowPlaying(data) {
  trackArtist.textContent = data.artist || "Unknown Artist";
  trackTitle.textContent = data.title || "Unknown Track";

  const parts = [];
  if (data.album) parts.push(data.album);
  if (data.date) parts.push("(" + data.date + ")");
  trackAlbum.textContent = parts.join(" ") || "";

  // Tags
  trackTags.innerHTML = "";
  if (data.is_new) {
    const t = document.createElement("span");
    t.className = "tag tag-new";
    t.textContent = "New";
    trackTags.appendChild(t);
  }
  if (data.is_summer) {
    const t = document.createElement("span");
    t.className = "tag tag-summer";
    t.textContent = "Summer";
    trackTags.appendChild(t);
  }
  if (data.is_vidgames) {
    const t = document.createElement("span");
    t.className = "tag tag-vidgames";
    t.textContent = "Video Games";
    trackTags.appendChild(t);
  }

  // Stream quality
  const sr = data.sample_rate ? formatSampleRate(data.sample_rate) : "--";
  const bd = data.bit_depth ? data.bit_depth + "-bit" : "--";
  streamSource.textContent = "Source quality: " + bd + " / " + sr;
  streamDetail.textContent = "Stream quality: " + bd + " / " + sr + " / FLAC / HLS Lossless";

  // Reset elapsed timer and refresh album art when track changes
  const trackKey = data.artist + "|" + data.title;
  if (lastTrackKey !== null && trackKey !== lastTrackKey) {
    stopTimer();
    startTimer();
    coverImg.src = COVER_URL + "?t=" + Date.now();
  }
  lastTrackKey = trackKey;

  // Update rating state for current track
  currentArtist = data.artist || "";
  currentTitle = data.title || "";
  fetchRatings();
}

function updateRecentlyPlayed(data) {
  const items = [];
  for (let i = 1; i <= 5; i++) {
    const artist = data["prev_artist_" + i];
    const title = data["prev_title_" + i];
    if (artist && title) {
      items.push({ artist, title });
    }
  }

  if (items.length === 0) {
    recentList.innerHTML = '<li><span class="recent-num">--</span><div class="recent-detail"><span class="recent-title">No previous tracks yet</span></div></li>';
    return;
  }

  recentList.innerHTML = items.map((item, i) =>
    '<li>' +
      '<span class="recent-num">' + (i + 1) + '</span>' +
      '<div class="recent-detail">' +
        '<div class="recent-artist">' + escapeHtml(item.artist) + '</div>' +
        '<div class="recent-title">' + escapeHtml(item.title) + '</div>' +
      '</div>' +
    '</li>'
  ).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function fetchMetadata() {
  try {
    const res = await fetch(METADATA_URL, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    updateNowPlaying(data);
    updateRecentlyPlayed(data);
  } catch (e) {
    // silently ignore fetch errors
  }
}

function startMetadataPolling() {
  fetchMetadata();
  metadataInterval = setInterval(fetchMetadata, METADATA_POLL_MS);
}

function stopMetadataPolling() {
  if (metadataInterval) {
    clearInterval(metadataInterval);
    metadataInterval = null;
  }
}

// --- HLS / Playback ---
const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
const ICON_VOL_UP = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.47 4.47 0 0 0 2.5-3.5zM14 3.23v2.06a6.51 6.51 0 0 1 0 13.42v2.06A8.5 8.5 0 0 0 14 3.23z"/>';
const ICON_VOL_OFF = '<path d="M16.5 12A4.5 4.5 0 0 0 14 8.5v2.09l2.41 2.41c.06-.31.09-.65.09-1zm2.5 0a6.5 6.5 0 0 1-.78 3.11l1.46 1.46A8.46 8.46 0 0 0 21 12a8.5 8.5 0 0 0-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.46 8.46 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';

function setStatus(state, text) {
  statusDot.className = "status-dot " + state;
  statusText.textContent = text;
}

function initHls() {
  if (Hls.isSupported()) {
    hls = new Hls({
      liveDurationInfinity: true,
      enableWorker: true,
      lowLatencyMode: false,
    });
    hls.loadSource(STREAM_URL);
    hls.attachMedia(audio);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus("live", "Live");
      audio.play();
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            setStatus("error", "Network error - retrying...");
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            setStatus("error", "Media error - recovering...");
            hls.recoverMediaError();
            break;
          default:
            setStatus("error", "Stream unavailable");
            destroyHls();
            break;
        }
      }
    });
  } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
    audio.src = STREAM_URL;
    audio.addEventListener("loadedmetadata", () => {
      setStatus("live", "Live");
      audio.play();
    });
  } else {
    setStatus("error", "HLS not supported in this browser");
    return;
  }
}

function destroyHls() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  audio.removeAttribute("src");
  audio.load();
}

function togglePlay() {
  if (isPlaying) {
    audio.pause();
    destroyHls();
    stopTimer();
    stopMetadataPolling();
    elapsedSeconds = 0;
    elapsedTime.textContent = formatTime(0);
    isPlaying = false;
    lastTrackKey = null;
    playIcon.innerHTML = ICON_PLAY;
    setStatus("", "Stopped");
  } else {
    isPlaying = true;
    playIcon.innerHTML = ICON_PAUSE;
    setStatus("", "Connecting...");
    initHls();
    startMetadataPolling();
  }
}

btnPlay.addEventListener("click", togglePlay);

// Volume
audio.volume = volumeSlider.value / 100;
volumeSlider.addEventListener("input", () => {
  audio.volume = volumeSlider.value / 100;
  volumeIcon.innerHTML = audio.volume === 0 ? ICON_VOL_OFF : ICON_VOL_UP;
});

// Keyboard: space to toggle
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) {
    e.preventDefault();
    togglePlay();
  }
});

// Handle audio element events
audio.addEventListener("playing", () => {
  isPlaying = true;
  playIcon.innerHTML = ICON_PAUSE;
  setStatus("live", "Live");
  startTimer();
});

audio.addEventListener("pause", () => {
  if (!isPlaying) return;
});

audio.addEventListener("error", () => {
  setStatus("error", "Playback error");
});
