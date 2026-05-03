/**
 * Resolved API origin for the browser.
 *
 * If you open Next via “Network” (e.g. http://192.168.x.x:3000) while
 * NEXT_PUBLIC_API_BASE_URL is still http://127.0.0.1:8000, fetch would target
 * the wrong host (this machine’s loopback from the browser’s point of view).
 * In development we therefore point at the same hostname as the page, with the
 * API port from env (default 8000).
 *
 * Run the API on all interfaces: `uvicorn ... --host 0.0.0.0 --port 8000`
 */
const FALLBACK = 'http://127.0.0.1:8000';

export function getApiBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim() || FALLBACK;

  if (typeof window === 'undefined') {
    return fromEnv;
  }

  if (process.env.NODE_ENV !== 'development') {
    return fromEnv;
  }

  const pageHost = window.location.hostname;
  if (pageHost === 'localhost' || pageHost === '127.0.0.1') {
    return fromEnv;
  }

  try {
    const u = new URL(fromEnv);
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
      u.hostname = pageHost;
      return u.href.replace(/\/$/, '');
    }
  } catch {
    /* ignore */
  }

  return fromEnv;
}
