// @ts-nocheck
import puppeteerCore from "puppeteer-core";
import puppeteerVanilla from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AnonimizeUAPlugin from "puppeteer-extra-plugin-anonymize-ua";
import chromium from "@sparticuz/chromium";

// Add stealth plugin with custom evasions
const stealthPlugin = StealthPlugin();
// Remove this specific stealth plugin check that can be detected
stealthPlugin.enabledEvasions.delete("chrome.runtime");
stealthPlugin.enabledEvasions.delete("navigator.plugins");

puppeteer.use(stealthPlugin);
puppeteer.use(AnonimizeUAPlugin());

interface ScraperResult {
  success: boolean;
  m3u8Url?: string;
  title?: string;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performHumanLikeBehavior(page: any): Promise<void> {
  const randomDelay = () => Math.floor(Math.random() * 2000) + 1000;

  try {
    // Natural mouse movements
    await page.mouse.move(0, 0);
    await sleep(randomDelay());

    // Simulate reading/browsing behavior
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(Math.random() * 800) + 100;
      const y = Math.floor(Math.random() * 600) + 100;
      await page.mouse.move(x, y, {
        steps: 10 + Math.floor(Math.random() * 10),
      });
      await sleep(randomDelay());
    }

    // Random scroll
    await page.evaluate(() => {
      window.scrollTo({
        top: Math.random() * 200,
        behavior: "smooth",
      });
    });

    await sleep(randomDelay());

    // Random keyboard interaction
    await page.keyboard.press("Tab");
    await sleep(300 + Math.random() * 500);
  } catch (error) {
    console.log("[HumanBehavior] Error simulating behavior:", error);
  }
}

