/**
 * PDF Backend Integration Example
 * 
 * This file demonstrates how to integrate the backend PDF processing
 * into the existing index.js workflow.
 * 
 * Copy and adapt these code snippets into your index.js file.
 */

// ==========================================
// STEP 1: Import the PDF backend module
// ==========================================
// Add this import at the top of index.js with other imports
import {
    processPDFWithBackend,
    storePDFData,
    renderInteractiveTextLayer,
    renderAllPagesWithText,
    highlightChunk,
    highlightWord,
    clearAllHighlights,
    getTextFromElement,
    getPageForWord,
    getChunks
} from './pdfBackend.js';


// ==========================================
// STEP 2: Modify PDF File Upload Handler
// ==========================================
// Find the existing PDF file input handler and replace it with:

appState.elements.pdfFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !file.name.endsWith('.pdf')) {
        showNotification('Please select a valid PDF file', 'warning');
        return;
    }
    
    try {
        // Show loading state
        showNotification('🔄 Processing PDF with backend...', 'info');
        appState.elements.pdfFileInput.disabled = true;
        
        // BACKEND PROCESSING - This does all the heavy lifting
        const pdfData = await processPDFWithBackend(file, 50); // 50 words per chunk
        
        // Store processed data in appState
        storePDFData(appState, pdfData);
        
        // Update UI with document info
        appState.elements.textDisplay.textContent = pdfData.document.full_text;
        appState.variables.fullBookText = pdfData.document.full_text;
        
        // Continue with PDF.js for canvas rendering (visual display)
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        appState.variables.pdfDoc = pdfDoc;
        
        // Render first page (or first two pages if two-page view)
        await renderPage(1, false, false, false);
        
        // Add interactive text layers using backend data
        renderAllPagesWithText(appState, handleBackendTextClick);
        
        showNotification(`✅ PDF ready! ${pdfData.document.total_pages} pages, ${pdfData.document.word_count} words`, 'success');
        
        // Show save button if logged in
        if (appState.variables.currentUser) {
            appState.elements.saveBookBtn.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('❌ PDF processing failed:', error);
        showNotification(`Failed to process PDF: ${error.message}`, 'error');
    } finally {
        appState.elements.pdfFileInput.disabled = false;
    }
});


// ==========================================
// STEP 3: Handle Text Clicks
// ==========================================
// Add this function to handle clicks on text elements

function handleBackendTextClick(element, pageNum) {
    // Prevent triggering if user is selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
        return;
    }
    
    const pdfData = appState.variables.backendPdfData;
    if (!pdfData) {
        console.warn('No PDF data available');
        return;
    }
    
    // Get text from clicked position to end
    const { text, startWordIndex, clickedText } = getTextFromElement(element, pdfData);
    
    console.log(`📍 Clicked on word ${startWordIndex}: "${clickedText}"`);
    showNotification(`🎵 Starting from: "${clickedText.substring(0, 30)}..."`, 'info');
    
    // Update current page and reading position
    appState.variables.currentPageNum = pageNum;
    appState.variables.currentWordIndex = startWordIndex;
    
    // Start reading from this point
    processTextAndPlayFromWord(text, pageNum, startWordIndex);
}


// ==========================================
// STEP 4: Update Page Rendering
// ==========================================
// Modify the existing renderPage function to add text layers
// Add this at the end of the renderPage function:

async function renderPage(num, skipTextExtraction = false, append = true, prepend = false) {
    // ... existing render code ...
    
    // After canvas rendering completes, add interactive text layer
    if (appState.variables.backendPdfData && !skipTextExtraction) {
        // Wait a bit for canvas to be ready
        setTimeout(() => {
            const pdfData = appState.variables.backendPdfData;
            const pageData = pdfData.pages.find(p => p.page_num === num);
            const pageWrapper = appState.elements.pdfViewer.querySelector(
                `.pdf-page-wrapper[data-page="${num}"]`
            );
            
            if (pageData && pageWrapper) {
                renderInteractiveTextLayer(
                    pageData,
                    pageWrapper,
                    appState.variables.currentScale,
                    handleBackendTextClick
                );
            }
            
            // If two-page view, render text layer for second page too
            if (appState.variables.isTwoPageView && num + 1 <= pdfData.document.total_pages) {
                const pageData2 = pdfData.pages.find(p => p.page_num === num + 1);
                const pageWrapper2 = appState.elements.pdfViewer.querySelector(
                    `.pdf-page-wrapper[data-page="${num + 1}"]`
                );
                
                if (pageData2 && pageWrapper2) {
                    renderInteractiveTextLayer(
                        pageData2,
                        pageWrapper2,
                        appState.variables.currentScale,
                        handleBackendTextClick
                    );
                }
            }
        }, 300); // Delay to ensure canvas is ready
    }
    
    // ... rest of existing code ...
}


// ==========================================
// STEP 5: Integrate with Audio Playback
// ==========================================
// Modify the audio playback to highlight chunks/words

