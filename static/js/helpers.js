/**
 * -- helpers.js
 * --
 * -- Functions that don't need page context.
 *
 */

/**
 * Format a UNIX timecode into a humanized relative string.
 * @param {int} timestamp UNIX timecode.
 * @returns {string} The formatted string, such as "1h ago", or "just now".
 */
export function readableUnixTime(timestamp) {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
  
    if (diffDay > 0) return `${diffDay}d ago`;
    if (diffHr > 0) return `${diffHr}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'just now';
  }

/**
 * Manages preferences in localStorage under the 'prefs' key.
 * @param {string | object} [data] - The key to get (string) or an object of settings to save.
 * @param {*} [defaultValue] - A default value to return if the key isn't found (only for GET).
 * @returns {*} The requested value, the full settings object, or the newly saved settings.
 */
export const handlePrefs = (data, defaultValue = null) => {
    const currentPrefs = JSON.parse(localStorage.getItem('prefs') || '{}');

    // If data is an object, merge it with current prefs and save.
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const newPrefs = { ...currentPrefs, ...data };
        localStorage.setItem('prefs', JSON.stringify(newPrefs));
        return newPrefs; // Return the new, complete settings object
    }

    // If data is a string (a key), return that specific pref.
    if (typeof data === 'string') {
        // Use nullish coalescing (??) to correctly handle falsy values like 'false' or 0
        return currentPrefs[data] ?? defaultValue;
    }

    // If no data is provided, return the whole object.
    return currentPrefs;
};

/**
 * Save the current local books object to localStorage.
 * @param {object} appState The main app state object.
 */
export function saveLocalBooks(appState) {
    localStorage.setItem('books', JSON.stringify(appState.variables.localBooks));
}

/**
 * Attempts to split a string into chunks, trying to keep phrases and HTML tags intact.
 *
 * @param {string} text - The full text to chunk.
 * @param {int} chunkSize - The size of the chunks, in chars.
 * @returns {array} The array of text chunks.
 */
export function splitTextIntoChunks(text, chunkSize) {
    // Get local chunk size from prefs, default to 200 if not found or invalid
    let prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
    const parsedChunkSize = parseInt(prefs.chunkSize);
    chunkSize = (!isNaN(parsedChunkSize) && parsedChunkSize > 0) ? parsedChunkSize : 200;

    const chunks = [];
    let currentIndex = 0;
    
    while (currentIndex < text.length) {
        // Find the next chunk boundary that doesn't split words or HTML tags
        let chunkEnd = Math.min(currentIndex + chunkSize, text.length);
        
        // If we're not at the end of text, look for a good break point
        if (chunkEnd < text.length) {
            // Look for word boundaries (space, punctuation followed by space)
            let wordBoundary = text.lastIndexOf(' ', chunkEnd);
            let sentenceBoundary = Math.max(
                text.lastIndexOf('. ', chunkEnd),
                text.lastIndexOf('! ', chunkEnd),
                text.lastIndexOf('? ', chunkEnd)
            );
            
            // Look for HTML/XML tag boundaries
            let tagBoundary = -1;
            let inTag = false;
            for (let i = chunkEnd; i >= currentIndex; i--) {
                if (text[i] === '>') {
                    inTag = false;
                    tagBoundary = i + 1;
                    break;
                } else if (text[i] === '<') {
                    inTag = true;
                    tagBoundary = i;
                    break;
                }
            }
            
            // Choose the best boundary
            let bestBoundary = Math.max(wordBoundary, sentenceBoundary, tagBoundary);
            
            // If we found a good boundary and it's not too far back, use it
            if (bestBoundary > currentIndex && bestBoundary > currentIndex + (chunkSize * 0.5)) {
                chunkEnd = bestBoundary;
            } else if (wordBoundary > currentIndex) {
                // Fallback to word boundary
                chunkEnd = wordBoundary;
            }
            // Otherwise keep the original chunkEnd (might split a word, but better than infinite loop)
        }
        
        const chunkText = text.substring(currentIndex, chunkEnd).trim();
        if (chunkText) {
            chunks.push({
                id: `chunk-${currentIndex}`,
                text: chunkText,
                startIndex: currentIndex,
                endIndex: chunkEnd
            });
        }
        
        // Move to next chunk, skipping any leading whitespace
        currentIndex = chunkEnd;
        while (currentIndex < text.length && /\s/.test(text[currentIndex])) {
            currentIndex++;
        }
    }
    
    return chunks;
}

/**
 * Calculates the similarity between two strings and checks if it meets a minimum percentage.
 * Similarity is determined using the Levenshtein distance.
 *
 * @param {string} stringA The first string.
 * @param {string} stringB The second string.
 * @param {number} minPercentage The minimum required similarity percentage (e.g., 80 for 80%).
 * @returns {boolean} Returns true if stringA is at least X percent similar to stringB.
 */
export function isSimilar(stringA, stringB, minPercentage) {
    // Handle invalid percentage input
    if (minPercentage < 0 || minPercentage > 100) {
        throw new Error("Percentage must be between 0 and 100.");
    }

    // Find the length of the longer string
    const maxLength = Math.max(stringA.length, stringB.length);

    // If both strings are empty, they are 100% similar
    if (maxLength === 0) {
        return true;
    }

    // Calculate the Levenshtein distance between the strings
    const distance = levenshteinDistance(stringA, stringB);

    // Convert the distance to a similarity percentage
    const similarity = (1 - distance / maxLength) * 100;

    // Check if the similarity meets the minimum requirement
    return similarity >= minPercentage;
    }

    /**
     * A helper function to calculate the Levenshtein distance between two strings.
     * This is the number of edits needed to change one string into the other.
     * @param {string} str1 The first string.
     * @param {string} str2 The second string.
     * @returns {number} The edit distance.
     */
    function levenshteinDistance(str1 = '', str2 = '') {
    // Create a 2D array to store distances
    const track = Array(str2.length + 1).fill(null).map(() =>
        Array(str1.length + 1).fill(null)
    );

    // Initialize the first row and column of the matrix
    for (let i = 0; i <= str1.length; i++) {
        track[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
        track[j][0] = j;
    }

    // Fill the rest of the matrix
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
            track[j][i - 1] + 1, // Deletion
            track[j - 1][i] + 1, // Insertion
            track[j - 1][i - 1] + indicator, // Substitution
        );
        }
    }

    // The final distance is in the bottom-right cell
    return track[str2.length][str1.length];
}

/**
 * Processes a string by repeatedly checking its similarity against a reference string.
 * If not similar, it splits the string in half and retries, until the string
 * is 3 words or less, or until it is found to be similar.
 * @param {string} initialString The string to start with.
 * @param {string} comparisonString The string to compare against.
 * @param {number} minPercentage The similarity threshold.
 * @returns {string} The final resulting string.
 */
export function checkPhraseSimilarity(initialString, comparisonString, minPercentage) {
    let currentString = initialString;

    // We use a while loop that checks the word count on each iteration
    while (currentString.split(' ').length > 3) {
        if (isSimilar(currentString, comparisonString, minPercentage)) {
        break; // Exit the loop if similarity is met
        } else {
        const words = currentString.split(' ');
        const midPoint = Math.floor(words.length / 2);
        
        // Keep the first half of the words
        currentString = words.slice(0, midPoint).join(' ');
        }
    }

    if (currentString.split(' ').length <= 3) {
        return false;
    }

    return true;
}

/**
 * Detects header and footer text items from PDF text extraction data.
 * @param {Object} pdfData - The JSON object with "items" array
 * @param {number} [pageHeight] - Height of the page (you may need to infer or pass it)
 * @returns {Object} { headers: [], footers: [], body: [] }
 */
export function detectHeadersAndFooters(pdfData, pageHeight = 842) {
    // If pageHeight is unknown, try to infer from max y + font height
    if (!pageHeight) {
        const maxY = Math.max(...pdfData.items.map(item => item.transform[5] || 0));
        pageHeight = maxY + 50; // rough estimate
    }

    const HEADER_THRESHOLD = 0.85 * pageHeight;
    const FOOTER_THRESHOLD = 0.15 * pageHeight;

    // Helper: Check if string looks like a page number or citation
    function isLikelyFooterText(str) {
        const strTrim = str.trim();
        // Page numbers: "20", "Page 3", "p. 5", "- 3 -"
        const pageNumberPatterns = [
        /^\d+$/, // just a number
        /^Page\s+\d+$/i,
        /^p\.\s*\d+$/i,
        /^-\s*\d+\s*-\s*$/,
        ];
        // Citation patterns: "70.", "71. Author (1999)"
        const citationPattern = /^\d+\.\s*/;

        return (
        pageNumberPatterns.some(p => p.test(strTrim)) ||
        citationPattern.test(strTrim)
        );
    }

    // Keep the same original structure.
    const headers = { items: [] };
    const footers = { items: [] };
    const body = { items: [] };

    for (const item of pdfData.items) {
        const y = item.transform[5]; // y position from bottom
        const fontSize = item.height;

        // Skip empty strings
        if (!item.str.trim()) continue;

        let isHeader = false;
        let isFooter = false;

        // Only a number/single character  → likely header
        if (!isNaN(parseInt(item.str, 10))) {
            isHeader = true;
        }

        if (item.str.length === 1) {
            isHeader = true;
        }

        // Small font + high position → likely header
        if ( (fontSize < 10) && (y > HEADER_THRESHOLD) ) {
            isHeader = true;
        }

        // Small font + low position → likely footer
        if ( (fontSize < 10) &&  (y < FOOTER_THRESHOLD) ) {
            isFooter = true;
        }

        // Content pattern
        if (isLikelyFooterText(item.str)) {
            isFooter = true;
        }

        // Assign
        if (isHeader) {
            headers.items.push(item);
        } else if (isFooter) {
            footers.items.push(item);
        } else {
            body.items.push(item);
        }
    }

    return { headers, footers, body };
}

/**
 * 
 * @param {*} multiPageItems 
 * @param {*} [pageHeight] 
 * @returns 
 */
export function findRepeatedFooters(multiPageItems, pageHeight = 842) {
    const allFooters = multiPageItems.flatMap(page => 
        detectHeadersAndFooters(page, pageHeight).footers.map(item => item.str.trim())
    );

    const freq = {};
    for (const text of allFooters) {
        freq[text] = (freq[text] || 0) + 1;
    }

    // Return texts appearing on > 50% of pages
    const threshold = multiPageItems.length / 2;
    return Object.keys(freq).filter(text => freq[text] > threshold);
}

/**
 * 
 * @param {*} pdf 
 * @param {*} options 
 * @returns 
 */
export async function getAllPdfText(pdf, options={}) {

    const maxPages = pdf.numPages;
    let countPromises = []; // collecting all page promises

    for (var j = 1; j <= maxPages; j++) {

      const page = await pdf.getPage(j);
      const textContent = await page.getTextContent();
      let parsedTextContent = textContent;            
        
        if (options.skipHeadersNFooters && options.canvasHeight) {
            parsedTextContent = detectHeadersAndFooters(textContent, options.canvasHeight);
            countPromises.push(parsedTextContent.body.items.map(function (s) { return s.str; }).join('')); // value page text
        } else {
            countPromises.push(parsedTextContent.items.map(function (s) { return s.str; }).join('')); // value page text
        }

    }

    var parsedOutputText = countPromises.join('').trim();
    return parsedOutputText;
}

/**
 * Sets the user selected fonts and styles.
 * @param {object} [prefs] Object containting the local preferences.
 */
export function setBodyFont(prefs) {
    if (!prefs) prefs = JSON.parse(localStorage.getItem('prefs') || '{}');

    const fontStyle = prefs.accessibleFontEnabled ? prefs.accessibleFontStyle : 'Merriweather';
    const textView = document.querySelector('#text-display');
    const fontFamily = `${fontStyle}, var(--default-font-family)`;

    if (prefs.accessibleFontUIEnabled) document.body.style.fontFamily = fontFamily;
    else if (textView) textView.style.fontFamily = fontFamily;

    // Yeah, we do more than just set the font here.
    if (prefs.theme === 'dark') document.documentElement.classList.add('dark');
    else if (prefs.theme === 'light') document.documentElement.classList.remove('dark');

    if (prefs.useBlackBG && prefs.theme === 'dark') {
        document.body.classList.remove('dark:bg-gray-900');
        document.body.classList.add('dark:bg-black');
    }
}

/**
 * Quickly detect text format.
 * @param {string} text 
 * @returns {string} 'html', 'markdown', or 'plain'.
 */
export function fastFormatDetect(text) {
    if (/<([a-z][a-z0-9]*)\b[^>]*>/i.test(text)) return 'html';
    if (/(\*\*|__|#|`|\[.*\]\(|^-|\d+\.\s)/.test(text)) return 'markdown';
    return 'plain';
}

