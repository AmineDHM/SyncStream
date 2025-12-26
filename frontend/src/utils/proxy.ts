const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Convert an HLS URL to use our proxy to bypass CORS
 */
export function getProxiedUrl(url: string): string {
  // Don't proxy if it's already a localhost URL or our own server
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return url;
  }
  
  // Don't double-proxy
  if (url.includes('/proxy/hls')) {
    return url;
  }
  
  return `${BACKEND_URL}/proxy/hls?url=${encodeURIComponent(url)}`;
}

/**
 * Check if a URL needs proxying (external HLS streams)
 */
export function needsProxy(url: string): boolean {
  if (!url) return false;
  
  // Local URLs don't need proxy
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return false;
  }
  
  // HLS streams need proxy
  if (url.includes('.m3u8')) {
    return true;
  }
  
  return false;
}
