# Localify
## Hi there! 
Localify is an app designed to help you locally save your playlists on spotify, this is already a feature in spotify but it's premium only so this app tries to provide a similar experience for completely free!

## How it works
- the server handles loading playlist and track data and downloads etc while the expo app acts as a front-end.
- the server uses ytdlp to search for the title of the requested song and then extracts that audio and feeds it through the API for the expo app.
- the expo app recieves that stream and saves it on the device to a folder picked by the user along with a m3u file.
- the m3u file can then be imported into a music player of your choice.

## Note 
- the playlist size is capped at around 100 at the moment because of limitations in the spotify fetch approach

## Download
you can download the app from the releases tab on github: []

![Screenshot from app](https://github.com/0yassin/localify/raw/refs/heads/main/screenshot)