/**
 * Detects and parses a text for rendering.
 * @param {string} text The text for the page.
 * @returns An element that can be assigned to innerHTML.
 */
export function parseTextContent(text) {
    const detectedFormat = fastFormatDetect(text);
    console.debug(`Detected format ${detectedFormat}`);
    
    switch (detectedFormat) {
        case 'html':
            return text;
        case 'markdown':
            return marked.parse(text);
        case 'plain':
            return text;
    }
}

/**
 * Calculates the visible area of an element in pixels.
 * @param {Element} el - The DOM element to check.
 * @returns {number} - The visible area in square pixels.
 */
export function getVisibleArea(el) {
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 1. Find the visible top/bottom edges
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(viewportHeight, rect.bottom);

    // 2. Find the visible left/right edges
    const visibleLeft = Math.max(0, rect.left);
    const visibleRight = Math.min(viewportWidth, rect.right);

    // 3. Calculate visible height and width (clamped at 0)
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);

    return visibleWidth * visibleHeight;
}

/**
 * Returns the page that is most visisble for the user.
 * @param {Element} container The container for the pages.
 * @returns {Element} The element most visible.
 */
export function getCurrentMainVisiblePage(container) {
    if (!container) return null;

    // Figure out the page the user is most looking at.
    let mostVisibleElement = null;
    let maxVisibleArea = 0;

    Array.from(container.children).forEach(div => {
        const visibleArea = getVisibleArea(div);
        
        if (visibleArea > maxVisibleArea) {
            maxVisibleArea = visibleArea;
            mostVisibleElement = div;
        }
    });

    // If we are looking at nothing, something is wrong.
    if (!mostVisibleElement) return null;

    return mostVisibleElement;
}

