// @ts-nocheck
import puppeteerCore from "puppeteer-core";
import puppeteerVanilla from "puppeteer";
import chromium from "@sparticuz/chromium";

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
  const randomDelay = () => Math.floor(Math.random() * 1500) + 500;

  try {
    // Simple mouse movement
    await page.mouse.move(100, 100);
    await sleep(randomDelay());
    await page.mouse.move(300, 300);
    await sleep(randomDelay());
  } catch (error) {
    // Ignore errors in human behavior simulation
  }
}

async function waitForCloudflareBypass(
  page: any,
  maxAttempts: number = 3
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
        document.querySelector("#challenge-form") !== null
      );
    });

    if (!isCloudflare) {
      console.log("[CloudflareBypass] Success! Cloudflare bypassed");
      return true;
    }

    console.log("[CloudflareBypass] Still on Cloudflare page, waiting...");

    // Perform human-like behavior while waiting
    await performHumanLikeBehavior(page);

    // Progressive wait times: 20s, 25s, 30s
    const waitTime = 20000 + attempt * 5000;
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

    // Use cookie from environment variable or parameter
    const cloudfareCookie = process.env.CLOUDFLARE_COOKIE;

    if (isProduction) {
      // Simplified production config - removed problematic flags
      browser = await puppeteerCore.launch({
        args: [
          ...chromium.args,
          "--disable-blink-features=AutomationControlled",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
          "--disable-software-rasterizer",
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      // Development
      const executablePath =
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        puppeteerVanilla.executablePath() ||
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

      browser = await puppeteerVanilla.launch({
        headless: "new",
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      });
    }

    console.log("[MovieScraper] Browser launched successfully");
    const page = await browser.newPage();

    // Basic stealth measures
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Override chrome property
      (window as any).chrome = {
        runtime: {},
      };

      // Override plugins
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
    });

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    // Set headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
    });

    // Set cookies if provided (THIS IS THE KEY PART!)
    if (cloudfareCookie) {
      console.log("[MovieScraper] Using provided Cloudflare cookies");

      // Parse cookie string and set cookies
      const cookies = cloudfareCookie
        .split(";")
        .map((cookie) => {
          const [name, ...valueParts] = cookie.trim().split("=");
          const value = valueParts.join("=");
          return {
            name: name.trim(),
            value: value.trim(),
            domain: ".faselhds.biz",
            path: "/",
          };
        })
        .filter((cookie) => cookie.name && cookie.value);

      await page.setCookie(...cookies);
      console.log("[MovieScraper] Cookies set:", cookies.length);
    }

    console.log("[MovieScraper] Navigating to faselhds.biz...");

    try {
      await page.goto("https://www.faselhds.biz/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      console.log("[MovieScraper] Page loaded successfully");
    } catch (error) {
      console.error("[MovieScraper] Navigation error:", error);
      throw new Error("Failed to load website");
    }

    // If cookies are set, skip Cloudflare check, otherwise do the check
    if (!cloudfareCookie) {
      // Human-like behavior
      await performHumanLikeBehavior(page);

      // Wait for Cloudflare
      console.log("[MovieScraper] Waiting for Cloudflare challenge...");
      const bypassed = await waitForCloudflareBypass(page, 3);

      if (!bypassed) {
        console.error("[MovieScraper] Failed to bypass Cloudflare");
        throw new Error("Cloudflare protection blocking access");
      }

      console.log("[MovieScraper] Successfully bypassed Cloudflare");
    } else {
      console.log("[MovieScraper] Skipping Cloudflare check (using cookies)");
      // Quick check to see if we're actually past Cloudflare
      const isCloudflare = await page.evaluate(() => {
        return document.title.toLowerCase().includes("just a moment");
      });

      if (isCloudflare) {
        console.error("[MovieScraper] Cookies invalid or expired");
        throw new Error("Cloudflare cookies are invalid or expired");
      }
    }

    await sleep(2000);

    // Search
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

    // Extract link
    const linkHref = await page.evaluate((html: string) => {
      const div = document.createElement("div");
      div.innerHTML = html;
      const firstLink = div.querySelector("a");
      return firstLink ? firstLink.href : null;
    }, searchResponse);

    console.log("[MovieScraper] Search result link:", linkHref);

    if (!linkHref) {
      return { success: false, error: "Movie not found" };
    }

    // Navigate to movie page
    await page.goto(linkHref, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await sleep(3000);

    // Extract title
    const rawTitle = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      if (h1 && h1.textContent) {
        return h1.textContent.trim();
      }
      return document.title.split("|")[0].trim();
    });

    let movieTitle = rawTitle
      .replace(/فيلم/g, "")
      .replace(/مترجم.*$/g, "")
      .replace(/اون لاين/g, "")
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

    // Extract M3U8
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

      const videos = document.querySelectorAll("video");
      for (const video of videos) {
        if (video.src && video.src.includes(".m3u8")) {
          results.push(video.src);
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
