import axios from 'axios';

/**
 * Scraper Client - Calls external scraper service (deployed on Replit)
 * The scraper service runs Puppeteer to bypass Cloudflare
 */
export class ScraperClient {
  private scraperUrl: string;

  constructor() {
    // Set your Replit scraper URL here or via env variable
    this.scraperUrl = process.env.SCRAPER_URL || 'http://localhost:3000';
  }

  async scrapeMovie(movieName: string): Promise<{ success: boolean; m3u8Url?: string; title?: string; error?: string }> {
    try {
      console.log(`[Scraper] Calling scraper service for: ${movieName}`);
      
      const { data } = await axios.post(
        `${this.scraperUrl}/scrape`,
        { movieName },
        { timeout: 120000 } // 2 min timeout for full scrape
      );

      if (data.success) {
        console.log(`[Scraper] ✅ Got m3u8 for: ${data.title}`);
        return {
          success: true,
          m3u8Url: data.m3u8Url,
          title: data.title,
        };
      }

      return { success: false, error: data.error || 'Unknown error' };
    } catch (error) {
      const msg = axios.isAxiosError(error) 
        ? error.response?.data?.error || error.message
        : 'Unknown error';
      console.error(`[Scraper] ❌ ${msg}`);
      return { success: false, error: msg };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { data } = await axios.get(this.scraperUrl, { timeout: 5000 });
      return data?.status === 'ok';
    } catch {
      return false;
    }
  }
}

let instance: ScraperClient | null = null;

export function getScraperClient(): ScraperClient {
  if (!instance) {
    instance = new ScraperClient();
  }
  return instance;
}

// Backward compatibility
export { ScraperClient as StealthClient, ScraperClient as FlareSolverrClient };
export const getStealthBrowser = getScraperClient;
export const getFlareSolverr = getScraperClient;
