const RETRY_STATUSES = new Set([502, 503, 504]);

export async function fetchApi<T>(url: string, init?: RequestInit): Promise<T> {
  const deadline = Date.now() + 30_000;
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(url, init);
      const isRetryStatus = RETRY_STATUSES.has(res.status);
      const ct = res.headers.get('content-type') ?? '';
      const isHtmlFallback = res.ok && !ct.includes('application/json');
      if (isRetryStatus || isHtmlFallback) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 0;
        const wait = Math.min(retryAfter * 1000 || 500 * 2 ** attempt, 4000);
        if (Date.now() + wait > deadline) {
          const reason = isHtmlFallback ? `got ${ct || 'no content-type'}` : `status ${res.status}`;
          throw new Error(`backend not ready after ${attempt + 1} attempts (${reason})`);
        }
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return (await res.json()) as T;
    } catch (err) {
      if (Date.now() + 500 > deadline) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      attempt++;
    }
  }
}
