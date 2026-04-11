let tooltip = null;

document.addEventListener("mouseup", () => {
  const selectedText = window.getSelection().toString().trim();

  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }

  if (selectedText && selectedText.split(" ").length === 1) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Show loading first
    showLoading(rect, selectedText);

    // Ask background.js to find the video
    chrome.runtime.sendMessage(
      { action: "wordSelected", word: selectedText },
      (response) => {
        if (tooltip) tooltip.remove();

        if (response && response.video_id) {
          showTooltip(rect, selectedText, response);
        }
      }
    );
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