import { ScraperClient, getScraperClient } from "./flareSolverr";

interface ScraperResult {
  success: boolean;
  m3u8Url?: string;
  title?: string;
  error?: string;
}

export class MovieScraper {
  private client: ScraperClient;

  constructor() {
    this.client = getScraperClient();
  }

  async scrapeMovie(movieName: string): Promise<ScraperResult> {
    return this.client.scrapeMovie(movieName);
  }
}

export async function extractM3U8FromMovie(movieName: string): Promise<ScraperResult> {
  const scraper = new MovieScraper();
  return scraper.scrapeMovie(movieName);
}
