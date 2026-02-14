/**
 * pdfBackend.js - Client-side handler for backend-processed PDF data
 * 
 * This module handles:
 * - Loading backend-processed PDF data
 * - Rendering interactive text overlays
 * - Word-level highlighting during reading
 * - Clickable text elements for navigation
 */

/**
 * Process a PDF file using the backend comprehensive processor
 * @param {File} file - The PDF file to process
 * @param {number} chunkSize - Words per reading chunk (default: 50)
 * @returns {Promise<Object>} Complete structured PDF data
 */
export async function processPDFWithBackend(file, chunkSize = 50) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chunk_size', chunkSize);
    
    try {
        const response = await fetch(`/api/process_pdf_interactive?chunk_size=${chunkSize}`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to process PDF');
        }
        
        const data = await response.json();
        console.log('✅ PDF processed by backend:', {
            pages: data.document.total_pages,
            words: data.document.word_count,
            chunks: data.metadata.total_chunks
        });
        
        return data;
    } catch (error) {
        console.error('❌ Backend PDF processing failed:', error);
        throw error;
    }
}

/**
 * Render interactive text layer for a specific page using backend data
 * @param {Object} pageData - Page data from backend
 * @param {HTMLElement} pageWrapper - The page wrapper element
 * @param {number} currentScale - Current PDF zoom scale
 * @param {Function} onTextClick - Callback when text is clicked
 */
export function renderInteractiveTextLayer(pageData, pageWrapper, currentScale, onTextClick) {
    // Remove existing text layers
    const existingLayers = pageWrapper.querySelectorAll('.backend-text-layer, .backend-text-span');
    existingLayers.forEach(layer => layer.remove());
    
    // Create container for interactive text
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'backend-text-layer';
    textLayerDiv.dataset.page = pageData.page_num;
    textLayerDiv.style.position = 'absolute';
    textLayerDiv.style.left = '0';
    textLayerDiv.style.top = '0';
    textLayerDiv.style.width = '100%';
    textLayerDiv.style.height = '100%';
    textLayerDiv.style.pointerEvents = 'auto';
    textLayerDiv.style.zIndex = '10';
    
    // Calculate scale factors for positioning
    const canvas = pageWrapper.querySelector('canvas');
    if (!canvas) {
        console.warn('⚠️ Canvas not found for page', pageData.page_num);
        return;
    }
    
    const scaleX = canvas.width / pageData.width;
    const scaleY = canvas.height / pageData.height;
    
    // Create text spans for each element
    let spansCreated = 0;
    for (const element of pageData.elements) {
        if (!element.text || element.text.trim() === '') continue;
        
        const span = document.createElement('span');
        span.textContent = element.text;
        span.className = 'backend-text-span';
        span.dataset.elementId = element.id;
        span.dataset.wordIdx = element.word_idx;
        span.dataset.page = pageData.page_num;
        
        // Position and style the span
        span.style.position = 'absolute';
        span.style.left = (element.x * scaleX) + 'px';
        span.style.top = (element.y * scaleY) + 'px';
        span.style.width = (element.width * scaleX) + 'px';
        span.style.height = (element.height * scaleY) + 'px';
        span.style.fontSize = (element.size * scaleY) + 'px';
        span.style.fontFamily = element.font || 'sans-serif';
        span.style.color = 'transparent';
        span.style.whiteSpace = 'nowrap';
        span.style.cursor = 'pointer';
        span.style.userSelect = 'text';
        span.style.overflow = 'hidden';
        
        // Add hover effect
        span.style.transition = 'background-color 0.2s';
        span.addEventListener('mouseenter', () => {
            span.style.backgroundColor = 'rgba(66, 153, 225, 0.2)';
        });
        span.addEventListener('mouseleave', () => {
            if (!span.classList.contains('highlighted')) {
                span.style.backgroundColor = 'transparent';
            }
        });
        
        // Handle clicks
        span.addEventListener('click', (e) => {
            const selection = window.getSelection();
            if (!selection || selection.toString().length === 0) {
                e.stopPropagation();
                if (onTextClick) {
                    onTextClick(element, pageData.page_num);
                }
            }
        });
        
        textLayerDiv.appendChild(span);
        spansCreated++;
    }
    
    // Add to page wrapper
    pageWrapper.appendChild(textLayerDiv);
    
    console.log(`✅ Rendered ${spansCreated} text spans for page ${pageData.page_num}`);
}

/**
 * Highlight words for a specific chunk during reading
 * @param {Object} chunkData - Chunk data from backend
 * @param {Object} pdfData - Complete PDF data from backend
 * @param {string} highlightColor - CSS class for highlight color
 */
