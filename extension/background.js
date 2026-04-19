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
  const results = await Promise.all(videoIds.map(id => findWordInVideo(id, word)));
  return results.find(r => r !== null) || null;
}

async function findWordInVideo(videoId, word) {
  try {
    console.log(`[WordClip] Fetching watch page for ${videoId}`);

    // Scrape ytInitialPlayerResponse from the watch page — no client version needed
    const watchResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "Accept-Language": "en-US,en;q=0.9" }
    });

    if (!watchResponse.ok) {
      console.warn(`[WordClip] Watch page returned ${watchResponse.status} for ${videoId}`);
      return null;
    }

    const html = await watchResponse.text();
    const marker = "var ytInitialPlayerResponse = ";
    const markerIdx = html.indexOf(marker);

    if (markerIdx === -1) {
      console.warn(`[WordClip] ytInitialPlayerResponse not found for ${videoId}`);
      return null;
    }

    // Walk forward counting braces to extract the full JSON object
    let depth = 0, i = markerIdx + marker.length;
    const jsonStart = i;
    for (; i < html.length; i++) {
      if (html[i] === "{") depth++;
      else if (html[i] === "}") { depth--; if (depth === 0) break; }
    }
    const playerData = JSON.parse(html.substring(jsonStart, i + 1));
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
