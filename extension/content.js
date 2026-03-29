// content.js runs on every webpage automatically

// Listen for when user finishes selecting text
document.addEventListener('mouseup', () => {
    const selectedText = window.getSelection().toString().trim();

    // Only trigger if user selected a single word
    if (selectedText && selectedText.split(" ").length === 1) {
        console.log("Word selected:", selectedText);

        // Send the word to background.js
        chrome.runtime.sendMessage({
            action: 'wordSelected',
            word: selectedText
        });
    }
});
  