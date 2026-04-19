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
      const backendResponse = await fetch(
        `https://wordclip.duckdns.org/search?word=${encodeURIComponent(selectedText)}`
      );
      const data = await backendResponse.json();

      if (data.error || !data.video_ids || data.video_ids.length === 0) {
        if (tooltip) tooltip.remove();
        showNotFound(rect, selectedText);
        return;
      }

      // Ask background worker to fetch YouTube captions (avoids CORS)
      const result = await chrome.runtime.sendMessage({
        action: "findWord",
        word: selectedText,
        videoIds: data.video_ids
      });

      const finalResult = result || {
        word: selectedText,
        video_id: data.video_ids[0],
        start_time: 0,
        transcript: null,
        found_in_captions: false
      };

      chrome.storage.local.set({
        currentWord: finalResult.word,
        videoId: finalResult.video_id,
        startTime: finalResult.start_time,
        transcript: finalResult.transcript || ""
      });

      if (tooltip) tooltip.remove();
      showTooltip(rect, selectedText, finalResult);

    } catch (error) {
      console.error("[WordClip] Error:", error);
      if (tooltip) tooltip.remove();
      showNotFound(rect, selectedText);
    }
  }
});

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

function showNotFound(rect, word) {
  tooltip = document.createElement("div");
  tooltip.style.cssText = getTooltipStyle(rect);
  tooltip.innerHTML = `
    <div style="color:#00e5a0;font-size:11px;letter-spacing:1px;margin-bottom:4px">WORDCLIP</div>
    <div style="font-size:22px;font-weight:bold;margin-bottom:6px">${word}</div>
    <div style="color:#888;font-size:13px;line-height:1.5">No YouTube clip found for this word.</div>
    <div style="text-align:right;margin-top:8px">
      <span id="wordclip-close" style="cursor:pointer;color:#666;font-size:11px">✕ close</span>
    </div>
  `;
  document.body.appendChild(tooltip);
  document.getElementById("wordclip-close").addEventListener("click", () => {
    tooltip.remove();
    tooltip = null;
  });
}

function showTooltip(rect, word, data) {
  tooltip = document.createElement("div");
  tooltip.style.cssText = getTooltipStyle(rect);

  const label = data.found_in_captions
    ? `<span style="color:#00e5a0;font-size:11px">✅ Exact moment found</span>`
    : `<span style="color:#888;font-size:11px">⚠️ No exact timestamp — playing from start</span>`;

  const transcriptHtml = data.transcript
    ? `<div style="margin-top:10px;font-size:12px;color:#aaa;line-height:1.5">${data.transcript}</div>`
    : "";

  tooltip.innerHTML = `
    <div style="color:#00e5a0;font-size:11px;letter-spacing:1px;margin-bottom:4px">WORDCLIP</div>
    <div style="font-size:22px;font-weight:bold;margin-bottom:6px">${word}</div>
    ${label}
    <iframe
      src="https://www.youtube.com/embed/${data.video_id}?autoplay=1&start=${data.start_time}"
      width="100%" height="180" frameborder="0" allowfullscreen
      style="border-radius:8px;margin-top:8px"
    ></iframe>
    ${transcriptHtml}
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
