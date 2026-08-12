# Localify
## Hi there! 
Localify is an app designed to help you locally save your playlists on spotify, this is already a feature in spotify but it's premium only so this app tries to provide a similar experience for completely free!

## Screenshots

<div style="display: flex; overflow-x: auto; gap: 12px;">

<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_232626.jpg" width="250">
<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_233422.jpg" width="250">
<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_233503.jpg" width="250">
<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_233510.jpg" width="250">
<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_233518.jpg" width="250">
<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_233915.jpg" width="250">
<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_234146.jpg" width="250">
<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_234151.jpg" width="250">
<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_234709.jpg" width="250">
<img src="https://raw.githubusercontent.com/0yassin/localify/main/screenshot/Screenshot_20260712_234718.jpg" width="250">

</div>

## Video demo
<div style="display: flex; overflow-x: auto; gap: 12px;">

<video src="https://raw.githubusercontent.com/0yassin/localify/main/Screenrecording_20260812_181507.mp4" width="250">
<video src="https://raw.githubusercontent.com/0yassin/localify/main/Screenrecording_20260812_181200.mp4" width="250">
</div>


## How it works
- the server handles loading playlist and track data and downloads etc while the expo app acts as a front-end.
- the server uses ytdlp to search for the title of the requested song and then extracts that audio and feeds it through the API for the expo app.
- the expo app recieves that stream and saves it on the device to a folder picked by the user along with a m3u file.
- the m3u file can then be imported into a music player of your choice.

## Technologies used
- react native with expo for the app
- sqlite with drizzle for storage on the app
- Fastapi for the backend
- ytdlp for youtube searching and streaming the actual files
- the download on the app is handled by react native bg downloader

## Note 
- the playlist size is capped at around 100 at the moment because of limitations in the spotify fetch approach

## self hosting
- clone the repo
- navigate to the server dir, install requirements and run main.py with uvicorn
- navigate to the localifyapp dir, run npm install and add a .env file with EXPO_PUBLIC_API_URL=YOUR_UVICORN_API_URL Inside it
- build the app using [EAS](https://docs.expo.dev/build/introduction/)

## Download
you can download the app from the releases tab on github: [here](https://github.com/0yassin/localify/releases/)

![banner](https://github.com/0yassin/localify/raw/refs/heads/main/banner.png)
