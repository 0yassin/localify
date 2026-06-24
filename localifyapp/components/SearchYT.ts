export async function searchYoutube(query: string): Promise<string> {
  const searchurl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(searchurl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Youtube error: ${res.status}`);
    }

    const html = await res.text();
    const videoRendererRegex = /"videoRenderer"\s*:\s*\{\s*"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/;
    const match = html.match(videoRendererRegex);
    if (match && match[1]) {
      return match[1];
    }


    const fallbackRegex = /"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/;
    const fallbackMatch = html.match(fallbackRegex);
    if (fallbackMatch && fallbackMatch[1]) {
      return fallbackMatch[1];
    }

    throw new Error('Target video could not be extracted from YouTube response.');
  } catch (err) {
    console.error('YouTube scraper exception:', err);
    throw new Error('Search execution failed');
  }
}
