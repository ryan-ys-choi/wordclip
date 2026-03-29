// background.js - runs silently in background
// receives messages from content.js
// calls Python backend

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'wordSelected') {
        const word = message.word;
        console.log("Received word from content.js:", word);

        // Call Python backend
        fetch('http://localhost:8000/search?word=${encodeURIComponent(word)}')
            .then(response => response.json())
            .then(data => {
                // Store the result so popup.html can access it
                chrome.storage.local.set({
                    currentWord: word,
                    videoId: data.video_id,
                    startTime: data.start_time,
                    transcript: data.transcript
                });

                // Open the popup
                chrome.action.openPopup();
                })
                .catch(error => {
                    console.error('Error fetching from backend:', error);
                });
    }
});
