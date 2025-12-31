/**
 * Network Request Detector
 * Monitors for m3u8 URLs and notifies the background script
 */

(function () {
  // Store m3u8 URLs detected on this page
  const detectedUrls = new Set();

  // Intercept fetch requests
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = args[0];
    if (typeof url === "string" && url.includes(".m3u8")) {
      console.log("[SyncStream] Fetch detected m3u8:", url);
      notifyBackgroundOfUrl(url);
    }
    return originalFetch.apply(this, args);
  };

  // Intercept XMLHttpRequest
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === "string" && url.includes(".m3u8")) {
      console.log("[SyncStream] XHR detected m3u8:", url);
      notifyBackgroundOfUrl(url);
    }
    return originalXhrOpen.apply(this, [method, url, ...rest]);
  };

  // Monitor script sources for m3u8 URLs
  const originalEval = window.eval;
  window.eval = function (code) {
    if (typeof code === "string") {
      // Extract m3u8 URLs from eval'd code
      const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
      const matches = code.match(m3u8Regex);
      if (matches) {
        matches.forEach((url) => {
          console.log("[SyncStream] Eval detected m3u8:", url);
          notifyBackgroundOfUrl(url);
        });
      }
    }
    return originalEval.call(this, code);
  };

  // Search for m3u8 URLs in page content and iframes
  function searchPageForM3U8() {
    // Search in all scripts
    const scripts = document.querySelectorAll("script");
    scripts.forEach((script) => {
      if (script.textContent) {
        const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
        const matches = script.textContent.match(m3u8Regex);
        if (matches) {
          matches.forEach((url) => {
            if (!detectedUrls.has(url)) {
              console.log("[SyncStream] Found m3u8 in script:", url);
              notifyBackgroundOfUrl(url);
              detectedUrls.add(url);
            }
          });
        }
      }
    });

    // Search in all iframes
    try {
      const iframes = document.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
            const content = iframeDoc.documentElement.outerHTML;
            const matches = content.match(m3u8Regex);
            if (matches) {
              matches.forEach((url) => {
                if (!detectedUrls.has(url)) {
                  console.log("[SyncStream] Found m3u8 in iframe:", url);
                  notifyBackgroundOfUrl(url);
                  detectedUrls.add(url);
                }
              });
            }
          }
        } catch (e) {
          // CORS restrictions on iframe access
        }
      });
    } catch (e) {
      // Ignore errors
    }
  }

  function notifyBackgroundOfUrl(url) {
    if (!detectedUrls.has(url)) {
      detectedUrls.add(url);
      chrome.runtime.sendMessage(
        {
          type: "M3U8_EXTRACTED",
          m3u8Url: url
        },
        () => { /* ignore response */ }
      );
    }
  }

  // Search on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", searchPageForM3U8);
  } else {
    searchPageForM3U8();
  }

  // Search periodically (every 2 seconds)
  setInterval(searchPageForM3U8, 2000);

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "GET_M3U8_URLS") {
      const urls = Array.from(detectedUrls);
      sendResponse({ urls });
    }
  });
})();
