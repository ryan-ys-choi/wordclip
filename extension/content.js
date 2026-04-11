let tooltip = null;

document.addEventListener("mouseup", async () => {
  const selectedText = window.getSelection().toString().trim();

  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }

  if (selectedText && selectedText.split(" ").length === 1) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    showLoading(rect, selectedText);

    try {
      // Step 1: Get video IDs from your backend
      const backendResponse = await fetch(
        `http://18.223.134.168:8001/search?word=${encodeURIComponent(selectedText)}`
      );
      const data = await backendResponse.json();

      if (data.error || !data.video_ids) {
        if (tooltip) tooltip.remove();
        return;
      }

      // Step 2: Try each video to find exact timestamp
      // Runs in content script = looks like real browser to YouTube ✅
      let result = null;
      for (const videoId of data.video_ids) {
        result = await findWordInVideo(videoId, selectedText);
        if (result) break;
      }

      // Fallback if no exact match found
      if (!result) {
        result = {
          word: selectedText,
          video_id: data.video_ids[0],
          start_time: 0,
          transcript: `Example of "${selectedText}" in context`,
          found_in_captions: false
        };
      }

      if (tooltip) tooltip.remove();
      showTooltip(rect, selectedText, result);

    } catch (error) {
      console.error("WordClip error:", error);
      if (tooltip) tooltip.remove();
    }
  }
});

async function findWordInVideo(videoId, word) {
  try {
    // POST to YouTube Innertube API
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

    if (!playerResponse.ok) return null;

    const playerData = await playerResponse.json();
    const captions = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

    const englishTrack = captions.find(t =>
      t.languageCode === "en" || t.languageCode === "en-US"
    ) || captions[0];

    if (!englishTrack || !englishTrack.baseUrl) return null;

    const captionUrl = englishTrack.baseUrl + "&fmt=json3";
    const captionResponse = await fetch(captionUrl);
    const text = await captionResponse.text();

    if (!text || text.trim() === "") return null;

    const captionData = JSON.parse(text);
    const events = captionData.events || [];

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
    return null;
  }
}

function showLoading(rect, word) {
  tooltip = document.createElement("div");
  tooltip.style.cssText = getTooltipStyle(rect);
  tooltip.innerHTML = `
    <div style="color:#00e5a0;font-size:11px;letter-spacing:1px;margin-bottom:8px">WORDCLIP</div>
    <div style="font-size:18px;font-weight:bold;margin-bottom:8px">${word}</div>
    <div style="color:#aaa;font-size:13px">Finding YouTube clip... 🎬</div>
  `;
  document.body.appendChild(tooltip);
}

function showTooltip(rect, word, data) {
  tooltip = document.createElement("div");
  tooltip.style.cssText = getTooltipStyle(rect);

  const label = data.found_in_captions
    ? `<span style="color:#00e5a0;font-size:11px">✅ Exact moment found</span>`
    : `<span style="color:#888;font-size:11px">⚠️ Approximate match</span>`;

  tooltip.innerHTML = `
    <div style="color:#00e5a0;font-size:11px;letter-spacing:1px;margin-bottom:4px">WORDCLIP</div>
    <div style="font-size:22px;font-weight:bold;margin-bottom:6px">${word}</div>
    ${label}
    <iframe
      src="https://www.youtube.com/embed/${data.video_id}?autoplay=1&start=${data.start_time}"
      width="100%" height="180" frameborder="0" allowfullscreen
      style="border-radius:8px;margin-top:8px"
    ></iframe>
    <div style="margin-top:10px;font-size:12px;color:#aaa;line-height:1.5">${data.transcript}</div>
    <div style="text-align:right;margin-top:8px">
      <span id="wordclip-close" style="cursor:pointer;color:#666;font-size:11px">✕ close</span>
    </div>
  `;

  document.body.appendChild(tooltip);

  document.getElementById("wordclip-close").addEventListener("click", () => {
    tooltip.remove();
    tooltip = null;
  });

  setTimeout(() => {
    document.addEventListener("mousedown", (e) => {
      if (tooltip && !tooltip.contains(e.target)) {
        tooltip.remove();
        tooltip = null;
      }
    }, { once: true });
  }, 100);
}

function getTooltipStyle(rect) {
  return `
    position: fixed;
    top: ${rect.bottom + 10}px;
    left: ${Math.min(rect.left, window.innerWidth - 380)}px;
    width: 360px;
    background: #0a0a0f;
    color: #e8e8f0;
    border-radius: 12px;
    padding: 14px;
    font-family: sans-serif;
    z-index: 999999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    border: 1px solid #00e5a0;
  `;
}