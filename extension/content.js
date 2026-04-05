let tooltip = null;

document.addEventListener("mouseup", async () => {
  const selectedText = window.getSelection().toString().trim();

  // Remove existing tooltip
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }

  if (selectedText && selectedText.split(" ").length === 1) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    try {
      // Call backend directly from content.js
      const response = await fetch(
        `http://localhost:8000/search?word=${encodeURIComponent(selectedText)}`
      );
      const data = await response.json();

      if (data.video_id) {
        showTooltip(rect, selectedText, data);
      }
    } catch (error) {
      console.error("WordClip error:", error);
    }
  }
});

function showTooltip(rect, word, data) {
  tooltip = document.createElement("div");
  tooltip.style.cssText = `
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

  tooltip.innerHTML = `
    <div style="color:#00e5a0;font-size:11px;letter-spacing:1px;margin-bottom:6px">WORDCLIP</div>
    <div style="font-size:22px;font-weight:bold;margin-bottom:10px">${word}</div>
    <iframe 
      src="https://www.youtube.com/embed/${data.video_id}?autoplay=1&start=${data.start_time}"
      width="100%" height="180" frameborder="0" allowfullscreen
      style="border-radius:8px"
    ></iframe>
    <div style="margin-top:10px;font-size:12px;color:#aaa;line-height:1.5">${data.transcript}</div>
    <div style="text-align:right;margin-top:8px">
      <span id="wordclip-close"
        style="cursor:pointer;color:#666;font-size:11px">✕ close</span>
    </div>
  `;

  document.body.appendChild(tooltip);

  document.getElementById("wordclip-close").addEventListener("click", () => {
    tooltip.remove();
    tooltip = null;
  });

  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener("mousedown", (e) => {
      if (tooltip && !tooltip.contains(e.target)) {
        tooltip.remove();
        tooltip = null;
      }
    }, { once: true });
  }, 100);
}
  