const audio = document.getElementById("audioPlayer");

const ui = {
  stationName: document.getElementById("stationName"),
  stationMeta: document.getElementById("stationMeta"),
  playBtn: document.getElementById("playBtn"),
  playIcon: document.getElementById("playIcon"),
  previousBtn: document.getElementById("previousBtn"),
  nextBtn: document.getElementById("nextBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  openStations: document.getElementById("openStations"),
  listBtn: document.getElementById("listBtn"),
  closeStations: document.getElementById("closeStations"),
  drawer: document.getElementById("stationDrawer"),
  backdrop: document.getElementById("drawerBackdrop"),
  search: document.getElementById("searchInput"),
  stationList: document.getElementById("stationList"),
  stationPreview: document.getElementById("stationPreview"),
  stationCount: document.getElementById("stationCount"),
  countryFilters: document.getElementById("countryFilters"),
  drawerCountryFilters: document.getElementById("drawerCountryFilters"),
  viewAllBtn: document.getElementById("viewAllBtn"),
  status: document.getElementById("statusText"),
  feedback: document.getElementById("feedback"),
  liveDot: document.querySelector(".live-dot")
};

const countries = {
  "Martinique": { flag: "🇲🇶", code: "MQ" },
  "Saint Lucia": { flag: "🇱🇨", code: "LC" },
  "Trinidad & Tobago": { flag: "🇹🇹", code: "TT" }
};

let stations = [];
let currentIndex = 0;
let activeCountry = "all";
let isLoading = false;
let requestId = 0;
let hls = null;
let currentSrcUrl = "";

function isHlsStream(url) {
  return url.includes(".m3u8");
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

  currentSrcUrl = url;
  const nativeHls = audio.canPlayType("application/vnd.apple.mpegurl");

  if (isHlsStream(url) && !nativeHls && window.Hls?.isSupported()) {
    return new Promise((resolve, reject) => {
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(audio);
      hls.once(Hls.Events.MANIFEST_PARSED, resolve);
      hls.once(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) reject(new Error("HLS stream error"));
      });
    });
  }

  audio.src = url;
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

function renderCurrentStation() {
  const station = currentStation();

  if (!station) return;

  ui.stationName.textContent = station.name;
  ui.stationMeta.textContent =
    `${countryFlag(station)} ${station.country} · ${station.frequency}`;

  renderStationPreview();
  renderStationList();
  updatePlayButton();
}

function getFilteredStations() {
  const query = ui.search.value.trim().toLowerCase();

  return stations.filter((station) => {
    const matchesCountry =
      activeCountry === "all" || station.country === activeCountry;

    const searchableText = [
      station.name,
      station.country,
      station.frequency,
      station.countryCode
    ].join(" ").toLowerCase();

    return matchesCountry && searchableText.includes(query);
  });
}

function createStationButton(station, index) {
  const button = document.createElement("button");
  button.className = "station-row";
  button.type = "button";

  if (index === currentIndex) {
    button.classList.add("selected");
    button.setAttribute("aria-current", "true");
  }

  const flag = document.createElement("span");
  flag.className = "station-flag";
  flag.textContent = countryFlag(station);

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
  action.textContent =
    index === currentIndex && !audio.paused ? "Ⅱ" : "▶";
  action.setAttribute("aria-hidden", "true");

  info.append(name, frequency);
  button.append(flag, info, action);

  button.addEventListener("click", () => {
    selectStation(index, true);
    closeDrawer();
  });

  return button;
}

function renderStationPreview() {
  const filtered = getFilteredStations().slice(0, 4);
  ui.stationPreview.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No stations found.";
    ui.stationPreview.append(empty);
    return;
  }

  filtered.forEach((station) => {
    const index = stations.findIndex((item) => item.id === station.id);
    ui.stationPreview.append(createStationButton(station, index));
  });
}

function renderStationList() {
  const filtered = getFilteredStations();
  ui.stationList.replaceChildren();
  ui.stationCount.textContent =
    `${filtered.length} station${filtered.length === 1 ? "" : "s"}`;

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No stations match your search.";
    ui.stationList.append(empty);
    return;
  }

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

function setCountry(country) {
  activeCountry = country;

  document.querySelectorAll("[data-country]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.country === activeCountry
    );
  });

  renderStationPreview();
  renderStationList();
}

function openDrawer() {
  ui.drawer.classList.add("open");
  ui.backdrop.classList.add("open");
  ui.drawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  ui.search.focus();
}

function closeDrawer() {
  ui.drawer.classList.remove("open");
  ui.backdrop.classList.remove("open");
  ui.drawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function playCurrent() {
  const station = currentStation();
  if (!station) return;

  if (isLoading) return;

  isLoading = true;
  setStatus("Connecting…", `Connecting to ${station.name}…`);

  try {
    const resolvedUrl = new URL(station.streamUrl, window.location.href).href;

    if (currentSrcUrl !== resolvedUrl) {
      await setAudioSource(station.streamUrl);
    }

    await audio.play();
  } catch (error) {
    if (error.name === "NotAllowedError") {
      setStatus(
        "Tap to play",
        "Your browser blocked playback. Tap Play to try again.",
        true
      );
    } else {
      setStatus(
        "Unable to play",
        "This stream could not start. Try Refresh Live or another station.",
        true
      );
    }
  } finally {
    isLoading = false;
    updatePlayButton();
  }
}

async function selectStation(index, autoplay = true) {
  if (!stations.length) return;

  currentIndex = (index + stations.length) % stations.length;
  requestId++;

  cleanupAudio();

  renderCurrentStation();
  setStatus("Ready", `${currentStation().name} selected.`);

  if (autoplay) {
    await playCurrent();
  }
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

  isLoading = false;
  cleanupAudio();
  setStatus("Refreshing…", `Reconnecting to ${station.name} live…`);

  try {
    await setAudioSource(station.streamUrl);
    await audio.play();

    if (refreshRequest !== requestId) return;
    setStatus("Connecting…", `Reconnecting to ${station.name}…`);
  } catch (error) {
    if (refreshRequest !== requestId) return;

    setStatus(
      "Refresh failed",
      "Could not reconnect. Check the connection or try another station.",
      true
    );
  }

  updatePlayButton();
}

function nextStation() {
  selectStation(currentIndex + 1, true);
}

function previousStation() {
  selectStation(currentIndex - 1, true);
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
    currentIndex = 0;

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

// Playback events keep the interface synchronized with the audio element.
audio.addEventListener("playing", () => {
  setStatus("On air", `Now playing ${currentStation()?.name || "radio"}.`);
  updatePlayButton();
  renderStationPreview();
  renderStationList();
});

audio.addEventListener("waiting", () => {
  setStatus("Buffering…", "Waiting for the radio stream.");
  updatePlayButton();
});

audio.addEventListener("pause", updatePlayButton);

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

ui.openStations.addEventListener("click", openDrawer);
ui.listBtn.addEventListener("click", openDrawer);
ui.closeStations.addEventListener("click", closeDrawer);
ui.backdrop.addEventListener("click", closeDrawer);
ui.viewAllBtn.addEventListener("click", openDrawer);

ui.search.addEventListener("input", () => {
  renderStationPreview();
  renderStationList();
});

[ui.countryFilters, ui.drawerCountryFilters].forEach((container) => {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-country]");
    if (button) setCountry(button.dataset.country);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});

loadStations();
