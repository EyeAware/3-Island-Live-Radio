const audio = document.getElementById("audioPlayer");

const ui = {
  stationName: document.getElementById("stationName"),
  stationMeta: document.getElementById("stationMeta"),
  playBtn: document.getElementById("playBtn"),
  playIcon: document.getElementById("playIcon"),
  previousBtn: document.getElementById("previousBtn"),
  nextBtn: document.getElementById("nextBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  favoriteBtn: document.getElementById("favoriteBtn"),
  openStations: document.getElementById("openStations"),
  closeStations: document.getElementById("closeStations"),
  drawer: document.getElementById("stationDrawer"),
  backdrop: document.getElementById("drawerBackdrop"),
  search: document.getElementById("searchInput"),
  stationList: document.getElementById("stationList"),
  stationCount: document.getElementById("stationCount"),
  drawerCountryFilters: document.getElementById("drawerCountryFilters"),
  status: document.getElementById("statusText"),
  feedback: document.getElementById("feedback"),
  liveDot: document.querySelector(".live-dot"),
  liveLabel: document.getElementById("liveLabel")
};

const countries = {
  "Martinique": { flag: "🇲🇶", code: "MQ" },
  "Saint Lucia": { flag: "🇱🇨", code: "LC" },
  "Trinidad & Tobago": { flag: "🇹🇹", code: "TT" }
};

let stations = [];
let currentIndex = 0;
let activeFilter = "all";
let activeCountry = "all";
let isLoading = false;
let requestId = 0;
let hls = null;
let currentSrcUrl = "";
let favorites = [];

const STORAGE_KEYS = {
  LAST_STATION: "islandRadio_lastStation",
  FAVORITES: "islandRadio_favorites",
  ACTIVE_FILTER: "islandRadio_activeFilter",
  ACTIVE_COUNTRY: "islandRadio_activeCountry"
};

function isHlsStream(url) {
  try {
    return /\.m3u8(?:$|[?#])/i.test(new URL(url, window.location.href).pathname + new URL(url, window.location.href).search);
  } catch {
    return /\.m3u8(?:$|[?#])/i.test(String(url));
  }
}

function cleanupAudio() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  currentSrcUrl = "";
}

function setAudioSource(url) {
  if (hls) {
    hls.destroy();
    hls = null;
  }

  const resolvedUrl = new URL(url, window.location.href).href;
  currentSrcUrl = resolvedUrl;
  const nativeHls = audio.canPlayType("application/vnd.apple.mpegurl");

  if (isHlsStream(resolvedUrl) && !nativeHls && window.Hls?.isSupported()) {
    return new Promise((resolve, reject) => {
      const instance = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls = instance;
      let settled = false;
      instance.attachMedia(audio);
      instance.loadSource(resolvedUrl);
      instance.once(Hls.Events.MANIFEST_PARSED, () => {
        settled = true;
        resolve();
      });
      instance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal && !settled) {
          settled = true;
          reject(new Error("HLS stream error"));
        }
      });
    });
  }

  audio.src = resolvedUrl;
  return Promise.resolve();
}

function currentStation() {
  return stations[currentIndex] || null;
}

function setStatus(status, message, isError = false) {
  ui.status.textContent = status;
  ui.feedback.textContent = message;
  ui.feedback.classList.toggle("error", isError);
}

function countryFlag(station) {
  return countries[station.country]?.flag || "📻";
}

function updatePlayButton() {
  const playing = !audio.paused && !audio.ended;

  ui.playIcon.textContent = playing ? "Ⅱ" : "▶";
  ui.playBtn.setAttribute(
    "aria-label",
    playing ? "Pause radio" : "Play radio"
  );
  ui.playBtn.title = playing ? "Pause" : "Play";
  ui.liveDot.classList.toggle("playing", playing);
}

function saveLastStation() {
  const station = currentStation();
  if (station) {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_STATION, JSON.stringify({
        id: station.id,
        index: currentIndex
      }));
    } catch (error) {
      console.warn("Failed to save last station:", error);
    }
  }
}

function loadLastStation() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.LAST_STATION);
    if (saved) {
      const data = JSON.parse(saved);
      const stationIndex = stations.findIndex(s => s.id === data.id);
      if (stationIndex !== -1) {
        currentIndex = stationIndex;
        return true;
      }
    }
  } catch (e) {
    console.warn("Failed to load last station:", e);
  }
  return false;
}

function loadFavorites() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (saved) {
      const parsed = JSON.parse(saved);
      favorites = Array.isArray(parsed) ? parsed.filter(id => typeof id === "string") : [];
    }
  } catch (e) {
    console.warn("Failed to load favorites:", e);
    favorites = [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  } catch (e) {
    console.warn("Failed to save favorites:", e);
  }
}

