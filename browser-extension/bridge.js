/**
 * SyncStream Extension Bridge
 * Injects into the page to handle communication between the app and extension
 */

(function() {
  'use strict';

  let lastSearchTime = 0;
  const SEARCH_DEBOUNCE_MS = 1000;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'SYNCSTREAM_SEARCH_MOVIE') {
      const now = Date.now();
      if (now - lastSearchTime < SEARCH_DEBOUNCE_MS) return;
      lastSearchTime = now;

      try {
        chrome.runtime.sendMessage(
          {
            type: 'SEARCH_MOVIE',
            movieName: event.data.movieName,
          },
          (response) => {
            if (!response && chrome.runtime.lastError) {
              window.postMessage({
                type: 'SYNCSTREAM_SEARCH_ERROR',
                error: 'Extension not available'
              }, '*');
            }
          }
        );
      } catch (e) {
        window.postMessage({
          type: 'SYNCSTREAM_SEARCH_ERROR',
          error: 'Failed to contact extension'
        }, '*');
      }
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SYNCSTREAM_M3U8_FOUND') {
      window.postMessage({
        type: 'SYNCSTREAM_M3U8_FOUND',
        m3u8Url: request.m3u8Url
      }, '*');
      sendResponse({ success: true });
    }
  });
})();
