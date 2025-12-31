const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline');

/**
 * FlareSolverr-based scraper - More reliable for Cloudflare bypass
 * 
 * SETUP:
 * 1. Install and run FlareSolverr:
 *    docker run -d --name=flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest
 * 
 * 2. Run this script:
 *    node flaresolverr-scraper.js
 */

class FlareSolverrScraper {
    constructor(flareSolverrUrl = 'http://localhost:8191/v1') {
        this.flareSolverrUrl = flareSolverrUrl;
        this.baseUrl = 'https://www.faselhds.biz';
        this.session = null;
    }

    async createSession() {
        try {
            console.log('🔧 Creating FlareSolverr session...');
            const response = await axios.post(this.flareSolverrUrl, {
                cmd: 'sessions.create'
            });

            this.session = response.data.session;
            console.log(`✅ Session created: ${this.session}`);
            return this.session;
        } catch (error) {
            console.error('❌ Failed to create session:', error.message);
            throw error;
        }
    }

    async destroySession() {
        if (!this.session) return;

        try {
            await axios.post(this.flareSolverrUrl, {
                cmd: 'sessions.destroy',
                session: this.session
            });
            console.log('✅ Session destroyed');
        } catch (error) {
            console.error('⚠️ Failed to destroy session:', error.message);
        }
    }