function saveFilterSelection() {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_FILTER, JSON.stringify(activeFilter));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_COUNTRY, JSON.stringify(activeCountry));
  } catch (e) {
    console.warn("Failed to save filter selection:", e);
  }
}

function loadFilterSelection() {
  try {
    const savedFilter = localStorage.getItem(STORAGE_KEYS.ACTIVE_FILTER);
    const savedCountry = localStorage.getItem(STORAGE_KEYS.ACTIVE_COUNTRY);
    if (savedFilter) activeFilter = JSON.parse(savedFilter);
    if (savedCountry) activeCountry = JSON.parse(savedCountry);
  } catch (e) {
    console.warn("Failed to load filter selection:", e);
  }
}

function isFavorite(stationId) {
  return favorites.includes(stationId);
}

function toggleFavorite(stationId) {
  const index = favorites.indexOf(stationId);
  if (index === -1) {
    favorites.push(stationId);
  } else {
    favorites.splice(index, 1);
  }
  saveFavorites();
  renderStationList();
  renderCurrentStation();
}

function toggleCurrentFavorite() {
  const station = currentStation();
  if (!station) return;
  toggleFavorite(station.id);
  updateCoverFavoriteButton();
}

function updateCoverFavoriteButton() {
  const station = currentStation();
  if (!station || !ui.favoriteBtn) return;

  const isFav = isFavorite(station.id);
  ui.favoriteBtn.classList.toggle("favorited", isFav);
  ui.favoriteBtn.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
  ui.favoriteBtn.title = isFav ? "Remove from favorites" : "Add to favorites";
}

function getFilteredStations() {
  const query = ui.search.value.trim().toLowerCase();

  let filtered = stations;

  if (activeFilter === "favorites") {
    filtered = stations.filter(s => favorites.includes(s.id));
  } else if (activeCountry !== "all") {
    filtered = stations.filter(s => s.country === activeCountry);
  }

  if (query) {
    filtered = filtered.filter((station) => {
      const searchableText = [
        station.name,
        station.country,
        station.frequency,
        station.countryCode
      ].join(" ").toLowerCase();

      return searchableText.includes(query);
    });
  }

  return filtered;
}

function createStationButton(station, index) {
  const row = document.createElement("div");
  row.className = "station-row";
  if (index === currentIndex) {
    row.classList.add("selected");
  }

  const selectButton = document.createElement("button");
  selectButton.className = "station-select";
  selectButton.type = "button";
  selectButton.setAttribute("aria-label", `Play ${station.name}`);
  if (index === currentIndex) selectButton.setAttribute("aria-current", "true");

  const flag = document.createElement("span");
  flag.className = "station-flag";
  flag.textContent = countryFlag(station);
  flag.setAttribute("aria-hidden", "true");

  const info = document.createElement("span");
  info.className = "station-info";

  const name = document.createElement("span");
  name.className = "station-title";
  name.textContent = station.name;

  const frequency = document.createElement("span");
  frequency.className = "station-frequency";
  frequency.textContent = `${station.frequency} · ${station.country}`;

  const action = document.createElement("span");
  action.className = "station-action";
  action.textContent = index === currentIndex && !audio.paused ? "Ⅱ" : "▶";
  action.setAttribute("aria-hidden", "true");
  info.append(name, frequency);
  selectButton.append(flag, info, action);

  const favoriteBtn = document.createElement("button");
  favoriteBtn.type = "button";
  favoriteBtn.className = "favorite-btn";
  const favorite = isFavorite(station.id);
  favoriteBtn.setAttribute("aria-label", favorite ? `Remove ${station.name} from favorites` : `Add ${station.name} to favorites`);
  favoriteBtn.setAttribute("aria-pressed", String(favorite));
  favoriteBtn.textContent = favorite ? "♥" : "♡";
  if (favorite) favoriteBtn.classList.add("favorited");
  favoriteBtn.addEventListener("click", () => toggleFavorite(station.id));

  selectButton.addEventListener("click", () => {
    selectStation(index, true);
    closeDrawer();
  });

  row.append(selectButton, favoriteBtn);
  return row;
}

function renderCurrentStation() {
  const station = currentStation();

  if (!station) return;

  ui.stationName.textContent = station.name;
  ui.stationMeta.textContent =
    `${countryFlag(station)} ${station.country} · ${station.frequency}`;

  renderStationList();
  updatePlayButton();
  updateCoverFavoriteButton();
}

