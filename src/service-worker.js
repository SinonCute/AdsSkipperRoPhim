chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({
    enabled: true,
    debug: false,
    removedTotal: 0,
    allowedSitePatterns: [
      "rophim.*",
      "*.rophim.*",
      "cobephim.*",
      "*.cobephim.*"
    ]
  }, (state) => {
    chrome.storage.local.set(state);
  });
});