/**
 * Parse PDF.js page object into text.
 * @param {object} textObject Page object adquired from PDF.js
 * @returns {string} The parsed page text.
 */
export function mapTextContent(textObject) {
    return textObject.items.map(item => item.str).join(' ');
}

/**
 * Create a cancellable sleep timer with callback function.
 * @param {*} duration 
 * @param {*} callback 
 * @returns 
 */
export function createSleepTimer(duration, callback) {
    let timerId = setTimeout(() => {
        try {
        // Clear reference BEFORE invoking callback to prevent race conditions during cancellation
        const currentTimerId = timerId;
        timerId = null;
        callback();
        } catch (error) {
        // Re-throw after cleanup to avoid swallowing exceptions
        timerId = null;
        throw error;
        }
    }, duration);

    return {
        cancel: function() {
            if (timerId !== null) {
                clearTimeout(timerId);
                timerId = null;
            }
        }
    };
}

/**
 * 
 * @param {*} audioBlob 
 */
export async function transcribeAudio(appState, audioBlob) {
    try {
        appState.elements.recordBtn.disabled = true;
        appState.elements.recordBtn.innerHTML = '<i class="animate-spin fas fa-rotate-right"></i> Processing...';
        
        const formData = new FormData();
        let fileExtension = 'webm';
        if (audioBlob.type.includes('mp4')) fileExtension = 'mp4';
        else if (audioBlob.type.includes('wav')) fileExtension = 'wav';
        formData.append('file', audioBlob, `recording.${fileExtension}`);
        
        const response = await fetch('/api/speech_to_text', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to transcribe audio.');
        }
        
        const data = await response.json();
        
        if (data.text && data.text.trim()) {
            const currentText = appState.elements.textDisplay.textContent || '';
            const newText = currentText + (currentText ? '\n\n' : '') + data.text;
            appState.elements.textDisplay.textContent = newText;
            
            if (appState.variables.activeBook && appState.variables.activeBook.source === 'local') {
                appState.variables.localBooks[appState.variables.activeBook.id].text = newText;
                saveLocalBooks(appState);
            }
            appState.functions.showNotification(`Transcription completed! Detected language: ${data.language || 'Unknown'}`, 'success');
        } else appState.functions.showNotification('No speech detected in the audio.', 'warning');            
    } catch (error) {
        console.error('Error transcribing audio:', error);
        appState.functions.showNotification(`Transcription failed: ${error.message}`, 'error');
    } finally {
        appState.elements.recordBtn.disabled = false;
        appState.elements.recordBtn.innerHTML = '<span class="me-2">Record Audio</span><i class="fas fa-microphone"></i>';
    }
}

