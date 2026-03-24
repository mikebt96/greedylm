/**
 * Returns the API base URL, auto-upgrading http → https when the page
 * is served over HTTPS (prevents Mixed Content browser errors).
 */
export function getApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    raw.startsWith('http:')
  ) {
    return raw.replace('http:', 'https:');
  }
  return raw;
}
