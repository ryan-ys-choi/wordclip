chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "wordSelected") {
    const word = message.word;
    console.log("Received word:", word);

    // Step 1: Get video IDs from your backend
    fetch(`http://18.223.134.168:8001/search?word=${encodeURIComponent(word)}`)
      .then(response => response.json())
      .then(async data => {
        if (data.error || !data.video_ids) {
          sendResponse({ error: "No videos found" });
          return;
        }

        // Step 2: Try each video to find transcript with word
        for (const videoId of data.video_ids) {
          const result = await findWordInVideo(videoId, word);
          if (result) {
            sendResponse(result);
            return;
          }
        }

        // Fallback: return first video without timestamp
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

    return true; // keep message channel open
  }
});

async function findWordInVideo(videoId, word) {
  try {
    // Fetch transcript directly from YouTube
    // This works from user's browser (not blocked like EC2)
    const url = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=json3`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const text = await response.text();
    if (!text || text.trim() === "") return null;

    const data = JSON.parse(text);
    const events = data.events || [];

    for (let i = 0; i < events.length; i++) {
      const segs = events[i].segs || [];
      const text = segs.map(s => s.utf8 || "").join(" ");

      if (text.toLowerCase().includes(word.toLowerCase())) {
        const startMs = events[i].tStartMs || 0;
        const startSeconds = Math.floor(startMs / 1000);

        // Get surrounding context
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
    console.error("Transcript fetch error:", e);
    return null;
  }
}