/**
 * Start recording an audioBlob to transcribe, or upload.
 * @param {object} appState The main appState object.
 */
export async function startRecording(appState) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/wav';
        
        appState.variables.mediaRecorder = new MediaRecorder(stream, { mimeType });
        appState.variables.audioChunks = [];
        
        appState.variables.mediaRecorder.ondataavailable = (event) => appState.variables.audioChunks.push(event.data);
        
        appState.variables.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(appState.variables.audioChunks, { type: mimeType });
            await transcribeAudio(appState, audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        
        appState.variables.mediaRecorder.start();
        appState.variables.isRecording = true;
        
        appState.elements.recordBtn.classList.add('hidden');
        appState.elements.stopRecordBtn.classList.remove('hidden');
        appState.elements.recordingIndicator.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        appState.functions.showNotification('Failed to start recording. Please make sure you have granted microphone permissions.', 'error');
    }
}

/**
 * Stops any recording the user is doing.
 * @param {object} appState The main appState object.
 */
export function stopRecording(appState) {
    appState.variables.mediaRecorder?.stop();
    appState.variables.isRecording = false;
    appState.elements.recordBtn.classList.remove('hidden');
    appState.elements.stopRecordBtn.classList.add('hidden');
    appState.elements.recordingIndicator.classList.add('hidden');
}