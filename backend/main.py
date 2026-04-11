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
        search_url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "q": f"{word} english",
            "part": "snippet",
            "type": "video",
            "videoCaption": "closedCaption",
            "maxResults": 10,
            "relevanceLanguage": "en",
            "videoDuration": "short",
            "key": YOUTUBE_API_KEY
        }

        response = requests.get(search_url, params=params)
        data = response.json()

        if not data.get("items"):
            return {"error": "No videos found"}

        video_ids = [item["id"]["videoId"] for item in data["items"]]

        return {
            "word": word,
            "video_ids": video_ids
        }

    except Exception as e:
        return {"error": str(e)}