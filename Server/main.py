import scraper
from typing import List
from typing import Optional
import scraper
from fastapi import FastAPI, HTTPException

from pydantic import BaseModel

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
        playlist = scraper.get_playlist(spotify_url)

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