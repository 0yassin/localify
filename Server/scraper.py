import asyncio
import json 
import re
import httpx

browser_headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

async def get_artwork(client: httpx.AsyncClient, id: str):
    try:
        track_url = f"https://open.spotify.com/track/{id}"
        oembed_uri = f"https://open.spotify.com/oembed?url={track_url}"

        response = await client.get(oembed_uri, headers={"Accept": "application/json"}, timeout=3.0)
        if response.status_code == 200:
            return response.json().get("thumbnail_url") or ""
    except Exception as e:
        print(f"Retrieving artwork failed for track: {id}")
    return ""

def _extract_spotify_entity(data: dict) -> dict:

    try:
        entity = data.get('props', {}).get('pageProps', {}).get('state', {}).get('data', {}).get('entity')
        if entity and 'trackList' in entity:
            return entity
    except Exception:
        pass

    def deep_find_entity(obj):
        if isinstance(obj, dict):
            if 'entity' in obj and isinstance(obj['entity'], dict) and 'trackList' in obj['entity']:
                return obj['entity']
            if 'trackList' in obj:
                return obj
            for value in obj.values():
                result = deep_find_entity(value)
                if result: 
                    return result
        elif isinstance(obj, list):
            for item in obj:
                result = deep_find_entity(item)
                if result: 
                    return result
        return None

    return deep_find_entity(data)

async def get_playlist(url):
    embed_url = f"https://open.spotify.com/embed/playlist/{url.split('/')[-1].split('?')[0]}"

    try:
        async with httpx.AsyncClient(headers=browser_headers, timeout=10.0) as client:
            response = await client.get(embed_url, headers=browser_headers)
            pattern = r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>'
            match = re.search(pattern, response.text)

            if match:
                data = json.loads(match.group(1))
                
                playlist_data = _extract_spotify_entity(data)

                if not playlist_data or 'trackList' not in playlist_data:
                    print("CRITICAL: Failed to locate 'trackList' payload within Spotify's page scheme.")
                    return None

                tracks_data = playlist_data['trackList']

                artwork_tasks = [
                    get_artwork(client, item.get('uri', '')[14:]) 
                    for item in tracks_data if item.get('uri') and len(item.get('uri', '')) > 14
                ]
                artworks = await asyncio.gather(*artwork_tasks)

                tracks = []
                for idx, item in enumerate(tracks_data):
                    track_id = item.get('uri', '')[14:] if item.get('uri') else f"unknown_{idx}"
                    tracks.append({
                        "id": track_id,
                        "title": item.get('title', 'Unknown Track'),
                        "artist": item.get('subtitle', 'Unknown Artist'),
                        "image": artworks[idx] if idx < len(artworks) else '', 
                    })

                cover_art_sources = playlist_data.get("coverArt", {}).get("sources", [])
                icon_url = cover_art_sources[0].get("url") if cover_art_sources else "noicon"

                return {
                    "id": playlist_data.get("uri", "").split(':')[-1] if playlist_data.get("uri") else "unknown",
                    "playlist_name": playlist_data.get("title") or "Untitled Playlist",
                    "icon": icon_url,
                    "owner": playlist_data.get("subtitle") or "owner",
                    "tracks": tracks
                }

    except Exception as e:
        print(f"Error fetching playlist: {e}")
    return None
