const TIMEOUT_MS = 10000; // 10 seconds

export async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();

  const t = setTimeout(() => controller.abort(), TIMEOUT_MS); // abort when timeout is reached
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Generic user agent for requests
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/122 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', // HTML preference
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(t);
  }
}
