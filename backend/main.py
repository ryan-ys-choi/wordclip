from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import requests
import os
import xml.etree.ElementTree as ET


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
        # Search for videos with captions
        search_url = "https://www.googleapis.com/youtube/v3/search"
        search_params = {
            "q": word,
            "part": "snippet",
            "type": "video",
            "videoCaption": "closedCaption",
            "maxResults": 10,
            "relevanceLanguage": "en",
            "videoDuration": "medium",
            "key": YOUTUBE_API_KEY
        }

        search_response = requests.get(search_url, params=search_params)
        search_data = search_response.json()

        if not search_data.get("items"):
            return {"error": "No video found"}

        # Check each video's captions for the word
        for item in search_data["items"]:
            video_id = item["id"]["videoId"]

            # Get transcript using YouTube's timedtext API
            transcript_url = f"https://www.youtube.com/api/timedtext?lang=en&v={video_id}"
            transcript_response = requests.get(transcript_url)

            if transcript_response.status_code != 200 or not transcript_response.text:
                continue

            # Parse the transcript XML
            try:
                root_xml = ET.fromstring(transcript_response.text)
                texts = root_xml.findall("text")

                for text_elem in texts:
                    content = text_elem.text or ""
                    if word.lower() in content.lower():
                        start_time = float(text_elem.get("start", 0))
                        start_seconds = int(start_time)

                        # Get surrounding context (3 lines)
                        idx = texts.index(text_elem)
                        context_texts = texts[max(0, idx-1):idx+3]
                        context = " ".join([t.text or "" for t in context_texts])

                        return {
                            "word": word,
                            "video_id": video_id,
                            "start_time": max(0, start_seconds - 2),
                            "transcript": context,
                            "found_in_captions": True
                        }

            except ET.ParseError:
                continue

        # Fallback: return first video without exact timestamp
        first_video = search_data["items"][0]
        return {
            "word": word,
            "video_id": first_video["id"]["videoId"],
            "start_time": 0,
            "transcript": first_video["snippet"]["description"][:200],
            "found_in_captions": False
        }

    except Exception as e:
        return {"error": str(e)}