function renderStationList() {
  const filtered = getFilteredStations();
  ui.stationList.replaceChildren();
  ui.stationCount.textContent =
    `${filtered.length} station${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    if (activeFilter === "favorites") {
      empty.textContent = "No favorites yet. Tap the heart on a station to add it.";
    } else {
      empty.textContent = "No stations match your search.";
    }
    ui.stationList.append(empty);
    return;
  }

  if (activeFilter === "favorites") {
    filtered.forEach((station) => {
      const index = stations.findIndex((item) => item.id === station.id);
      ui.stationList.append(createStationButton(station, index));
    });
  } else {
    const groups = new Map();

    filtered.forEach((station) => {
      if (!groups.has(station.country)) {
        groups.set(station.country, []);
      }
      groups.get(station.country).push(station);
    });

    for (const [country, group] of groups) {
      const heading = document.createElement("div");
      heading.className = "country-heading";
      heading.textContent = `${countries[country]?.flag || "📻"} ${country}`;
      ui.stationList.append(heading);

      group.forEach((station) => {
        const index = stations.findIndex((item) => item.id === station.id);
        ui.stationList.append(createStationButton(station, index));
      });
    }
  }
}

function updateFilterButtons() {
  document.querySelectorAll("#drawerCountryFilters [data-filter], #drawerCountryFilters [data-country]").forEach((button) => {
    const isFilterBtn = button.hasAttribute("data-filter");
    const isCountryBtn = button.hasAttribute("data-country");
    let isActive = false;
    if (isFilterBtn && button.dataset.filter === activeFilter && activeCountry === "all") isActive = true;
    if (isCountryBtn && activeFilter === "all" && button.dataset.country === activeCountry) isActive = true;
    button.classList.toggle("active", isActive);
  });
}

function setFilter(filter) {
  activeFilter = filter;
  activeCountry = "all";
  saveFilterSelection();

  updateFilterButtons();

  renderStationList();
}

function setCountry(country) {
  activeCountry = country;
  activeFilter = "all";
  saveFilterSelection();

  updateFilterButtons();

  renderStationList();
}

function openDrawer() {
  ui.drawer.classList.add("open");
  ui.backdrop.classList.add("open");
  ui.drawer.setAttribute("aria-hidden", "false");
  ui.openStations.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  window.setTimeout(() => ui.search.focus(), 30);
}

function closeDrawer() {
  ui.drawer.classList.remove("open");
  ui.backdrop.classList.remove("open");
  ui.drawer.setAttribute("aria-hidden", "true");
  ui.openStations.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

function watchPlaybackStart(playRequest, timeoutMs) {
  return new Promise((resolve) => {
    if (playRequest !== requestId) {
      resolve("cancelled");
      return;
    }

    if (!audio.paused && !audio.ended && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve("playing");
      return;
    }

    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      resolve(value);
    };

    const onPlaying = () => finish("playing");
    const onError = () => finish("error");
    const timer = window.setTimeout(() => {
      finish(audio.paused ? "timeout" : "playing");
    }, timeoutMs);

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);
  });
}

async function playCurrent({ waitForStart = false, timeoutMs = 10000 } = {}) {
  const station = currentStation();
  if (!station || isLoading) return false;

  const playRequest = requestId;
  isLoading = true;
  setStatus("Connecting…", `Connecting to ${station.name}…`);

  const markUnavailable = () => {
    setStatus(
      "Stream unavailable",
      "The stream may be offline, expired, or unsupported by this browser.",
      true
    );
    return false;
  };

  try {
    const resolvedUrl = new URL(station.streamUrl, window.location.href).href;
    const connect = async () => {
      try {
        if (currentSrcUrl !== resolvedUrl) await setAudioSource(resolvedUrl);
        if (playRequest !== requestId || station !== currentStation()) return "cancelled";
        await audio.play();
        if (playRequest !== requestId) return "cancelled";
        if (!waitForStart) return "playing";
        return watchPlaybackStart(playRequest, timeoutMs);
      } catch (error) {
        if (error.name === "NotAllowedError") return "blocked";
        return "error";
      }
    };

    const outcome = waitForStart
      ? await Promise.race([
          connect(),
          new Promise((resolve) => {
            window.setTimeout(() => resolve("timeout"), timeoutMs);
          })
        ])
      : await connect();

    if (playRequest !== requestId || outcome === "cancelled") return false;
    if (outcome === "blocked") {
      setStatus("Tap to play", "Your browser blocked playback. Tap Play to try again.", true);
      return "blocked";
    }
    if (outcome !== "playing") {
      if (waitForStart) return markUnavailable();
      setStatus("Unable to play", "This stream could not start. Try Refresh Live or another station.", true);
      return false;
    }

    saveLastStation();
    return true;
  } finally {
    if (playRequest === requestId) {
      isLoading = false;
      updatePlayButton();
    }
  }
}

async function selectStation(index, autoplay = true, playOptions = {}) {
  if (!stations.length) return false;

  currentIndex = (index + stations.length) % stations.length;
  requestId++;
  isLoading = false;

  cleanupAudio();

  renderCurrentStation();
  setStatus("Ready", `${currentStation().name} selected.`);

  if (autoplay) {
    return playCurrent(playOptions);
  }

  return true;
}

async function togglePlayback() {
  if (!currentStation()) return;

  if (!audio.paused) {
    audio.pause();
    setStatus("Paused", "Playback paused. Press Play to resume.");
    updatePlayButton();
    return;
  }

  await playCurrent();
}

async function refreshLive() {
  const station = currentStation();
  if (!station) return;

  requestId++;
  const refreshRequest = requestId;

  isLoading = true;
  cleanupAudio();
  setStatus("Refreshing…", `Reconnecting to ${station.name} live…`);

  try {
    await setAudioSource(station.streamUrl);
    if (refreshRequest !== requestId || station !== currentStation()) return;
    await audio.play();
    if (refreshRequest !== requestId) return;
  } catch (error) {
    if (refreshRequest !== requestId) return;
    setStatus("Refresh failed", "Could not reconnect. Check the connection or try another station.", true);
  } finally {
    if (refreshRequest === requestId) {
      isLoading = false;
      updatePlayButton();
    }
  }
}

function getCurrentFilteredIndex() {
  const filtered = getFilteredStations();
  const station = currentStation();
  if (!station) return 0;
  return filtered.findIndex(s => s.id === station.id);
}

function getStationOriginalIndex(stationId) {
  return stations.findIndex(s => s.id === stationId);
}

async function stepStation(direction) {
  const filtered = getFilteredStations();
  if (!filtered.length) return;

  const playOptions = { waitForStart: true, timeoutMs: 10000 };
  const total = filtered.length;

  for (let attempt = 0; attempt < total; attempt++) {
    const currentFilteredIndex = getCurrentFilteredIndex();
    const nextFilteredIndex =
      direction === 1
        ? (currentFilteredIndex + 1) % total
        : (currentFilteredIndex - 1 + total) % total;
    const candidate = filtered[nextFilteredIndex];
    const originalIndex = getStationOriginalIndex(candidate.id);
    const result = await selectStation(originalIndex, true, playOptions);

    if (result === true || result === "blocked") return;
  }

  setStatus(
    "Stream unavailable",
    "No playable streams in this list right now. Try again later.",
    true
  );
}

function nextStation() {
  return stepStation(1);
}

function previousStation() {
  return stepStation(-1);
}

async function loadStations() {
  try {
    const response = await fetch("./stations.json");

    if (!response.ok) {
      throw new Error("Could not load stations.json");
    }

    const data = await response.json();

    if (!Array.isArray(data.stations) || data.stations.length === 0) {
      throw new Error("The station list is empty or invalid");
    }

    stations = data.stations;
    loadFavorites();
    loadFilterSelection();

    updateFilterButtons();

    const hasLastStation = loadLastStation();
    if (!hasLastStation) {
      currentIndex = 0;
    }

    renderCurrentStation();
    setStatus("Ready", `${stations.length} stations loaded. Press Play.`);
  } catch (error) {
    console.error(error);
    ui.stationName.textContent = "Unable to load stations";
    setStatus(
      "Setup error",
      "Run this app through a local web server and check stations.json.",
      true
    );
  }
}

audio.addEventListener("playing", () => {
  setStatus("On air", `Now playing ${currentStation()?.name || "radio"}.`);
  updatePlayButton();
  renderStationList();
});

audio.addEventListener("waiting", () => {
  setStatus("Buffering…", "Waiting for the radio stream.");
  updatePlayButton();
});

audio.addEventListener("pause", () => {
  updatePlayButton();
  renderStationList();
});

audio.addEventListener("error", () => {
  isLoading = false;
  setStatus(
    "Stream unavailable",
    "The stream may be offline, expired, or unsupported by this browser.",
    true
  );
  updatePlayButton();
});

audio.addEventListener("ended", () => {
  setStatus("Stream ended", "The stream ended. Press Play to reconnect.");
  updatePlayButton();
});

ui.playBtn.addEventListener("click", togglePlayback);
ui.previousBtn.addEventListener("click", previousStation);
ui.nextBtn.addEventListener("click", nextStation);
ui.refreshBtn.addEventListener("click", refreshLive);
ui.favoriteBtn.addEventListener("click", toggleCurrentFavorite);

ui.openStations.addEventListener("click", openDrawer);
ui.closeStations.addEventListener("click", closeDrawer);
ui.backdrop.addEventListener("click", closeDrawer);

ui.search.addEventListener("input", () => {
  renderStationList();
});

ui.drawerCountryFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter], [data-country]");
  if (!button) return;

  if (button.hasAttribute("data-filter")) {
    setFilter(button.dataset.filter);
  } else if (button.hasAttribute("data-country")) {
    setCountry(button.dataset.country);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && ui.drawer.classList.contains("open")) {
    closeDrawer();
    ui.openStations.focus();
  }
});

loadStations();