export function highlightChunk(chunkData, pdfData, highlightColor = 'bg-yellow-300') {
    // Clear previous highlights
    clearAllHighlights();
    
    const wordStart = chunkData.word_start;
    const wordEnd = chunkData.word_end;
    
    // Find and highlight all text spans within the word range
    for (const pageData of pdfData.pages) {
        const pageNum = pageData.page_num;
        const textLayer = document.querySelector(`.backend-text-layer[data-page="${pageNum}"]`);
        
        if (!textLayer) continue;
        
        const spans = textLayer.querySelectorAll('.backend-text-span');
        spans.forEach(span => {
            const wordIdx = parseInt(span.dataset.wordIdx);
            if (wordIdx >= wordStart && wordIdx < wordEnd) {
                span.classList.add('highlighted', highlightColor);
                span.style.backgroundColor = 'rgba(254, 240, 138, 0.5)'; // yellow-200 with opacity
            }
        });
    }
    
    console.log(`🎯 Highlighted chunk ${chunkData.id}: words ${wordStart}-${wordEnd}`);
}

/**
 * Highlight a single word (for more granular highlighting during playback)
 * @param {number} wordIndex - Global word index to highlight
 * @param {string} highlightColor - Background color for highlight
 */
export function highlightWord(wordIndex, highlightColor = 'rgba(96, 165, 250, 0.6)') {
    // Find the span for this word
    const span = document.querySelector(`.backend-text-span[data-word-idx="${wordIndex}"]`);
    
    if (span) {
        // Remove previous word highlight
        const prevHighlighted = document.querySelector('.current-word-highlight');
        if (prevHighlighted) {
            prevHighlighted.classList.remove('current-word-highlight');
            prevHighlighted.style.backgroundColor = 'rgba(254, 240, 138, 0.5)'; // Return to chunk highlight
        }
        
        // Highlight current word
        span.classList.add('current-word-highlight');
        span.style.backgroundColor = highlightColor;
        
        // Scroll word into view if needed
        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Clear all text highlights
 */
export function clearAllHighlights() {
    const highlightedSpans = document.querySelectorAll('.backend-text-span.highlighted');
    highlightedSpans.forEach(span => {
        span.classList.remove('highlighted', 'current-word-highlight');
        span.style.backgroundColor = 'transparent';
    });
}

/**
 * Get text starting from a clicked element
 * @param {Object} element - The clicked text element
 * @param {Object} pdfData - Complete PDF data from backend
 * @returns {Object} { text: string, startWordIndex: number }
 */
export function getTextFromElement(element, pdfData) {
    const wordIdx = element.word_idx;
    const fullText = pdfData.document.full_text;
    
    // Split full text into words and reconstruct from clicked position
    const words = fullText.match(/\S+/g) || [];
    const textFromPoint = words.slice(wordIdx).join(' ');
    
    return {
        text: textFromPoint,
        startWordIndex: wordIdx,
        clickedText: element.text
    };
}

/**
 * Find the page containing a specific word index
 * @param {number} wordIndex - Global word index
 * @param {Object} pdfData - Complete PDF data from backend
 * @returns {number} Page number (1-indexed)
 */
export function getPageForWord(wordIndex, pdfData) {
    return pdfData.document.word_to_page?.[wordIndex] || 1;
}

/**
 * Get all chunks for the PDF
 * @param {Object} pdfData - Complete PDF data from backend
 * @returns {Array} Array of chunk objects
 */
export function getChunks(pdfData) {
    return pdfData.chunks || [];
}

/**
 * Store PDF data in appState after processing
 * @param {Object} appState - Application state object
 * @param {Object} pdfData - Processed PDF data from backend
 */
export function storePDFData(appState, pdfData) {
    appState.variables.backendPdfData = pdfData;
    appState.variables.pdfChunks = pdfData.chunks;
    appState.variables.fullBookText = pdfData.document.full_text;
    
    console.log('✅ Stored PDF data in appState', {
        pages: pdfData.document.total_pages,
        chunks: pdfData.chunks.length,
        textLength: pdfData.document.full_text.length
    });
}

/**
 * Render all pages with interactive text layers
 * @param {Object} appState - Application state object
 * @param {Function} onTextClick - Callback when text is clicked
 */
export function renderAllPagesWithText(appState, onTextClick) {
    if (!appState.variables.backendPdfData) {
        console.warn('⚠️ No backend PDF data available');
        return;
    }
    
    const pdfData = appState.variables.backendPdfData;
    
    // Wait for pages to be rendered, then add text layers
    setTimeout(() => {
        for (const pageData of pdfData.pages) {
            const pageWrapper = document.querySelector(`.pdf-page-wrapper[data-page="${pageData.page_num}"]`);
            if (pageWrapper) {
                renderInteractiveTextLayer(
                    pageData,
                    pageWrapper,
                    appState.variables.currentScale || 1.0,
                    onTextClick
                );
            }
        }
    }, 500);
}
