/**
 * Background Service Worker for SyncStream Extension
 * Handles movie searches, opens tabs, monitors for m3u8 extraction, and closes tabs
 */

// Map to track active searches
const activeSearches = new Map();

console.log("[SyncStream] Background service worker initialized");

// Listen for messages from content script, popup, and app
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(
    "[SyncStream] Message received:",
    request.type,
    "from tab:",
    sender.tab?.id
  );

  if (request.type === "SEARCH_MOVIE") {
    console.log("[SyncStream] Starting search for:", request.movieName);

    // Get the tab ID - either from sender.tab or query for the active tab
    if (sender.tab && sender.tab.id) {
      handleMovieSearch(request.movieName, sender.tab.id);
      sendResponse({ success: true });
    } else {
      // Message came from extension context (bridge), find the active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          handleMovieSearch(request.movieName, tabs[0].id);
          sendResponse({ success: true });
        } else {
          console.error("[SyncStream] No active tab found");
          sendResponse({ success: false, error: "No active tab" });
        }
      });
      return true; // Keep channel open for async response
    }
  } else if (request.type === "M3U8_EXTRACTED") {
    console.log("[SyncStream] M3U8 extracted:", request.m3u8Url);
    if (sender.tab && sender.tab.id) {
      handleM3U8Detected(request.m3u8Url, sender.tab.id);
    }
    sendResponse({ success: true });
  }

  return true; // Keep channel open for async response
});

async function handleMovieSearch(movieName, originTabId) {
  console.log(
    `[SyncStream] handleMovieSearch called for: ${movieName}, originTabId: ${originTabId}`
  );

  const searchUrl = "https://www.faselhds.biz";
  const baseUrl = "https://syncrostream.netlify.app";

  console.log(
    `[SyncStream] Using URLs - Search: ${searchUrl}, Base: ${baseUrl}`
  );

  // Create search URL
  const searchQuery = encodeURIComponent(movieName);
  const searchPageUrl = `${searchUrl}/?s=${searchQuery}`;

  console.log(`[SyncStream] Opening search page: ${searchPageUrl}`);

  // Store the search request
  const searchId = `search_${Date.now()}`;
  activeSearches.set(searchId, {
    movieName,
    originTabId,
    baseUrl,
    searchPageUrl,
    startTime: Date.now(),
    tabId: null,
    found: false,
  });

  // Open a new tab for the search
  try {
    const tab = await chrome.tabs.create({ url: searchPageUrl, active: false });

    if (tab && tab.id) {
      const search = activeSearches.get(searchId);
      if (search) {
        search.tabId = tab.id;
        console.log(`[SyncStream] Search tab opened with ID: ${tab.id}`);

        // Wait for the tab to load, then inject the movie name into storage for the automator
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            console.log(
              "[SyncStream] Search tab loaded, automator should activate"
            );
          }
        });

        // Set a timeout to close the tab if no m3u8 is found
        setTimeout(() => {
          const currentSearch = activeSearches.get(searchId);
          if (currentSearch && !currentSearch.found) {
            console.log(`[SyncStream] Search timeout for movie: ${movieName}`);
            activeSearches.delete(searchId);
            // Close the tab
            chrome.tabs.remove(currentSearch.tabId).catch((err) => {
              console.log("[SyncStream] Failed to close tab:", err);
            });
          }
        }, 60000); // 60 second timeout
      }
    }
  } catch (error) {
    console.error("[SyncStream] Error opening tab:", error);
  }
}

function handleM3U8Detected(m3u8Url, tabId) {
  console.log(`[SyncStream] Detected m3u8 URL: ${m3u8Url} on tab ${tabId}`);

  // Find the matching search
  for (const [searchId, search] of activeSearches) {
    if (search.tabId === tabId && !search.found) {
      handleM3U8Extracted(m3u8Url, tabId, searchId);
      return;
    }
  }
}

async function handleM3U8Extracted(m3u8Url, tabId, searchId) {
  console.log(
    `[SyncStream] handleM3U8Extracted called: URL=${m3u8Url}, tabId=${tabId}, searchId=${searchId}`
  );

  if (!searchId) {
    // Find the search that matches this tab
    for (const [id, search] of activeSearches) {
      if (search.tabId === tabId && !search.found) {
        searchId = id;
        console.log(`[SyncStream] Found matching search: ${searchId}`);
        break;
      }
    }
  }

  if (!searchId) {
    console.log("[SyncStream] No matching search found for tab:", tabId);
    return;
  }

  const search = activeSearches.get(searchId);
  if (!search) {
    console.log("[SyncStream] Search not found in map");
    return;
  }

  if (search.found) {
    console.log("[SyncStream] Search already processed, skipping duplicate");
    return;
  }

  // Mark as found to prevent duplicates
  search.found = true;

  console.log(
    `[SyncStream] Processing m3u8 - closing tab ${search.tabId}, navigating tab ${search.originTabId}`
  );

  // Close the search tab
  if (search.tabId) {
    chrome.tabs.remove(search.tabId).catch((err) => {
      console.log("[SyncStream] Failed to close search tab:", err);
    });
  }

  // Send m3u8 URL to the page via bridge (app will handle streaming)
  console.log(`[SyncStream] Sending m3u8 to app: ${m3u8Url}`);
  
  try {
    await chrome.tabs.sendMessage(search.originTabId, {
      type: "SYNCSTREAM_M3U8_FOUND",
      m3u8Url: m3u8Url,
    });
    console.log("[SyncStream] Message sent successfully");
  } catch (err) {
    console.log("[SyncStream] Failed to send message, using URL fallback:", err);
    // Fallback: navigate with URL param
    const syncStreamUrl = `${search.baseUrl}?videoUrl=${encodeURIComponent(m3u8Url)}`;
    await chrome.tabs.update(search.originTabId, { url: syncStreamUrl }).catch(() => {
      chrome.windows.create({ url: syncStreamUrl });
    });
  }

  // Remove from active searches
  activeSearches.delete(searchId);
  console.log("[SyncStream] Search completed and cleaned up");
}

console.log("[SyncStream] Service worker ready");
