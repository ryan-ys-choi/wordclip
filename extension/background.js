chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "wordSelected") {
    const word = message.word;
    console.log("Received word from content.js:", word);

    fetch(`http://localhost:8000/search?word=${encodeURIComponent(word)}`)
      .then(response => response.json())
      .then(data => {
        console.log("Data received:", data);
        sendResponse(data);
      })
      .catch(error => {
        console.error("Fetch error:", error);
        sendResponse({ error: error.message });
      });

    return true; // keeps message channel open for async response
  }
});