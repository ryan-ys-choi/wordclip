// background.js — runs as service worker, can make cross-origin fetches freely

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "findWord") {
    findWordInVideos(message.videoIds, message.word)
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true; // keep channel open for async response
  }
});

async function findWordInVideos(videoIds, word) {
  for (const videoId of videoIds) {
    const result = await findWordInVideo(videoId, word);
    if (result) return result;
  }
  return null;
}

async function findWordInVideo(videoId, word) {
  try {
    console.log(`[WordClip] Fetching player data for ${videoId}`);
    const playerResponse = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-YouTube-Client-Name": "1",
          "X-YouTube-Client-Version": "2.20240101.00.00",
        },
        body: JSON.stringify({
          videoId: videoId,
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20240101.00.00",
              hl: "en",
              gl: "US"
            }
          }
        })
      }
    );

    if (!playerResponse.ok) {
      console.warn(`[WordClip] Player API returned ${playerResponse.status} for ${videoId}`);
      return null;
    }

    const playerData = await playerResponse.json();
    const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    console.log(`[WordClip] ${videoId}: ${captions.length} caption track(s) found`);

    if (captions.length === 0) {
      const reason = playerData?.playabilityStatus?.reason || "unknown";
      console.warn(`[WordClip] No captions for ${videoId}. Playability: ${reason}`);
      return null;
    }

    const englishTrack = captions.find(t =>
      t.languageCode === "en" || t.languageCode === "en-US"
    ) || captions[0];

    if (!englishTrack || !englishTrack.baseUrl) {
      console.warn(`[WordClip] No usable caption track for ${videoId}`);
      return null;
    }

    console.log(`[WordClip] ${videoId}: fetching captions (lang: ${englishTrack.languageCode})`);
    const captionUrl = englishTrack.baseUrl + "&fmt=json3";
    const captionResponse = await fetch(captionUrl);
    const text = await captionResponse.text();

    if (!text || text.trim() === "") {
      console.warn(`[WordClip] Empty caption response for ${videoId}`);
      return null;
    }

    const captionData = JSON.parse(text);
    const events = captionData.events || [];
    console.log(`[WordClip] ${videoId}: searching ${events.length} caption events for "${word}"`);

    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordRegex = new RegExp(`\\b${escapedWord}\\b`, "i");

    for (let i = 0; i < events.length; i++) {
      const segs = events[i].segs || [];
      const segText = segs.map(s => s.utf8 || "").join("");

      if (wordRegex.test(segText)) {
        const startMs = events[i].tStartMs || 0;
        const startSeconds = Math.floor(startMs / 1000);

        const contextEvents = events.slice(Math.max(0, i - 1), i + 3);
        const context = contextEvents
          .map(e => (e.segs || []).map(s => s.utf8 || "").join(""))
          .join(" ");

        console.log(`[WordClip] Found "${word}" in ${videoId} at ${startSeconds}s`);
        return {
          word: word,
          video_id: videoId,
          start_time: Math.max(0, startSeconds - 2),
          transcript: context.trim(),
          found_in_captions: true
        };
      }
    }

    console.warn(`[WordClip] "${word}" not found in captions of ${videoId}`);
    return null;

  } catch (e) {
    console.error(`[WordClip] Error processing ${videoId}:`, e);
    return null;
  }
}
