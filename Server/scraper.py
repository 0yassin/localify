import asyncio
from http import client
import requests
import json 
import re
import httpx


browser_headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


async def get_artwork(client: httpx.AsyncClient, id:str):
    try:
        track_url = f"https://open.spotify.com/track/{id}"
        oembed_uri = f"https://open.spotify.com/oembed?url={track_url}"




        response = await client.get(oembed_uri, headers={"Accept": "application/json"}, timeout=3.0)
        if response.status_code == 200:
            return response.json().get("thumbnail_url") or ""

    except Exception as e:
        print(f"Retrieving artwork failed for track: {id}")
    return ""



async def get_playlist(url):
    embed_url = f"https://open.spotify.com/embed/playlist/{url.split('/')[-1].split('?')[0]}"

    try:
        async with httpx.AsyncClient(headers=browser_headers, timeout=10.0) as client:

            response = await client.get(embed_url, headers=browser_headers)

            pattern = r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>'

            match = re.search(pattern, response.text)



            playlist = {}

            if match:
                data = json.loads(match.group(1))
                playlist_data = data['props']['pageProps']['state']['data']['entity']
                tracks_data = playlist_data['trackList']


                artwork_tasks = [get_artwork(client, item['uri'][14:]) for item in tracks_data]
                artworks = await asyncio.gather(*artwork_tasks)


                tracks = []
                for idx, item in enumerate(tracks_data):
                    tracks.append({
                        "id": item['uri'][14:],
                        "title": item['title'],
                        "artist": item['subtitle'],
                        "image": artworks[idx], 
                    })

                
                return {
                    "id": playlist_data["uri"].split(':')[-1],
                    "playlist_name": playlist_data["title"],
                    "icon": playlist_data["coverArt"]["sources"][0]["url"],
                    "owner": playlist_data["subtitle"],
                    "tracks": tracks
                }

    except Exception as e:
        print(f"Error fetching playlist: {e}")
    return None