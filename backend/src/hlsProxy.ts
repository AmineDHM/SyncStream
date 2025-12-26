import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';

export const hlsProxyRouter = Router();

interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Map<string, string>;
  url: string;
  buffer: () => Promise<Buffer>;
  text: () => Promise<string>;
}

// Custom fetch function that ignores SSL certificate errors
async function fetchWithSSLBypass(
  url: string, 
  headers: Record<string, string> = {}
): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
      rejectUnauthorized: false,
    };

    const req = lib.request(options, (response) => {
      // Handle redirects (3xx)
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = response.headers.location.startsWith('http') 
          ? response.headers.location 
          : `${parsedUrl.protocol}//${parsedUrl.host}${response.headers.location}`;
        fetchWithSSLBypass(redirectUrl, headers).then(resolve).catch(reject);
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const headersMap = new Map<string, string>();
        
        Object.entries(response.headers).forEach(([key, value]) => {
          if (typeof value === 'string') headersMap.set(key.toLowerCase(), value);
          else if (Array.isArray(value)) headersMap.set(key.toLowerCase(), value[0]);
        });
        
        resolve({
          ok: response.statusCode !== undefined && response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode || 500,
          statusText: response.statusMessage || 'Unknown',
          headers: headersMap,
          url,
          buffer: async () => buffer,
          text: async () => buffer.toString('utf-8'),
        });
      });
      response.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

// Rewrite URLs in m3u8 playlist to go through proxy
function rewritePlaylist(content: string, baseUrl: string, proxyBase: string): string {
  return content.split('\n').map(line => {
    const trimmed = line.trim();
    
    // Handle EXT-X-KEY and EXT-X-MAP with URI
    if (trimmed.includes('URI="')) {
      return trimmed.replace(/URI="([^"]+)"/g, (_match, uri) => {
        const absoluteUrl = uri.startsWith('http') ? uri : baseUrl + uri;
        return `URI="${proxyBase}/proxy/hls?url=${encodeURIComponent(absoluteUrl)}"`;
      });
    }
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return line;
    }
    
    // Convert to absolute URL and proxy
    const absoluteUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
    return `${proxyBase}/proxy/hls?url=${encodeURIComponent(absoluteUrl)}`;
  }).join('\n');
}

// CORS preflight
hlsProxyRouter.options('/hls', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.status(204).end();
});

// Main proxy endpoint
hlsProxyRouter.get('/hls', async (req: Request, res: Response) => {
  const url = req.query.url as string;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  if (!url) {
    res.status(400).json({ error: 'URL parameter is required' });
    return;
  }

  try {
    const parsedUrl = new URL(url);
    const response = await fetchWithSSLBypass(url, {
      'Referer': parsedUrl.origin + '/',
    });

    if (!response.ok) {
      console.error(`Proxy error: ${response.status} ${response.statusText} for ${url}`);
      res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
      return;
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    res.setHeader('Content-Type', contentType);
    
    // Get base URL for relative path resolution
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    
    // Determine proxy base URL
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    const proxyBase = `${protocol}://${host}`;
    
    // Check if this is a playlist file
    const isPlaylist = url.endsWith('.m3u8') || 
                       contentType.includes('mpegurl') || 
                       contentType.includes('x-mpegURL');
    
    if (isPlaylist) {
      const text = await response.text();
      const rewritten = rewritePlaylist(text, baseUrl, proxyBase);
      res.send(rewritten);
    } else {
      // Binary data (segments)
      const buffer = await response.buffer();
      res.send(buffer);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch resource' });
  }
});
