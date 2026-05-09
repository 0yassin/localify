import scraper
from fastapi import FastAPI, HTTPException

app = FastAPI()

@app.get("/playlist")
def playlist(url:str):
    data = scraper.get_playlist(url)
    if not data:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return data