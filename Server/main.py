from fastapi.concurrency import run_in_threadpool
import yt_dlp
import scraper
from typing import Optional, List
import scraper
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
import httpx
from fastapi.responses import StreamingResponse

app = FastAPI()


class Trackscheme(BaseModel):
    id:str
    title:str
    artist:str
    image: Optional[str] = None

class PlaylistResponse(BaseModel):
    status:str
    playlist_name: str
    icon: Optional[str] = 'noicon'
    tracks: List[Trackscheme]
    owner: Optional[str] = "owner"


class ErrorResponse(BaseModel):
    status: str
    errordetail: str
    

@app.post("/api/playlist/fetch")
async def fetch_playlist(payload:dict):
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
        'format':'bestaudio/best',
        'quiet':True,
        'no_warnings':True,

        "http_headers":{
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
    }

    with yt_dlp.YoutubeDL(ydl_config) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            return {
                "stream_url": info['url'],
                "title": info.get('title', 'audio_track'),
                "headers": info.get('http_headers', {})
            }
        except Exception as e :
            raise HTTPException(
                status_code=400,
                detail=f"Failed to extract yt metadata; {str(e)}"
            )


@app.get("/download")
async def download_audio_stream(url:str = Query(..., description="full youtube video link")):

    data = await run_in_threadpool(get_audio_stream, url)
    stream_url = data["stream_url"]
    headers = data["headers"]

    client = httpx.AsyncClient()



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