async function waitForCloudflareBypass(
  page: any,
  maxAttempts: number = 4
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[CloudflareBypass] Attempt ${attempt}/${maxAttempts}`);

    const isCloudflare = await page.evaluate(() => {
      const title = document.title.toLowerCase();
      const bodyText = document.body.innerText.toLowerCase();

      return (
        title.includes("just a moment") ||
        title.includes("attention required") ||
        bodyText.includes("checking your browser") ||
        bodyText.includes("cloudflare") ||
        bodyText.includes("ddos protection") ||
        document.querySelector("#challenge-form") !== null ||
        document.querySelector(".challenge-form") !== null
      );
    });

    if (!isCloudflare) {
      console.log("[CloudflareBypass] Success! Cloudflare bypassed");
      return true;
    }

    console.log("[CloudflareBypass] Still on Cloudflare page, waiting...");

    // Perform human-like behavior while waiting
    await performHumanLikeBehavior(page);

    // Progressive wait times
    const waitTime = 15000 * attempt; // 15s, 30s, 45s, 60s
    await sleep(waitTime);
  }

  return false;
}

export async function extractM3U8FromMovie(
  movieName: string
): Promise<ScraperResult> {
  let browser;

  try {
    const isProduction = process.env.NODE_ENV === "production";
    console.log(`[MovieScraper] Starting search for: ${movieName}`);
    console.log(
      `[MovieScraper] Environment: ${
        isProduction ? "production" : "development"
      }`
    );

    if (isProduction) {
      // Production with enhanced anti-detection
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-site-isolation-trials",
          "--disable-web-security",
          "--disable-features=BlockInsecurePrivateNetworkRequests",
          "--aggressive-cache-discard",
          "--disable-cache",
          "--disable-application-cache",
          "--disable-offline-load-stale-cache",
          "--disk-cache-size=0",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-dev-tools",
          "--no-default-browser-check",
          "--no-first-run",
          "--disable-default-apps",
          "--enable-features=NetworkService,NetworkServiceInProcess",
          "--disable-features=VizDisplayCompositor",
        ],
        defaultViewport: null,
        executablePath: await chromium.executablePath(),
        headless: "new",
        ignoreHTTPSErrors: true,
        protocolTimeout: 180000,
      });
    } else {
      // Development with stealth mode
      const executablePath =
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        puppeteerVanilla.executablePath() ||
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

      browser = await puppeteer.launch({
        headless: "new",
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-site-isolation-trials",
        ],
        defaultViewport: null,
        ignoreHTTPSErrors: true,
      });
    }

    console.log("[MovieScraper] Browser launched successfully");
    const page = await browser.newPage();

    // Enhanced stealth measures
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver flags
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Override navigator properties
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en", "ar"],
      });

      Object.defineProperty(navigator, "platform", {
        get: () => "Win32",
      });

      // Mock chrome runtime
      (window as any).chrome = {
        runtime: {
          connect: () => {},
          sendMessage: () => {},
          onMessage: {
            addListener: () => {},
            removeListener: () => {},
          },
        },
        loadTimes: () => {},
        csi: () => {},
        app: {},
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({
              state: Notification.permission,
            } as PermissionStatus)
          : originalQuery(parameters);

      // Mock plugins
      Object.defineProperty(navigator, "plugins", {
        get: () => [
          {
            0: {
              type: "application/x-google-chrome-pdf",
              suffixes: "pdf",
              description: "Portable Document Format",
              enabledPlugin: Plugin,
            },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin",
          },
          {
            0: {
              type: "application/pdf",
              suffixes: "pdf",
              description: "",
              enabledPlugin: Plugin,
            },
            description: "",
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer",
          },
          {
            0: {
              type: "application/x-nacl",
              suffixes: "",
              description: "Native Client Executable",
              enabledPlugin: Plugin,
            },
            1: {
              type: "application/x-pnacl",
              suffixes: "",
              description: "Portable Native Client Executable",
              enabledPlugin: Plugin,
            },
            description: "",
            filename: "internal-nacl-plugin",
            length: 2,
            name: "Native Client",
          },
        ],
      });

      // Override toString to hide modifications
      const originalToString = Function.prototype.toString;
      Function.prototype.toString = function () {
        if (this === window.navigator.permissions.query) {
          return "function query() { [native code] }";
        }
        if (this === originalToString) {
          return "function toString() { [native code] }";
        }
        return originalToString.call(this);
      };

      // Add connection properties
      Object.defineProperty(navigator, "connection", {
        get: () => ({
          effectiveType: "4g",
          rtt: 50,
          downlink: 10,
          saveData: false,
        }),
      });

      // Mock battery API
      Object.defineProperty(navigator, "getBattery", {
        get: () => () =>
          Promise.resolve({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1,
          }),
      });

      // Override hardware concurrency
      Object.defineProperty(navigator, "hardwareConcurrency", {
        get: () => 8,
      });

      // Override deviceMemory
      Object.defineProperty(navigator, "deviceMemory", {
        get: () => 8,
      });
    });

    // Set realistic viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });

    // Use a recent, realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    // Set realistic headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      DNT: "1",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
    });

    console.log("[MovieScraper] Navigating to faselhds.biz...");

    try {
      await page.goto("https://www.faselhds.biz/", {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      console.log("[MovieScraper] Page loaded successfully");
    } catch (error) {
      console.error("[MovieScraper] Navigation error:", error);
      throw new Error("Failed to load website - possible network issue");
    }

    // Perform initial human-like behavior
    await performHumanLikeBehavior(page);

    // Wait for Cloudflare challenge with retries
    console.log("[MovieScraper] Waiting for Cloudflare challenge...");
    const bypassed = await waitForCloudflareBypass(page, 4);

    if (!bypassed) {
      console.error(
        "[MovieScraper] Failed to bypass Cloudflare after multiple attempts"
      );
      throw new Error(
        "Cloudflare protection blocking access - exhausted retry attempts"
      );
    }

    console.log(
      "[MovieScraper] Successfully bypassed Cloudflare, proceeding with search..."
    );

    // Additional wait to ensure page is fully loaded
    await sleep(3000);

    // Perform search
    const searchResponse = await page.evaluate(async (searchQuery: string) => {
      const formData = new URLSearchParams();
      formData.append("action", "dtc_live");
      formData.append("trsearch", searchQuery);

      const response = await fetch(
        "https://www.faselhds.biz/wp-admin/admin-ajax.php",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: formData,
        }
      );

      return await response.text();
    }, movieName);

    console.log(
      "[MovieScraper] Search response length:",
      searchResponse.length
    );
    console.log(
      "[MovieScraper] Search response preview:",
      searchResponse.substring(0, 200)
    );

    // Parse HTML to extract link
    const linkHref = await page.evaluate((html: string) => {
      const div = document.createElement("div");
      div.innerHTML = html;
      const firstLink = div.querySelector("a");
      return firstLink ? firstLink.href : null;
    }, searchResponse);

    console.log("[MovieScraper] Search result link:", linkHref);

    if (!linkHref) {
      console.log("[MovieScraper] No link found in search results");
      return { success: false, error: "Movie not found" };
    }

    // Navigate to movie page
    await page.goto(linkHref, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await sleep(5000);

    // Extract movie title
    const rawTitle = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      if (h1 && h1.textContent) {
        return h1.textContent.trim();
      }
      return document.title.split("|")[0].trim();
    });

    // Parse the title to extract just the movie name
    let movieTitle = rawTitle
      .replace(/فيلم/g, "")
      .replace(/مترجم.*$/g, "")
      .replace(/اون لاين/g, "")
      .replace(/فاصل إعلاني/g, "")
      .replace(/\d{4}/g, "")
      .replace(/\s+-\s+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/[\u0600-\u06FF]/.test(movieTitle)) {
      const englishMatch = movieTitle.match(/[A-Za-z0-9\s:'-]+/g);
      if (englishMatch) {
        movieTitle = englishMatch.join(" ").trim();
      }
    }

    // Click server button
    await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("a, button, li"));
      const button = elements.find(
        (el) =>
          el.textContent.includes("سيرفر المشاهدة #02") ||
          el.textContent.includes("02#")
      );

      if (button) {
        (button as HTMLElement).click();
        return;
      }

      const lis = document.querySelectorAll("li");
      for (const li of lis) {
        if (li.textContent && li.textContent.includes("02")) {
          li.click();
          break;
        }
      }
    });

    await sleep(3000);

    // Extract M3U8 links
    const m3u8Links = await page.evaluate(() => {
      const results: string[] = [];
      const m3u8Regex = /(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi;

      const htmlContent = document.documentElement.outerHTML;
      const matches = htmlContent.match(m3u8Regex);
      if (matches) {
        results.push(...matches);
      }

      const scripts = document.querySelectorAll("script");
      for (const script of scripts) {
        const scriptMatches = script.textContent?.match(m3u8Regex);
        if (scriptMatches) {
          results.push(...scriptMatches);
        }
      }

      const allElements = document.querySelectorAll("*");
      for (const el of allElements) {
        for (const attr of el.attributes) {
          if (attr.value && attr.value.includes(".m3u8")) {
            const attrMatches = attr.value.match(m3u8Regex);
            if (attrMatches) {
              results.push(...attrMatches);
            }
          }
        }
      }

      const iframes = document.querySelectorAll("iframe");
      for (const iframe of iframes) {
        if (iframe.src && iframe.src.includes(".m3u8")) {
          results.push(iframe.src);
        }
        try {
          const iframeDoc =
            iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const iframeHTML = iframeDoc.documentElement.outerHTML;
            const iframeMatches = iframeHTML.match(m3u8Regex);
            if (iframeMatches) {
              results.push(...iframeMatches);
            }
          }
        } catch (e) {
          // Cross-origin iframe
        }
      }

      const videos = document.querySelectorAll("video");
      for (const video of videos) {
        if (video.src && video.src.includes(".m3u8")) {
          results.push(video.src);
        }
        if (video.currentSrc && video.currentSrc.includes(".m3u8")) {
          results.push(video.currentSrc);
        }
        const sources = video.querySelectorAll("source");
        for (const source of sources) {
          if (source.src && source.src.includes(".m3u8")) {
            results.push(source.src);
          }
        }
      }

      return results;
    });

    if (m3u8Links.length > 0) {
      const uniqueLinks = [...new Set(m3u8Links)];
      console.log("[MovieScraper] Found M3U8 links:", uniqueLinks.length);
      return { success: true, m3u8Url: uniqueLinks[0], title: movieTitle };
    }

    return { success: false, error: "No M3U8 link found" };
  } catch (error) {
    console.error("[MovieScraper] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[MovieScraper] Error message:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
