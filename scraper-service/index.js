const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BASE_URL = 'https://www.faselhds.biz';

// Browser instance (reuse for performance)
let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    });
  }
  return browser;
}

async function fetchWithBrowser(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Stealth settings
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Block unnecessary resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for Cloudflare to resolve
    await page.waitForFunction(
      () => !document.body.innerText.includes('Just a moment'),
      { timeout: 30000 }
    ).catch(() => {});

    const html = await page.content();
    return html;
  } finally {
    await page.close();
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'SyncStream Scraper' });
});

// Search movie
app.post('/search', async (req, res) => {
  const { movieName } = req.body;
  
  if (!movieName) {
    return res.status(400).json({ error: 'movieName required' });
  }

  try {
    console.log(`Searching: ${movieName}`);
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(movieName)}`;
    const html = await fetchWithBrowser(searchUrl);
    const $ = cheerio.load(html);

    const movieLink = $('.col-xl-2 a').first().attr('href') ||
                      $('.poster a').first().attr('href') ||
                      $('a[href*="/movies/"]').first().attr('href');

    if (!movieLink) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const fullUrl = movieLink.startsWith('http') ? movieLink : BASE_URL + movieLink;
    res.json({ success: true, movieUrl: fullUrl });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get iframe from movie page
app.post('/iframe', async (req, res) => {
  const { movieUrl } = req.body;
  
  if (!movieUrl) {
    return res.status(400).json({ error: 'movieUrl required' });
  }

  try {
    console.log(`Getting iframe: ${movieUrl}`);
    const html = await fetchWithBrowser(movieUrl);
    const $ = cheerio.load(html);

    // Extract title
    let title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
    title = title.replace(/فيلم|مترجم.*$|اون لاين|\d{4}/g, '').replace(/\s+/g, ' ').trim();
    
    if (/[\u0600-\u06FF]/.test(title)) {
      const match = title.match(/[A-Za-z0-9\s:'-]+/g);
      if (match) title = match.join(' ').trim();
    }

    // Get second iframe (Server #02)
    const iframes = $('iframe');
    let iframeSrc = iframes.length >= 2 
      ? $(iframes[1]).attr('src')
      : $(iframes[0]).attr('src');

    if (!iframeSrc) {
      return res.status(404).json({ error: 'No iframe found' });
    }

    // Make absolute
    if (iframeSrc.startsWith('//')) {
      iframeSrc = 'https:' + iframeSrc;
    } else if (iframeSrc.startsWith('/')) {
      const base = new URL(movieUrl);
      iframeSrc = `${base.protocol}//${base.host}${iframeSrc}`;
    }

    res.json({ success: true, iframeUrl: iframeSrc, title: title || 'Unknown' });
  } catch (error) {
    console.error('Iframe error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Extract m3u8 from iframe
app.post('/m3u8', async (req, res) => {
  const { iframeUrl } = req.body;
  
  if (!iframeUrl) {
    return res.status(400).json({ error: 'iframeUrl required' });
  }

  try {
    console.log(`Extracting m3u8: ${iframeUrl}`);
    const html = await fetchWithBrowser(iframeUrl);
    
    const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);
    
    if (!m3u8Match) {
      return res.status(404).json({ error: 'M3U8 not found' });
    }

    res.json({ success: true, m3u8Url: m3u8Match[0] });
  } catch (error) {
    console.error('M3U8 error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Full scrape in one call
app.post('/scrape', async (req, res) => {
  const { movieName } = req.body;
  
  if (!movieName) {
    return res.status(400).json({ error: 'movieName required' });
  }

  try {
    console.log(`Full scrape: ${movieName}`);
    
    // 1. Search
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(movieName)}`;
    const searchHtml = await fetchWithBrowser(searchUrl);
    let $ = cheerio.load(searchHtml);

    const movieLink = $('.col-xl-2 a').first().attr('href') ||
                      $('.poster a').first().attr('href') ||
                      $('a[href*="/movies/"]').first().attr('href');

    if (!movieLink) {
      return res.status(404).json({ success: false, error: 'Movie not found' });
    }

    const movieUrl = movieLink.startsWith('http') ? movieLink : BASE_URL + movieLink;

    // 2. Get movie page
    const movieHtml = await fetchWithBrowser(movieUrl);
    $ = cheerio.load(movieHtml);

    let title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
    title = title.replace(/فيلم|مترجم.*$|اون لاين|\d{4}/g, '').replace(/\s+/g, ' ').trim();
    if (/[\u0600-\u06FF]/.test(title)) {
      const match = title.match(/[A-Za-z0-9\s:'-]+/g);
      if (match) title = match.join(' ').trim();
    }

    const iframes = $('iframe');
    let iframeSrc = iframes.length >= 2 ? $(iframes[1]).attr('src') : $(iframes[0]).attr('src');

    if (!iframeSrc) {
      return res.status(404).json({ success: false, error: 'No iframe found' });
    }

    if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
    else if (iframeSrc.startsWith('/')) {
      const base = new URL(movieUrl);
      iframeSrc = `${base.protocol}//${base.host}${iframeSrc}`;
    }

    // 3. Get m3u8
    const iframeHtml = await fetchWithBrowser(iframeSrc);
    const m3u8Match = iframeHtml.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/);

    if (!m3u8Match) {
      return res.status(404).json({ success: false, error: 'M3U8 not found' });
    }

    console.log(`✅ Success: ${title}`);
    res.json({
      success: true,
      title: title || 'Unknown Movie',
      m3u8Url: m3u8Match[0],
    });
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cleanup on exit
process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Scraper service running on port ${PORT}`);
});
