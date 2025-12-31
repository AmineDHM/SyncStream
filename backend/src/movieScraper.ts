// @ts-nocheck
import puppeteerCore from "puppeteer-core";
import puppeteer from "puppeteer";
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

export async function extractM3U8FromMovie(
  movieName: string
): Promise<ScraperResult> {
  let browser;

  try {
    const isProduction = process.env.NODE_ENV === "production";
    console.log(`[MovieScraper] Starting search for: ${movieName}`);
    console.log(`[MovieScraper] Environment: ${isProduction ? 'production' : 'development'}`);

    // Use @sparticuz/chromium for serverless environments, puppeteer for local
    if (isProduction) {
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      // For local development, try to find Chrome/Chromium
      const executablePath = 
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"; // Default Windows path
      
      browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      });
    }

    console.log('[MovieScraper] Browser launched successfully');
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });

    await page.goto("https://www.faselhds.biz/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await sleep(5000);

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
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await sleep(3000);

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