function playAudioChunkWithHighlight(chunkIndex) {
    const pdfData = appState.variables.backendPdfData;
    if (!pdfData || !pdfData.chunks[chunkIndex]) {
        console.warn('No chunk data for highlighting');
        return;
    }
    
    const chunk = pdfData.chunks[chunkIndex];
    
    // Clear previous highlights
    clearAllHighlights();
    
    // Highlight the entire chunk
    highlightChunk(chunk, pdfData, 'bg-yellow-200');
    
    // Ensure the page containing this chunk is visible
    const chunkPage = chunk.page_start;
    if (appState.variables.currentPageNum !== chunkPage) {
        renderPage(chunkPage);
    }
    
    // Play audio for this chunk
    const audioUrl = `/audio_cache/${appState.variables.currentUser}/${chunk.id}.mp3`;
    const audio = new Audio(audioUrl);
    
    // Word-by-word highlighting during playback
    let currentWord = chunk.word_start;
    const wordsInChunk = chunk.word_end - chunk.word_start;
    
    audio.ontimeupdate = () => {
        const progress = audio.currentTime / audio.duration;
        const wordOffset = Math.floor(progress * wordsInChunk);
        const wordToHighlight = chunk.word_start + wordOffset;
        
        if (wordToHighlight !== currentWord && wordToHighlight < chunk.word_end) {
            highlightWord(wordToHighlight, 'rgba(59, 130, 246, 0.7)'); // blue highlight
            currentWord = wordToHighlight;
        }
    };
    
    audio.onended = () => {
        // Play next chunk or clear highlights
        if (chunkIndex + 1 < pdfData.chunks.length) {
            playAudioChunkWithHighlight(chunkIndex + 1);
        } else {
            clearAllHighlights();
        }
    };
    
    audio.play();
    appState.variables.currentAudio = audio;
}


// ==========================================
// STEP 6: Enhanced Text Processing
// ==========================================
// New function to process text starting from a specific word

async function processTextAndPlayFromWord(text, pageNum, startWordIndex) {
    const pdfData = appState.variables.backendPdfData;
    
    // Find which chunk this word belongs to
    let startChunkIndex = 0;
    for (let i = 0; i < pdfData.chunks.length; i++) {
        const chunk = pdfData.chunks[i];
        if (startWordIndex >= chunk.word_start && startWordIndex < chunk.word_end) {
            startChunkIndex = i;
            break;
        }
    }
    
    console.log(`🎵 Starting playback from chunk ${startChunkIndex} (word ${startWordIndex})`);
    
    // Update state
    appState.variables.currentChunkIndex = startChunkIndex;
    appState.variables.currentWordIndex = startWordIndex;
    appState.variables.isPlaying = true;
    
    // Start playing
    playAudioChunkWithHighlight(startChunkIndex);
}


// ==========================================
// STEP 7: Handle Zoom Changes
// ==========================================
// Update text layers when zoom changes

appState.elements.zoomInBtn.addEventListener('click', () => {
    appState.variables.currentScale *= 1.2;
    appState.elements.zoomLevel.textContent = Math.round(appState.variables.currentScale * 100) + '%';
    
    // Re-render current page with new scale
    const currentPage = appState.variables.currentPageNum;
    renderPage(currentPage, false, false, false);
});

appState.elements.zoomOutBtn.addEventListener('click', () => {
    appState.variables.currentScale /= 1.2;
    appState.elements.zoomLevel.textContent = Math.round(appState.variables.currentScale * 100) + '%';
    
    // Re-render current page with new scale
    const currentPage = appState.variables.currentPageNum;
    renderPage(currentPage, false, false, false);
});


// ==========================================
// STEP 8: Clean Up on Reset
// ==========================================
// Clear backend data when closing PDF

function resetPdfViewEnhanced(appState) {
    // Call existing reset function
    resetPdfView(appState);
    
    // Clear backend data
    clearAllHighlights();
    appState.variables.backendPdfData = null;
    appState.variables.pdfChunks = null;
    appState.variables.currentWordIndex = 0;
    appState.variables.currentChunkIndex = 0;
    
    console.log('✅ PDF view and backend data cleared');
}


// ==========================================
// STEP 9: Add to appState variables
// ==========================================
// Add these variables to your appState.variables object initialization

appState.variables = {
    // ... existing variables ...
    
    // Backend PDF data
    backendPdfData: null,          // Complete processed PDF data from backend
    pdfChunks: null,               // Array of reading chunks
    currentWordIndex: 0,           // Current word being read
    currentChunkIndex: 0,          // Current chunk being played
    
    // ... rest of existing variables ...
};


// ==========================================
// USAGE EXAMPLE
// ==========================================

/*
When user uploads a PDF:

1. Backend processes PDF -> returns complete structured data
2. Store data in appState.variables.backendPdfData
3. Render PDF pages using PDF.js (visual display)
4. Overlay interactive text using backend data
5. User clicks on any word -> starts reading from that word
6. During playback, highlight words in real-time
7. User can click any other word to jump to that position
*/
