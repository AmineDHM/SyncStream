import * as cheerio from "cheerio";
import { getFlareSolverr } from "./flareSolverr";

interface ScraperResult {
  success: boolean;
  m3u8Url?: string;
  title?: string;
  error?: string;
}

export async function extractM3U8FromMovie(movieName: string): Promise<ScraperResult> {
  const solver = getFlareSolverr();

  console.log(`[Scraper] Searching for: ${movieName}`);

  try {
    // Step 1: Search
    const searchUrl = `https://www.faselhds.biz/?s=${encodeURIComponent(movieName)}`;
    const searchHtml = await solver.fetchWithBypass(searchUrl);
    
    const $ = cheerio.load(searchHtml);
    const firstLink = $("article.post a.poster").first().attr("href") || 
                     $("article a[href*='/movies/']").first().attr("href") ||
                     $("a[href*='/movies/']").first().attr("href");
    
    if (!firstLink) {
      return { success: false, error: "Movie not found" };
    }

    console.log(`[Scraper] Found movie: ${firstLink}`);

    // Step 2: Get movie page
    const movieHtml = await solver.fetchWithBypass(firstLink);
    const $movie = cheerio.load(movieHtml);

    let movieTitle = $movie("h1").first().text().trim() || 
                     $movie("title").text().split("|")[0].trim();

    movieTitle = movieTitle
      .replace(/فيلم/g, "")
      .replace(/مترجم.*$/g, "")
      .replace(/اون لاين/g, "")
      .replace(/\d{4}/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (/[\u0600-\u06FF]/.test(movieTitle)) {
      const englishMatch = movieTitle.match(/[A-Za-z0-9\s:'-]+/g);
      if (englishMatch) {
        movieTitle = englishMatch.join(" ").trim();
      }
    }

    // Step 3: Get play button
    const playButtonLink = $movie('a.watch__btn').attr('href');
    
    if (!playButtonLink) {
      return { success: false, error: "Play button not found" };
    }

    console.log(`[Scraper] Getting video: ${playButtonLink}`);

    // Step 4: Get M3U8
    const videoHtml = await solver.fetchWithBypass(playButtonLink);
    const m3u8Matches = videoHtml.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/gi);
    
    if (m3u8Matches && m3u8Matches.length > 0) {
      console.log(`[Scraper] ✅ Success: ${movieTitle}`);
      return { success: true, m3u8Url: m3u8Matches[0], title: movieTitle };
    }

    return { success: false, error: "M3U8 link not found" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Scraper] Error: ${errorMessage}`);
    return { success: false, error: `Failed to extract M3U8: ${errorMessage}` };
  }
}
