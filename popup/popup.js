const enabled = document.getElementById("enabled");
const debug = document.getElementById("debug");
const removedTotal = document.getElementById("removedTotal");
const lastUrl = document.getElementById("lastUrl");
const lastStatus = document.getElementById("lastStatus");
const stateBadge = document.getElementById("stateBadge");
const allowedSitePatterns = document.getElementById("allowedSitePatterns");
const savePatterns = document.getElementById("savePatterns");
const refresh = document.getElementById("refresh");
const reset = document.getElementById("reset");

const DEFAULT_SITE_PATTERNS = [
  "rophim.*",
  "*.rophim.*",
  "cobephim.*",
  "*.cobephim.*"
];

function render(state) {
  enabled.checked = state.enabled !== false;
  debug.checked = state.debug === true;
  stateBadge.textContent = enabled.checked ? "Enabled" : "Off";
  stateBadge.classList.toggle("off", !enabled.checked);
  removedTotal.textContent = String(state.removedTotal || 0);
  const status = state.lastPageStatus || {};
  const statusText = status.lastAction
    || (status.pageAllowed === false ? `Host not enabled: ${status.frameHost || status.host}` : "")
    || (status.injected ? `Injected on ${status.frameHost || status.host}` : status.frameHost || status.host ? `Seen ${status.frameHost || status.host}` : "None");
  lastStatus.textContent = statusText;
  lastStatus.title = JSON.stringify(status, null, 2);
  lastUrl.textContent = status.playlistUrl || state.lastUrl || "None";
  lastUrl.title = status.playlistUrl || state.lastUrl || "";
  allowedSitePatterns.value = (state.allowedSitePatterns || DEFAULT_SITE_PATTERNS).join("\n");
}

function parsePatterns(value) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function loadState() {
  chrome.storage.local.get({
    enabled: true,
    debug: false,
    removedTotal: 0,
    lastUrl: "",
    lastPageStatus: null,
    allowedSitePatterns: DEFAULT_SITE_PATTERNS
  }, render);
}

loadState();

enabled.addEventListener("change", () => {
  chrome.storage.local.set({
    enabled: enabled.checked
  }, loadState);
});

debug.addEventListener("change", () => {
  chrome.storage.local.set({
    debug: debug.checked
  }, loadState);
});

reset.addEventListener("click", () => {
  chrome.storage.local.set({
    removedTotal: 0,
    lastRemoved: 0,
    lastUrl: ""
  }, () => {
    loadState();
  });
});

savePatterns.addEventListener("click", () => {
  const patterns = parsePatterns(allowedSitePatterns.value);
  chrome.storage.local.set({
    allowedSitePatterns: patterns.length > 0 ? patterns : DEFAULT_SITE_PATTERNS
  }, () => {
    loadState();
  });
});

refresh.addEventListener("click", loadState);

chrome.storage.onChanged.addListener(loadState);
