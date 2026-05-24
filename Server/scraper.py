import requests
import json 
import re


# def get_artwork(id):
#     try:
#         track_url = f"https://open.spotify.com/track/{id}"
#         oembed_uri = f"https://open.spotify.com/oembed?url={track_url}"

#         browser_headers = {
#             "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
#             "Accept": "application/json",
#             "Accept-Language": "en-US,en;q=0.9",
#         }

#         response = requests.get(oembed_uri,headers=browser_headers, timeout=3)
#         if response.status_code == 200:
#             meta_data = response.json()
#             return meta_data.get("thumbnail_url") or ""
#     except Exception as e:
#         print(f"fallback failed for track {id} : {e} ")


def get_playlist(url):
    embed_url = f"https://open.spotify.com/embed/playlist/{url.split('/')[-1].split('?')[0]}"


    browser_headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    try:

        response = requests.get(embed_url, headers=browser_headers)

        pattern = r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>'

        match = re.search(pattern, response.text)

        playlist = {}

        if match:
            data = json.loads(match.group(1))
            playlist_data = data['props']['pageProps']['state']['data']['entity']
            tracks_data = playlist_data['trackList']
            tracks = []
            for item in tracks_data:

                # album_art = get_artwork(item['uri'][14:])
                
                track_images = item.get('album', {}).get('images', []) or playlist_data.get("coverArt", {}).get("sources", [])
                album_art = track_images[0]["url"] 

                tracks.append({
                    "id": item['uri'][14:],
                    "title": item['title'],
                    "artist": item['subtitle'],
                    "image": album_art,
                })

            playlist = {
                "id": playlist_data["uri"].split(':')[-1],
                "playlist_name": playlist_data["title"],
                "icon": playlist_data["coverArt"]["sources"][0]["url"],
                "owner": playlist_data["subtitle"],
                "tracks": tracks
            }
            
            print(tracks_data)

            return playlist

    except Exception as e:
        print(f"Error fetching playlist: {e}")


    return None
