import os
import re
import tempfile
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
import httpx
import yt_dlp
from pydantic import BaseModel

import scraper

app = FastAPI()

class Trackscheme(BaseModel):
    id: str
    title: str
    artist: str
    image: Optional[str] = None

class PlaylistResponse(BaseModel):
    status: str
    playlist_name: str
    icon: Optional[str] = 'noicon'
    tracks: List[Trackscheme]
    owner: Optional[str] = "owner"

class ErrorResponse(BaseModel):
    status: str
    errordetail: str

@app.post("/api/playlist/fetch")
async def fetch_playlist(payload: dict):
    spotify_url = payload.get("url") 
    
    try:
        playlist = await scraper.get_playlist(spotify_url)

        if playlist is None:
            return ErrorResponse(
                status="error",
                errordetail="Failed to fetch playlist"
            )

        return PlaylistResponse(
            status="success",
            playlist_name=str(playlist.get("playlist_name") or "Untitled Playlist"),
            icon=str(playlist.get("icon")),
            tracks=playlist["tracks"]
        )

    except Exception as e:
        return ErrorResponse(
            status="error",
            errordetail=f"Server processing failure: {str(e)}"
        )

def get_audio_stream(url: str) -> dict:
    ydl_config = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['tv_downgraded', 'android_vr', 'web_creator']
            }
        },
        "http_headers": {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
    }

cookie_data = os.getenv("YT_COOKIES")
    temp_cookie_file = None
    if cookie_data:
        cookie_data = cookie_data.replace('\\n', '\n').replace('\\t', '\t')
        
        print(f"DEBUG: Active Cookie Line Count -> {len(cookie_data.splitlines())}")
        
        temp_cookie_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt')
        temp_cookie_file.write(cookie_data)
        temp_cookie_file.close()
        
        ydl_config['cookiefile'] = temp_cookie_file.name  

    with yt_dlp.YoutubeDL(ydl_config) as ydl:
        try:
            ydl.cache.remove()
            info = ydl.extract_info(url, download=False)
            return {
                "stream_url": info['url'],
                "title": info.get('title', 'audio_track'),
                "headers": info.get('http_headers', {})
            }
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to extract yt metadata; {str(e)}"
            )
        finally: 
            if temp_cookie_file and os.path.exists(temp_cookie_file.name):
                os.unlink(temp_cookie_file.name)

@app.get("/api/download")
async def download_audio_stream(url: str = Query(..., description="full youtube video link")):
    data = await run_in_threadpool(get_audio_stream, url)
    stream_url = data["stream_url"]
    headers = data["headers"]
    timeout_config = httpx.Timeout(connect=15.0, read=None, write=30.0, pool=30.0)
    client = httpx.AsyncClient(timeout=timeout_config)
    try:
        request = client.build_request("GET", stream_url, headers=headers)
        response = await client.send(request, stream=True)

        if response.status_code != 200:
            await response.aclose()
            await client.aclose()
            raise HTTPException(
                status_code=400,
                detail=f"Connection to youtube failed {response.status_code}"
            )

    except HTTPException:
        raise
    except Exception as e:
        await client.aclose()
        raise HTTPException(
            status_code=502,
            detail=f"Failed: {str(e)}"
        )

    total_bytes = response.headers.get("content-length")
    
    async def stream_pipe():
        try:
            async for bin_chunk in response.aiter_bytes(chunk_size=65536):
                yield bin_chunk
        finally:
            await response.aclose()
            await client.aclose()

    _filename = "".join(c for c in data["title"] if c.isalnum() or c in "._-").strip()
    if not _filename:
        _filename = "track"

    _headers = {
        "Content-Disposition": f'attachment; filename="{_filename}.mp3"',
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    }

    if total_bytes:
        _headers["Content-Length"] = total_bytes

    return StreamingResponse(
        stream_pipe(),
        media_type="audio/mpeg",
        headers=_headers
    )

def extract_video_id(result) -> Optional[str]:
    print(f"DEBUG extract_video_id called, result: {result}")
    if not result:
        return None
    entries = result.get('entries')
    if entries:
        return entries[0].get('id')
    if result.get('id'):
        return result['id']
    target = result.get('webpage_url') or result.get('url')
    if target:
        match = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', target)
        if match:
            return match.group(1)
    return None

@app.get("/api/search")
def search(q: str = Query(..., description="Search query to search YT for")):
    ytdl_opts = {
        'quiet': True,
        'no_warnings': True,
        'default_search': 'ytsearch1',
        'extractor_args': {
            'youtube': {
                'player_client': ['tv_downgraded', 'android_vr', 'web_creator']
            }
        },
    }

cookie_data = os.getenv("YT_COOKIES")
    temp_cookie_file = None
    if cookie_data:
        cookie_data = cookie_data.replace('\\n', '\n').replace('\\t', '\t')
        print(f"DEBUG: Active Cookie Line Count -> {len(cookie_data.splitlines())}")
        
        temp_cookie_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt')
        temp_cookie_file.write(cookie_data)
        temp_cookie_file.close()
        ydl_config['cookiefile'] = temp_cookie_file.name 

    try:
        with yt_dlp.YoutubeDL(ytdl_opts) as ydl:
            result = ydl.extract_info(q, download=False)
            video_id = extract_video_id(result)
            if not video_id:
                raise HTTPException(status_code=404, detail="No results found")
            return {"videoId": video_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_cookie_file and os.path.exists(temp_cookie_file.name):
            os.unlink(temp_cookie_file.name)
