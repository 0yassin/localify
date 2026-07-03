
const API_URL = process.env.EXPO_PUBLIC_API_URL 

export async function searchYoutube(query: string): Promise<string> {
   try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 36000); 
      const url = `${API_URL}/api/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId)
      if (!res.ok) {
          const body = await res.text();
          throw new Error(`Search server error: ${res.status} — ${body}`);
      }
      const data = await res.json();
      if (!data.videoId) throw new Error('No videoId in response');
      return data.videoId;
    } catch (err) {
      console.error('Search server exception:', err);
      throw err;
    }
}