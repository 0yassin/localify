import requests
import json 
import re

def get_playlist(url):
    embed_url = f"https://open.spotify.com/embed/playlist/{url.split('/')[-1].split('?')[0]}"

    try:

        response = requests.get(embed_url)

        pattern = r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>'

        match = re.search(pattern, response.text)

        playlist = {}

        if match:
            data = json.loads(match.group(1))
            playlist_data = data['props']['pageProps']['state']['data']['entity']
            tracks_data = playlist_data['trackList']
            tracks = []
            for item in tracks_data:
                tracks.append({
                    "id": item['uri'][14:],
                    "title": item['title'],
                    "artist": item['subtitle'],
                })

            playlist = {
                "id": playlist_data["uri"].split(':')[-1],
                "playlist_title": playlist_data["title"],
                "cover": playlist_data["coverArt"]["sources"][0]["url"],
                "owner": playlist_data["subtitle"],
                "tracks": tracks
            }
            
            return playlist

    except Exception as e:
        print(f"Error fetching playlist: {e}")


    return None