// @ts-nocheck
import puppeteer from "puppeteer";

interface ScraperResult {
  success: boolean;
  m3u8Url?: string;
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
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

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

    const linkHref = await page.evaluate((html: string) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const firstLink = doc.querySelector("a");
      return firstLink ? firstLink.href : null;
    }, searchResponse);

    if (!linkHref) {
      return { success: false, error: "Movie not found" };
    }

    await page.goto(linkHref, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await sleep(3000);

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
      return { success: true, m3u8Url: uniqueLinks[0] };
    }

    return { success: false, error: "No M3U8 link found" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
