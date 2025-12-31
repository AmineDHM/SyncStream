// @ts-nocheck
import puppeteerCore from "puppeteer-core";
import puppeteerVanilla from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";

// Add stealth plugin
puppeteer.use(StealthPlugin());

interface ScraperResult {
  success: boolean;
  m3u8Url?: string;
  title?: string;
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function extractM3U8FromMovie(
  movieName: string
): Promise<ScraperResult> {
  let browser;

  try {
    const isProduction = process.env.NODE_ENV === "production";
    console.log(`[MovieScraper] Starting search for: ${movieName}`);
    console.log(`[MovieScraper] Environment: ${isProduction ? 'production' : 'development'}`);

    // Use puppeteer-extra with stealth for both environments
    if (isProduction) {
      // For production with @sparticuz/chromium executable
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: await chromium.executablePath(),
        headless: 'new', // Use new headless mode (harder to detect)
        ignoreHTTPSErrors: true,
      });
    } else {
      // For local development with stealth mode
      const executablePath = 
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        puppeteerVanilla.executablePath() ||
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
      
      browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-web-security",
        ],
      });
    }

    console.log('[MovieScraper] Browser launched successfully');
    const page = await browser.newPage();

    // Additional stealth: override webdriver flag and other detection methods
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Override chrome property
      (window as any).chrome = {
        runtime: {},
      };
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'denied' } as PermissionStatus) :
          originalQuery(parameters)
      );
      
      // Override plugins to mimic real browser
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    // Set realistic viewport
    await page.setViewport({ width: 1920, height: 1080 });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "DNT": "1",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    });

    console.log('[MovieScraper] Navigating to faselhds.biz...');
    
    try {
      await page.goto("https://www.faselhds.biz/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      console.log('[MovieScraper] Page loaded successfully');
    } catch (error) {
      console.error('[MovieScraper] Navigation error:', error);
      throw new Error('Failed to load website - possible Cloudflare block');
    }

    // Wait for Cloudflare challenge to complete
    console.log('[MovieScraper] Waiting for Cloudflare challenge...');
    
    // Simulate mouse movement to appear more human-like
    try {
      await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200);
      await sleep(2000);
      await page.mouse.move(300 + Math.random() * 200, 300 + Math.random() * 200);
    } catch (error) {
      console.log('[MovieScraper] Mouse movement skipped');
    }
    
    await sleep(15000); // Initial wait
    
    // Check if still on Cloudflare challenge page
    const isCloudflare = await page.evaluate(() => {
      return document.title.includes('Just a moment') || 
             document.body.innerText.includes('Checking your browser') ||
             document.body.innerText.includes('Cloudflare');
    });
    
    if (isCloudflare) {
      console.log('[MovieScraper] Still on Cloudflare page, waiting much longer...');
      await sleep(25000); // Wait another 25 seconds (total 40s)
      
      // Check again
      const stillCloudflare = await page.evaluate(() => {
        return document.title.includes('Just a moment');
      });
      
      if (stillCloudflare) {
        console.log('[MovieScraper] Still blocked, one more attempt...');
        await sleep(15000); // Final wait
        
        const finalCheck = await page.evaluate(() => {
          return document.title.includes('Just a moment');
        });
        
        if (finalCheck) {
          console.error('[MovieScraper] Cloudflare challenge did not complete after 55s');
          throw new Error('Cloudflare protection blocking access');
        }
      }
    }
    
    console.log('[MovieScraper] Cloudflare check passed, proceeding with search...');

    const searchResponse = await page.evaluate(
      async (searchQuery: string) => {
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
      },
      movieName
    );

    console.log('[MovieScraper] Search response length:', searchResponse.length);
    console.log('[MovieScraper] Search response preview:', searchResponse.substring(0, 200));

    // Parse HTML to extract link - simpler approach
    const linkHref = await page.evaluate((html: string) => {
      // Create a temporary div to parse HTML
      const div = document.createElement('div');
      div.innerHTML = html;
      const firstLink = div.querySelector("a");
      return firstLink ? firstLink.href : null;
    }, searchResponse);

    console.log('[MovieScraper] Search result link:', linkHref);

    if (!linkHref) {
      console.log('[MovieScraper] No link found in search results');
      return { success: false, error: "Movie not found" };
    }

    await page.goto(linkHref, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await sleep(5000);

    // Extract movie title
    // @ts-ignore
    const rawTitle = await page.evaluate(() => {
      // Try to get title from h1 or page title
      const h1 = document.querySelector("h1");
      if (h1 && h1.textContent) {
        return h1.textContent.trim();
      }
      // Fallback to page title
      return document.title.split("|")[0].trim();
    });

    // Parse the title to extract just the movie name
    // Remove Arabic text, year, and extra text - keep only the movie name
    let movieTitle = rawTitle;
    
    // Remove common Arabic phrases and patterns
    movieTitle = movieTitle
      .replace(/فيلم/g, "") // Remove "فيلم"
      .replace(/مترجم.*$/g, "") // Remove "مترجم" and everything after
      .replace(/اون لاين/g, "") // Remove "اون لاين"
      .replace(/فاصل إعلاني/g, "") // Remove "فاصل إعلاني"
      .replace(/\d{4}/g, "") // Remove year (4 digits)
      .replace(/\s+-\s+/g, " ") // Clean up dashes
      .replace(/\s+/g, " ") // Clean up multiple spaces
      .trim();
    
    // If still has Arabic characters, try to extract English text only
    if (/[\u0600-\u06FF]/.test(movieTitle)) {
      const englishMatch = movieTitle.match(/[A-Za-z0-9\s:'-]+/g);
      if (englishMatch) {
        movieTitle = englishMatch.join(" ").trim();
      }
    }

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
      return { success: true, m3u8Url: uniqueLinks[0], title: movieTitle };
    }

    return { success: false, error: "No M3U8 link found" };
  } catch (error) {
    console.error('[MovieScraper] Error:', error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error('[MovieScraper] Error message:', errorMessage);
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
