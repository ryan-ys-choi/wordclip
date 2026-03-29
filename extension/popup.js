// popup.js - runs when popup opens
// reads saved data and displays the video

document.addEventListener("DOMContentLoaded", () => {
    const loading = document.getElementById("loading");
    const error = document.getElementById("error");
    const content = document.getElementById("content");
    const wordEl = document.getElementById("word");
    const player = document.getElementById("youtube-player");
    const transcriptEl = document.getElementById("transcript");

    // Read saved data from background.js
    chrome.storage.local.get(
        ["currentWord", "videoId", "startTime", "transcript"],
        (data) => {
            if (!data.videoId) {
                loading.style.display = "none";
                error.style.display = "block";
                return;
            }

            // Show the word
            wordEl.textContent = data.currentWord;

            // Load the YouTube video at exact timestamp
            player.src = `https://www.youtube.com/embed/${data.videoId}?start=${data.startTime}&autoplay=1`;

            // Highlight the word in transcript
            const highlighted = data.transcript.replace(
                new RegExp(data.currentWord, "gi"),
                '<span>$&</span>'
            );
            transcriptEl.innerHTML = highlighted;

            // Show content
            loading.style.display = "none";
            content.style.display = "block";
         }
  );
});   