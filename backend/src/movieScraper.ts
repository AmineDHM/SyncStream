import * as cheerio from "cheerio";
import { getFlareSolverr } from "./flareSolverr";

interface ScraperResult {
  success: boolean;
  m3u8Url?: string;
  title?: string;
  error?: string;
}

export class MovieScraper {
  private baseUrl = 'https://www.faselhds.biz';
  private solver = getFlareSolverr();

  private async searchMovie(movieName: string): Promise<string> {
    const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(movieName)}`;
    const html = await this.solver.fetchPage(searchUrl);
    const $ = cheerio.load(html);

    const movieLink = $('.col-xl-2 a').first().attr('href') ||
                      $('.poster a').first().attr('href') ||
                      $('a[href*="/movies/"]').first().attr('href');

    if (!movieLink) {
      throw new Error('Movie not found');
    }

    return movieLink.startsWith('http') ? movieLink : this.baseUrl + movieLink;
  }

  private async getServer02Iframe(movieUrl: string): Promise<string> {
    const html = await this.solver.fetchPage(movieUrl);
    const $ = cheerio.load(html);

    const iframes = $('iframe');
    const iframeSrc = iframes.length >= 2 
      ? $(iframes[1]).attr('src')  // Server #02 is second iframe
      : $(iframes[0]).attr('src'); // Fallback to first

    if (!iframeSrc) {
      throw new Error('No iframe found');
    }

    // Make absolute URL
    if (iframeSrc.startsWith('//')) {
      return 'https:' + iframeSrc;
    } else if (iframeSrc.startsWith('/')) {
      const base = new URL(movieUrl);
      return `${base.protocol}//${base.host}${iframeSrc}`;
    }

    return iframeSrc;
  }

  private async extractM3u8(iframeUrl: string): Promise<string> {
    const html = await this.solver.fetchPage(iframeUrl);
    
    // Extract m3u8 URL from iframe HTML
    const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
    
    if (!m3u8Match) {
      throw new Error('M3U8 link not found');
    }

    return m3u8Match[0];
  }

  private extractTitle(html: string): string {
    const $ = cheerio.load(html);
    let title = $("h1").first().text().trim() || $("title").text().split("|")[0].trim();

    // Clean Arabic text and extract English title
    title = title
      .replace(/فيلم|مترجم.*$|اون لاين|\d{4}/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (/[\u0600-\u06FF]/.test(title)) {
      const englishMatch = title.match(/[A-Za-z0-9\s:'-]+/g);
      if (englishMatch) {
        title = englishMatch.join(" ").trim();
      }
    }

    return title || 'Unknown Movie';
  }

  async scrapeMovie(movieName: string): Promise<ScraperResult> {
    try {
      await this.solver.createSession();

      // 1. Search and get movie page URL
      const movieUrl = await this.searchMovie(movieName);
      
      // 2. Get movie page and extract title
      const movieHtml = await this.solver.fetchPage(movieUrl);
      const title = this.extractTitle(movieHtml);

      // 3. Get Server #02 iframe URL
      const iframeUrl = await this.getServer02Iframe(movieUrl);

      // 4. Extract m3u8 from iframe
      const m3u8Url = await this.extractM3u8(iframeUrl);

      console.log(`[Scraper] ✅ ${title} - ${m3u8Url}`);

      return { success: true, m3u8Url, title };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Scraper] ❌ ${errorMessage}`);
      return { success: false, error: errorMessage };
    } finally {
      await this.solver.destroySession();
    }
  }
}

export async function extractM3U8FromMovie(movieName: string): Promise<ScraperResult> {
  const scraper = new MovieScraper();
  return scraper.scrapeMovie(movieName);
}
