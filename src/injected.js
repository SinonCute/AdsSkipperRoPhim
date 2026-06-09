(function injectAdsSkipper() {
  const FILTER = window.AdsSkipperPlaylistFilter;
  if (!FILTER || window.__addsSkipperRoPhimInstalled) {
    return;
  }

  window.__addsSkipperRoPhimInstalled = true;

  let enabled = true;
  let debug = false;

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.type !== "ADDS_SKIPPER_STATE") {
      return;
    }
    enabled = event.data.enabled !== false;
    debug = event.data.debug === true;
    if (debug) {
      console.info("[AdsSkipperRoPhim] injected state", { enabled, debug });
    }
  });

  function shouldInspectUrl(url) {
    return typeof url === "string" && /\.m3u8(?:[?#]|$)/i.test(url);
  }

  function report(payload) {
    window.postMessage({
      type: "ADDS_SKIPPER_DEBUG",
      ...payload
    }, "*");

    if (payload.removed > 0) {
      window.postMessage({
        type: "ADDS_SKIPPER_REMOVED",
        removed: payload.removed,
        url: payload.url
      }, "*");
    }
  }

  function rewriteText(text, url) {
    if (!enabled || !FILTER.isPlaylist(text)) {
      if (debug && shouldInspectUrl(url)) {
        console.info("[AdsSkipperRoPhim] skipped playlist rewrite", {
          url,
          enabled,
          isPlaylist: FILTER.isPlaylist(text)
        });
      }
      return text;
    }

    const result = FILTER.filterPlaylist(text);
    if (debug) {
      console.info("[AdsSkipperRoPhim] inspected playlist", {
        url,
        removed: result.removed
      });
    }
    report({
      url,
      removed: result.removed,
      action: result.removed > 0 ? "removed" : "no-match"
    });
    return result.text;
  }

  const originalFetch = window.fetch;
  window.fetch = async function addsSkipperFetch(input, init) {
    const response = await originalFetch.apply(this, arguments);
    const url = typeof input === "string" ? input : input && input.url;

    if (!shouldInspectUrl(url)) {
      return response;
    }

    const clone = response.clone();
    const text = await clone.text();
    const rewritten = rewriteText(text, url);

    if (rewritten === text) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");

    return new Response(rewritten, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };

  const OriginalXHR = window.XMLHttpRequest;
  const originalOpen = OriginalXHR.prototype.open;
  const originalSend = OriginalXHR.prototype.send;

  OriginalXHR.prototype.open = function addsSkipperOpen(method, url) {
    this.__addsSkipperUrl = url;
    if (shouldInspectUrl(url) && !this.__addsSkipperListenerAttached) {
      this.__addsSkipperListenerAttached = true;
      this.addEventListener("readystatechange", () => {
        if (this.readyState !== 4 || !enabled || typeof this.responseText !== "string") {
          return;
        }

        const rewritten = rewriteText(this.responseText, this.__addsSkipperUrl);
        if (rewritten === this.responseText) {
          return;
        }

        Object.defineProperty(this, "responseText", {
          configurable: true,
          value: rewritten
        });
        Object.defineProperty(this, "response", {
          configurable: true,
          value: rewritten
        });
      });
    }
    return originalOpen.apply(this, arguments);
  };

  OriginalXHR.prototype.send = function addsSkipperSend() {
    return originalSend.apply(this, arguments);
  };
})();
