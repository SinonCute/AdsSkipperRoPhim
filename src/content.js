(function setupContentScript() {
  const DEFAULT_SITE_PATTERNS = [
    "rophim.*",
    "*.rophim.*",
    "cobephim.*",
    "*.cobephim.*"
  ];

  const scriptUrls = [
    chrome.runtime.getURL("src/playlist-filter.js"),
    chrome.runtime.getURL("src/injected.js")
  ];

  let injected = false;

  function patternToRegExp(pattern) {
    const escaped = pattern
      .trim()
      .toLowerCase()
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`);
  }

  function isAllowedHost(hostname, patterns) {
    const host = hostname.toLowerCase();
    return patterns
      .map((pattern) => pattern.trim())
      .filter(Boolean)
      .some((pattern) => patternToRegExp(pattern).test(host));
  }

  function getAncestorHosts() {
    try {
      return Array.from(window.location.ancestorOrigins || [])
        .map((origin) => new URL(origin).hostname)
        .filter(Boolean);
    } catch (_error) {
      return [];
    }
  }

  function getAllowedContext(patterns) {
    const frameHost = location.hostname;
    const ancestorHosts = getAncestorHosts();
    const matchedHost = [frameHost, ...ancestorHosts].find((host) => isAllowedHost(host, patterns));

    return {
      frameHost,
      ancestorHosts,
      pageAllowed: Boolean(matchedHost),
      matchedHost: matchedHost || ""
    };
  }

  function getSettings(callback) {
    chrome.storage.local.get({
      enabled: true,
      debug: false,
      allowedSitePatterns: DEFAULT_SITE_PATTERNS
    }, callback);
  }

  function storeStatus(status) {
    chrome.storage.local.set({
      lastPageStatus: {
        url: location.href,
        host: location.hostname,
        time: new Date().toISOString(),
        ...status
      }
    });
  }

  function storePlaylistStatus(action, eventData) {
    storeStatus({
      enabled: true,
      pageAllowed: true,
      injected: true,
      lastAction: action,
      removed: eventData.removed || 0,
      playlistUrl: eventData.url || ""
    });
  }

  function injectScript(src) {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        script.remove();
        resolve();
      };
      (document.documentElement || document.head).appendChild(script);
    });
  }

  async function injectAll() {
    if (injected) {
      return;
    }
    injected = true;
    for (const url of scriptUrls) {
      await injectScript(url);
    }
    syncEnabledState();
  }

  function postState(enabled) {
    chrome.storage.local.get({ debug: false }, (state) => {
      window.postMessage({
        type: "ADDS_SKIPPER_STATE",
        enabled,
        debug: state.debug === true
      }, "*");
    });
  }

  function syncEnabledState() {
    getSettings((state) => {
      const context = getAllowedContext(state.allowedSitePatterns);
      postState(state.enabled && context.pageAllowed);
      storeStatus({
        enabled: state.enabled !== false,
        debug: state.debug === true,
        pageAllowed: context.pageAllowed,
        matchedHost: context.matchedHost,
        frameHost: context.frameHost,
        ancestorHosts: context.ancestorHosts,
        injected,
        patterns: state.allowedSitePatterns
      });
      if (state.debug) {
        console.info("[AdsSkipperRoPhim] page state", {
          frameHost: context.frameHost,
          ancestorHosts: context.ancestorHosts,
          enabled: state.enabled !== false,
          pageAllowed: context.pageAllowed,
          matchedHost: context.matchedHost,
          injected,
          patterns: state.allowedSitePatterns
        });
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && (changes.enabled || changes.debug || changes.allowedSitePatterns)) {
      maybeInject();
      syncEnabledState();
    }
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) {
      return;
    }

    if (event.data.type === "ADDS_SKIPPER_DEBUG") {
      storePlaylistStatus(event.data.action, event.data);
      return;
    }

    if (event.data.type !== "ADDS_SKIPPER_REMOVED") {
      return;
    }

    chrome.storage.local.get({ removedTotal: 0 }, (state) => {
      chrome.storage.local.set({
        removedTotal: state.removedTotal + event.data.removed,
        lastRemoved: event.data.removed,
        lastUrl: event.data.url || ""
      });
      storePlaylistStatus(`Removed ${event.data.removed} segment(s)`, event.data);
    });
  });

  function maybeInject() {
    getSettings((state) => {
      const context = getAllowedContext(state.allowedSitePatterns);
      storeStatus({
        enabled: state.enabled !== false,
        debug: state.debug === true,
        pageAllowed: context.pageAllowed,
        matchedHost: context.matchedHost,
        frameHost: context.frameHost,
        ancestorHosts: context.ancestorHosts,
        injected,
        patterns: state.allowedSitePatterns
      });
      if (context.pageAllowed) {
        injectAll();
      } else if (state.debug) {
        console.info("[AdsSkipperRoPhim] not injecting because host is not allowed", {
          frameHost: context.frameHost,
          ancestorHosts: context.ancestorHosts,
          patterns: state.allowedSitePatterns
        });
      }
    });
  }

  maybeInject();
})();
