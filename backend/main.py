from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import requests
import os

load_dotenv()

app = FastAPI(title="WordClip API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

@app.get("/")
def root():
    return {"message": "WordClip API is running"}

@app.get("/search")
def search(word: str):
    try:
        # Call YouTube API directly
        url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "q": f"{word} english sentence example",
            "part": "snippet",
            "type": "video",
            "videoCaption": "closedCaption",
            "maxResults": 5,
            "relevanceLanguage": "en",
            "videoDuration": "short",
            "key": YOUTUBE_API_KEY
        }

        response = requests.get(url, params=params)
        data = response.json()

        if not data.get("items"):
            return {"error": "No video found"}

        video = data["items"][0]
        video_id = video["id"]["videoId"]
        description = video["snippet"]["description"]

        return {
            "word": word,
            "video_id": video_id,
            "start_time": 0,
            "transcript": description[:200] if description else f"Example of '{word}' used in context."
        }

    except Exception as e:
        return {"error": str(e)}