    async solvePage(url, maxTimeout = 60000) {
        try {
            console.log(`🔓 Solving Cloudflare for: ${url}`);

            const response = await axios.post(this.flareSolverrUrl, {
                cmd: 'request.get',
                url: url,
                session: this.session,
                maxTimeout: maxTimeout
            }, {
                timeout: maxTimeout + 5000
            });

            if (response.data.status !== 'ok') {
                throw new Error(`FlareSolverr failed: ${response.data.message}`);
            }

            console.log('✅ Page solved successfully');

            return {
                html: response.data.solution.response,
                cookies: response.data.solution.cookies,
                userAgent: response.data.solution.userAgent,
                url: response.data.solution.url
            };
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('FlareSolverr is not running. Please start it with: docker run -d -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest');
            }
            throw error;
        }
    }

    async searchMovie(movieName) {
        try {
            console.log(`🔍 Searching for: ${movieName}`);
            const searchUrl = `${this.baseUrl}/?s=${encodeURIComponent(movieName)}`;

            const result = await this.solvePage(searchUrl);
            const $ = cheerio.load(result.html);

            // Try multiple selectors
            const selectors = [
                '.col-xl-2 a',
                '.poster a',
                'article.thumb a',
                'a[href*="/movies/"]',
                'a[href*="faselhd"]'
            ];

            let movieLink = null;

            for (const selector of selectors) {
                const element = $(selector).first();
                if (element.length) {
                    movieLink = element.attr('href');
                    if (movieLink) {
                        console.log(`✅ Found with selector: ${selector}`);
                        break;
                    }
                }
            }

            if (!movieLink) {
                // Debug: show what we got
                console.log('\n📄 Page title:', $('title').text());
                console.log('📄 Links found:', $('a').length);

                // Try to find any movie link
                $('a').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href && (href.includes('/movies/') || href.includes('/series/'))) {
                        movieLink = href;
                        return false; // break
                    }
                });
            }

            if (!movieLink) {
                throw new Error('No movies found in search results');
            }

            // Make sure URL is absolute
            if (!movieLink.startsWith('http')) {
                movieLink = this.baseUrl + movieLink;
            }

            console.log(`✅ Found movie: ${movieLink}`);
            return movieLink;
        } catch (error) {
            console.error('❌ Search failed:', error.message);
            throw error;
        }
    }

    async getServer02IframeSrc(movieUrl) {
        try {
            console.log('🔍 Looking for سيرفر المشاهدة #02 iframe...');
            const result = await this.solvePage(movieUrl);
            const $ = cheerio.load(result.html);

            // The server links are javascript:; which means they toggle visibility
            // We need to find the iframe that corresponds to server #02

            // Strategy 1: Look for iframes with data attributes or IDs related to server 2
            let iframeSrc = null;

            // Check for iframes with data-server, data-id, or similar attributes
            $('iframe').each((i, el) => {
                const dataServer = $(el).attr('data-server');
                const dataId = $(el).attr('data-id');
                const id = $(el).attr('id');
                const className = $(el).attr('class');
                const src = $(el).attr('src');

                console.log(`  Iframe [${i}]: id="${id}", class="${className}", data-server="${dataServer}", data-id="${dataId}", src="${src}"`);

                // Check if this iframe is for server 2 or #02
                if (dataServer === '2' || dataServer === '#02' ||
                    dataId === '2' || dataId === '#02' ||
                    id?.includes('2') || id?.includes('02')) {
                    iframeSrc = src;
                    if (iframeSrc) {
                        console.log(`✅ Found server #02 iframe by attribute`);
                        return false; // break
                    }
                }
            });

            // Strategy 2: Look for the second iframe (index 1)
            if (!iframeSrc) {
                const iframes = $('iframe');
                console.log(`\n� Total iframes found: ${iframes.length}`);

                if (iframes.length >= 2) {
                    iframeSrc = $(iframes[1]).attr('src'); // Get second iframe (index 1)
                    console.log(`✅ Using second iframe as server #02`);
                } else if (iframes.length === 1) {
                    iframeSrc = $(iframes[0]).attr('src');
                    console.log(`⚠️  Only one iframe found, using it`);
                }
            }

            if (!iframeSrc) {
                throw new Error('Could not find iframe for سيرفر المشاهدة #02');
            }

            // Make absolute URL
            if (!iframeSrc.startsWith('http')) {
                const baseUrl = new URL(movieUrl);
                if (iframeSrc.startsWith('//')) {
                    iframeSrc = baseUrl.protocol + iframeSrc;
                } else if (iframeSrc.startsWith('/')) {
                    iframeSrc = `${baseUrl.protocol}//${baseUrl.host}${iframeSrc}`;
                } else {
                    iframeSrc = `${baseUrl.protocol}//${baseUrl.host}/${iframeSrc}`;
                }
            }

            console.log(`🔗 Iframe URL: ${iframeSrc}`);
            return iframeSrc;
        } catch (error) {
            console.error('❌ Failed to find server #02 iframe:', error.message);
            throw error;
        }
    }

    async getM3u8FromIframe(iframeSrc) {
        try {
            console.log('🎥 Extracting m3u8 link from iframe...');

            // Get iframe content
            console.log('📥 Fetching iframe content...');
            const iframeResult = await this.solvePage(iframeSrc);
            const iframeHtml = iframeResult.html;

            // Search for m3u8 in the HTML using multiple patterns
            const patterns = [
                /https?:\/\/[^\s"']+\.m3u8[^\s"']*/g,
                /"(https?:\/\/[^"]+\.m3u8[^"]*)"/g,
                /'(https?:\/\/[^']+\.m3u8[^']*)'/g,
                /src["\s:=]+["']?(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/gi
            ];

            let m3u8Link = null;

            for (const pattern of patterns) {
                const matches = iframeHtml.match(pattern);
                if (matches && matches.length > 0) {
                    m3u8Link = matches[0]
                        .replace(/["']/g, '')
                        .replace(/^src[:\s=]+/i, '');

                    if (m3u8Link.startsWith('http')) {
                        console.log(`✅ Found m3u8 with pattern`);
                        break;
                    }
                }
            }

            if (!m3u8Link) {
                // Try with cheerio parsing
                const $ = cheerio.load(iframeHtml);

                // Look for video tag
                const video = $('video');
                if (video.length) {
                    m3u8Link = video.attr('src');
                    if (!m3u8Link) {
                        m3u8Link = video.find('source').attr('src');
                    }
                    if (m3u8Link) {
                        console.log('✅ Found m3u8 in video tag');
                    }
                }
            }

            if (!m3u8Link) {
                console.log('\n📄 Iframe HTML Preview (first 1500 chars):');
                console.log(iframeHtml.substring(0, 1500));
                throw new Error('M3U8 link not found in iframe');
            }

            console.log('✅ M3U8 link extracted successfully!');
            return m3u8Link;

        } catch (error) {
            console.error('❌ Failed to extract m3u8:', error.message);
            throw error;
        }
    }

    async scrapeMovie(movieName) {
        try {
            await this.createSession();

            // Step 1: Search for the movie
            const movieUrl = await this.searchMovie(movieName);

            // Step 2: Find سيرفر المشاهدة #02 iframe
            const iframeSrc = await this.getServer02IframeSrc(movieUrl);

            // Step 3: Extract m3u8 from iframe
            const m3u8Link = await this.getM3u8FromIframe(iframeSrc);

            return {
                movieUrl,
                iframeSrc,
                m3u8Link
            };
        } finally {
            await this.destroySession();
        }
    }
}

// CLI Interface
async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    console.log('=================================');
    console.log('🎬 FlareSolverr Movie Scraper');
    console.log('=================================');
    console.log('⚠️  Make sure FlareSolverr is running!');
    console.log('   docker run -d -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest\n');

    const scraper = new FlareSolverrScraper();

    try {
        const movieName = await question('Enter movie name: ');
        console.log('');

        const result = await scraper.scrapeMovie(movieName);

        console.log('\n=================================');
        console.log('📋 RESULTS');
        console.log('=================================');
        console.log(`Movie URL: ${result.movieUrl}`);
        console.log(`Iframe URL: ${result.iframeSrc}`);
        console.log(`\n🎥 M3U8 Link:`);
        console.log(result.m3u8Link);
        console.log('=================================\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);

        if (error.message.includes('FlareSolverr is not running')) {
            console.log('\n💡 Start FlareSolverr with:');
            console.log('   docker run -d --name=flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest');
        }
    } finally {
        rl.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = FlareSolverrScraper;