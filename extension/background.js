chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "wordSelected") {
    const word = message.word;
    console.log("Received word:", word);

    fetch(`http://18.223.134.168:8001/search?word=${encodeURIComponent(word)}`)
      .then(response => response.json())
      .then(async data => {
        console.log("Backend response:", data);

        if (data.error || !data.video_ids) {
          sendResponse({ error: "No videos found" });
          return;
        }

        for (const videoId of data.video_ids) {
          const result = await findWordInVideo(videoId, word);
          if (result) {
            sendResponse(result);
            return;
          }
        }

        sendResponse({
          word: word,
          video_id: data.video_ids[0],
          start_time: 0,
          transcript: `Example of "${word}" in context`,
          found_in_captions: false
        });
      })
      .catch(error => {
        console.error("Error:", error);
        sendResponse({ error: error.message });
      });

    return true;
  }
});

async function findWordInVideo(videoId, word) {
  try {
    console.log("Getting caption URL for:", videoId);

    // POST to YouTube Innertube API with correct headers
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

    console.log("Player response status:", playerResponse.status);
    const playerData = await playerResponse.json();
    console.log("Player data keys:", Object.keys(playerData));

    const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    console.log("Caption tracks found:", captions.length);

    const englishTrack = captions.find(t =>
      t.languageCode === "en" || t.languageCode === "en-US"
    ) || captions[0];

    if (!englishTrack || !englishTrack.baseUrl) {
      console.log("No caption track for:", videoId);
      return null;
    }

    // Fetch actual captions from baseUrl
    const captionUrl = englishTrack.baseUrl + "&fmt=json3";
    console.log("Fetching captions from baseUrl");

    const captionResponse = await fetch(captionUrl);
    const text = await captionResponse.text();
    console.log("Caption length:", text.length);

    if (!text || text.trim() === "") return null;

    const data = JSON.parse(text);
    const events = data.events || [];

    for (let i = 0; i < events.length; i++) {
      const segs = events[i].segs || [];
      const segText = segs.map(s => s.utf8 || "").join(" ");

      if (segText.toLowerCase().includes(word.toLowerCase())) {
        const startMs = events[i].tStartMs || 0;
        const startSeconds = Math.floor(startMs / 1000);

        const contextEvents = events.slice(Math.max(0, i - 1), i + 3);
        const context = contextEvents
          .map(e => (e.segs || []).map(s => s.utf8 || "").join(" "))
          .join(" ");

        return {
          word: word,
          video_id: videoId,
          start_time: Math.max(0, startSeconds - 2),
          transcript: context.trim(),
          found_in_captions: true
        };
      }
    }
    return null;

  } catch (e) {
    console.error("Error for", videoId, ":", e.message);
    return null;
  }
}