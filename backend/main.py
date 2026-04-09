from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi
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
        # Step 1: Search YouTube for videos
        search_url = "https://www.googleapis.com/youtube/v3/search"
        search_params = {
            "q": f"{word} english",
            "part": "snippet",
            "type": "video",
            "videoCaption": "closedCaption",
            "maxResults": 10,
            "relevanceLanguage": "en",
            "videoDuration": "short",
            "key": YOUTUBE_API_KEY
        }

        search_response = requests.get(search_url, params=search_params)
        search_data = search_response.json()

        if not search_data.get("items"):
            return {"error": "No videos found"}

        # Step 2: Check each video's transcript for the word
        for item in search_data["items"]:
            video_id = item["id"]["videoId"]

            try:
                transcript = YouTubeTranscriptApi.get_transcript(
                    video_id, 
                    languages=["en"]
                )

                # Search for word in transcript
                for i, entry in enumerate(transcript):
                    if word.lower() in entry["text"].lower():
                        start_seconds = int(entry["start"])

                        # Get surrounding context
                        context_entries = transcript[max(0, i-1):i+3]
                        context = " ".join([e["text"] for e in context_entries])

                        return {
                            "word": word,
                            "video_id": video_id,
                            "start_time": max(0, start_seconds - 2),
                            "transcript": context.strip(),
                            "found_in_captions": True
                        }

            except Exception:
                continue

        # Fallback
        first = search_data["items"][0]
        return {
            "word": word,
            "video_id": first["id"]["videoId"],
            "start_time": 0,
            "transcript": first["snippet"]["description"][:200],
            "found_in_captions": False
        }

    except Exception as e:
        return {"error": str(e)}