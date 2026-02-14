// Enhanced Content script for OpenWebTTS browser extension
// Features: Floating buttons, draggable menu, clickable text, improved UI/UX

(function() {
    'use strict';
    
    // Get browser API (works for both Chrome and Firefox)
    const browser = window.browser || window.chrome;
    
    // State management
    const state = {
        isReading: false,
        currentChunkIndex: 0,
        chunks: [],
        audioQueue: [],
        currentAudio: null,
        settings: null,
        highlightedElements: [],
        currentWordElement: null,
        previousChunkElement: null,
        audioBlobUrls: [],  // Track blob URLs for CSP bypass
        floatingMenu: null,
        isMenuVisible: false,
        menuPosition: { x: window.innerWidth - 320, y: 100 }
    };
    
    // Initialize extension
    console.log('🔊 OpenWebTTS Enhanced Extension loaded');
    
    // Create floating menu
    function createFloatingMenu() {
        if (state.floatingMenu) return;
        
        const menu = document.createElement('div');
        menu.id = 'owtts-floating-menu';
        menu.className = 'owtts-floating-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${state.menuPosition.y}px;
            right: 20px;
            width: 280px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 999999;
            padding: 20px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: none;
            backdrop-filter: blur(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        menu.innerHTML = `
            <div class="owtts-menu-header" style="cursor: move; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700;">🔊 OpenWebTTS</h3>
                <button id="owtts-close-menu" style="background: rgba(255, 255, 255, 0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">×</button>
            </div>
            <div class="owtts-menu-content">
                <div class="owtts-status" id="owtts-status" style="background: rgba(255, 255, 255, 0.15); padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 13px; text-align: center;">
                    Ready to read
                </div>
                <div class="owtts-controls" style="display: flex; flex-direction: column; gap: 10px;">
                    <button id="owtts-read-page" class="owtts-btn owtts-btn-primary" style="background: white; color: #667eea; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.2s;">
                        📖 Read Page
                    </button>
                    <button id="owtts-read-selection" class="owtts-btn owtts-btn-secondary" style="background: rgba(255, 255, 255, 0.2); color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.2s;">
                        📝 Read Selection
                    </button>
                    <button id="owtts-stop-reading" class="owtts-btn owtts-btn-danger" style="background: #ef4444; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; transition: all 0.2s; display: none;">
                        ⏹️ Stop
                    </button>
                </div>
                <div class="owtts-progress" id="owtts-progress" style="margin-top: 15px; display: none;">
                    <div style="background: rgba(255, 255, 255, 0.2); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
                        <div id="owtts-progress-bar" style="width: 0%; height: 100%; background: white; transition: width 0.3s;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; opacity: 0.9;">
                        <span id="owtts-chunk-counter">Chunk 0/0</span>
                        <span id="owtts-time-remaining">--:--</span>
                    </div>
                </div>
                <div class="owtts-shortcuts" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.2); font-size: 11px; opacity: 0.8;">
                    <div><kbd>Ctrl+Shift+R</kbd> Read Page</div>
                    <div style="margin-top: 4px;"><kbd>Ctrl+Shift+S</kbd> Read Selection</div>
                    <div style="margin-top: 4px;"><kbd>Ctrl+Shift+X</kbd> Stop</div>
                    <div style="margin-top: 4px;"><kbd>Ctrl+Click</kbd> Read from here</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(menu);
        state.floatingMenu = menu;
        
        // Make draggable
        makeDraggable(menu);
        
        // Add event listeners
        document.getElementById('owtts-close-menu').addEventListener('click', () => {
            menu.style.display = 'none';
            state.isMenuVisible = false;
        });
        
        document.getElementById('owtts-read-page').addEventListener('click', () => {
            startReading('page', state.settings);
        });
        
        document.getElementById('owtts-read-selection').addEventListener('click', () => {
            startReading('selection', state.settings);
        });
        
        document.getElementById('owtts-stop-reading').addEventListener('click', () => {
            stopReading();
        });
        
        // Load settings
        browser.storage.local.get('settings').then(result => {
            state.settings = result.settings || {
                backendUrl: 'http://localhost:8000',
                voice: 'piper',
                speed: 1.0,
                chunkSize: 50,
                autoScroll: true,
                wordHighlight: true,
                highlightColor: 'yellow',
                wordHighlightColor: 'yellow'
            };
        });
    }
    
    // Make element draggable
    function makeDraggable(element) {
        const header = element.querySelector('.owtts-menu-header');
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.id === 'owtts-close-menu') return;
            isDragging = true;
            initialX = e.clientX - state.menuPosition.x;
            initialY = e.clientY - state.menuPosition.y;
            element.style.transition = 'none';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            state.menuPosition.x = currentX;
            state.menuPosition.y = currentY;
            element.style.right = 'auto';
            element.style.left = currentX + 'px';
            element.style.top = currentY + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            }
        });
    }
    
    // Add paragraph buttons (optimized with event delegation)
    function addParagraphButtons() {
        // Remove existing button if any
        const existingBtn = document.querySelector('.owtts-para-btn');
        if (existingBtn) existingBtn.remove();
        
        // Create a single reusable button
        const button = document.createElement('button');
        button.className = 'owtts-para-btn';
        button.innerHTML = '▶';
        button.title = 'Click to read from this paragraph';
        button.style.cssText = `
            position: fixed;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: 2px solid white;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            cursor: pointer;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            z-index: 999998;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        `;
        document.body.appendChild(button);
        
        let currentTarget = null;
        let hideTimeout = null;
        
        // Use event delegation for hover detection
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote');
            if (!target) {
                // Hide button when not over readable element
                if (hideTimeout) clearTimeout(hideTimeout);
                hideTimeout = setTimeout(() => {
                    button.style.opacity = '0';
                    button.style.pointerEvents = 'none';
                    currentTarget = null;
                }, 300);
                return;
            }
            
            // Skip short elements
            if (target.textContent.trim().length < 20) return;
            
            // Check if visible
            const style = window.getComputedStyle(target);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            
            // Clear hide timeout
            if (hideTimeout) clearTimeout(hideTimeout);
            
            // Position button next to element
            const rect = target.getBoundingClientRect();
            button.style.top = (rect.top + rect.height / 2 - 16) + 'px';
            button.style.left = Math.max(10, rect.left - 45) + 'px';
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
            currentTarget = target;
        }, { passive: true });
        
        // Keep button visible when hovering over it
        button.addEventListener('mouseenter', () => {
            if (hideTimeout) clearTimeout(hideTimeout);
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
        });
        
        button.addEventListener('mouseleave', () => {
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                button.style.opacity = '0';
                button.style.pointerEvents = 'none';
                currentTarget = null;
            }, 200);
        });
        
        // Handle button click
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentTarget) return;
            
            const textNodes = [{
                element: currentTarget,
                text: currentTarget.textContent.trim()
            }];
            await readTextNodes(textNodes);
        });
    }
    
    // Make text clickable (like PDF)
    function makeTextClickable() {
        document.addEventListener('click', async (e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            
            // Find the closest readable element
            let target = e.target;
            const readableTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'TD', 'TH', 'DIV', 'SPAN'];
            
            while (target && !readableTags.includes(target.tagName)) {
                target = target.parentElement;
                if (target === document.body) return;
            }
            
            if (!target || !target.textContent.trim()) return;
            
            // Find all readable content starting from this element
            const allElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote'));
            const startIndex = allElements.indexOf(target);
            if (startIndex === -1) return;
            
            // Get elements from clicked one to the end
            const elementsToRead = allElements.slice(startIndex).filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && el.textContent.trim().length > 0;
            });
            
            const textNodes = elementsToRead.map(el => ({
                element: el,
                text: el.textContent.trim()
            }));
            
            await readTextNodes(textNodes);
        });
        
        // Show Ctrl indicator
        let ctrlIndicator = null;
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && !ctrlIndicator) {
                ctrlIndicator = document.createElement('div');
                ctrlIndicator.className = 'owtts-ctrl-indicator';
                ctrlIndicator.textContent = 'Ctrl held - Click text to start reading from there';
                ctrlIndicator.style.cssText = `
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95));
                    color: white;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    z-index: 1000000;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                    animation: owtts-slide-down 0.3s ease-out;
                    pointer-events: none;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                `;
                document.body.appendChild(ctrlIndicator);
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if ((!e.ctrlKey && !e.metaKey) && ctrlIndicator) {
                ctrlIndicator.remove();
                ctrlIndicator = null;
            }
        });
    }
    
    // Extract text from specific nodes
    async function readTextNodes(textNodes) {
        if (state.isReading) {
            stopReading();
            return;
        }
        
        state.isReading = true;
        state.settings = state.settings || await loadSettings();
        state.currentChunkIndex = 0;
        state.chunks = [];
        state.audioQueue = [];
        
        updateMenuStatus('Processing text...', 'loading');
        
        try {
            // Combine all text for timing-based processing
            const fullText = textNodes.map(node => node.text).join(' ');
            
            console.log(`📖 Starting to read with timing-based sync`);
            
            // Request TTS with timing data (separate audio for each chunk)
            const timingData = await requestTTSWithTiming(fullText, state.settings);
            
            console.log(`🎵 Received ${timingData.chunks.length} chunks with timing data`);
            
            // Map timing chunks to DOM elements
            state.chunks = timingData.chunks.map((chunkData, index) => {
                // Find the best matching element for this chunk
                // For now, use first element (can improve matching later)
                const element = textNodes[0]?.element || document.body;
                
                return {
                    text: chunkData.text,
                    element: element,
                    words: chunkData.words.map(w => w.word),
                    startOffset: chunkData.startOffset,
                    endOffset: chunkData.endOffset,
                    audioUrl: chunkData.audioUrl,  // Each chunk has its own audio
                    timingData: chunkData  // Store timing data with chunk
                };
            });
            
            if (state.chunks.length === 0) {
                throw new Error('No readable content found');
            }
            
            updateMenuStatus(`Reading ${state.chunks.length} chunks...`, 'reading');
            showProgress();
            
            // Play chunks sequentially with their own audio and timing data
            for (let i = 0; i < state.chunks.length; i++) {
                if (!state.isReading) break;
                
                state.currentChunkIndex = i;
                updateProgress(i + 1, state.chunks.length);
                
                await playChunkWithTiming(state.chunks[i], i);
            }
            
            // Reading complete
            console.log('✅ Reading complete');
            stopReading();
            
        } catch (error) {
            console.error('Reading error:', error);
            stopReading();
            updateMenuStatus('Error: ' + error.message, 'error');
        }
    }
    
    // Load settings
    async function loadSettings() {
        const result = await browser.storage.local.get('settings');
        return result.settings || {
            backendUrl: 'http://localhost:8000',
            voice: 'piper',
            speed: 1.0,
            chunkSize: 50,
            autoScroll: true,
            wordHighlight: true,
            highlightColor: 'yellow',
            wordHighlightColor: 'yellow'
        };
    }
    
    // Update menu status
    function updateMenuStatus(message, type = 'idle') {
        const statusEl = document.getElementById('owtts-status');
        if (!statusEl) return;
        
        statusEl.textContent = message;
        statusEl.style.background = {
            'idle': 'rgba(255, 255, 255, 0.15)',
            'loading': 'rgba(255, 193, 7, 0.3)',
            'reading': 'rgba(76, 175, 80, 0.3)',
            'error': 'rgba(244, 67, 54, 0.3)'
        }[type] || 'rgba(255, 255, 255, 0.15)';
    }
    
    // Show progress
    function showProgress() {
        const progressEl = document.getElementById('owtts-progress');
        const stopBtn = document.getElementById('owtts-stop-reading');
        const readBtn = document.getElementById('owtts-read-page');
        const selBtn = document.getElementById('owtts-read-selection');
        
        if (progressEl) progressEl.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'block';
        if (readBtn) readBtn.style.display = 'none';
        if (selBtn) selBtn.style.display = 'none';
    }
    
    // Hide progress
    function hideProgress() {
        const progressEl = document.getElementById('owtts-progress');
        const stopBtn = document.getElementById('owtts-stop-reading');
        const readBtn = document.getElementById('owtts-read-page');
        const selBtn = document.getElementById('owtts-read-selection');
        
        if (progressEl) progressEl.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'none';
        if (readBtn) readBtn.style.display = 'block';
        if (selBtn) selBtn.style.display = 'block';
    }
    
    // Update progress
    function updateProgress(current, total) {
        const progressBar = document.getElementById('owtts-progress-bar');
        const chunkCounter = document.getElementById('owtts-chunk-counter');
        const timeRemaining = document.getElementById('owtts-time-remaining');
        
        if (progressBar) {
            const percent = (current / total) * 100;
            progressBar.style.width = `${percent}%`;
        }
        
        if (chunkCounter) {
            chunkCounter.textContent = `Chunk ${current}/${total}`;
        }
        
        if (timeRemaining) {
            const remaining = (total - current) * 3; // Rough estimate
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            timeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    // Extract readable text from page
function extractPageText() {
        const elementsToExclude = ['script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'header', 'footer'];
        const readableElements = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'TD', 'TH', 'ARTICLE', 'SECTION'];
        
        const allElements = Array.from(document.body.getElementsByTagName('*'));
        const textNodes = [];
        
        for (const element of allElements) {
            if (elementsToExclude.includes(element.tagName.toLowerCase())) continue;
            if (!readableElements.includes(element.tagName)) continue;
            
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
            
            const text = element.textContent.trim();
            if (text.length === 0) continue;
            
            // Avoid duplicates (parent and child both selected)
            const hasReadableParent = textNodes.some(node => node.element.contains(element));
            if (hasReadableParent) continue;
            
            textNodes.push({
                element: element,
                text: text
            });
        }
        
        return textNodes;
    }
    
    // Extract selected text
    function extractSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (!selectedText) return null;
        
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        
        return [{
            element: element,
            text: selectedText
        }];
    }
    
    // Split text into chunks
    function splitIntoChunks(textNodes, chunkSize) {
        const chunks = [];
        
        for (const { element, text } of textNodes) {
            if (text.length <= chunkSize) {
                chunks.push({
                    text: text,
                    element: element,
                    words: text.split(/\s+/).filter(w => w.length > 0),
                    startOffset: 0,
                    endOffset: text.length
                });
            } else {
                // Split by sentences
                const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
                let currentChunk = '';
                let startOffset = 0;
                
                for (const sentence of sentences) {
                    if ((currentChunk + sentence).length <= chunkSize) {
                        currentChunk += sentence;
                    } else {
                        if (currentChunk) {
                            const trimmed = currentChunk.trim();
                            const endPos = text.indexOf(trimmed, startOffset) + trimmed.length;
                            chunks.push({
                                text: trimmed,
                                element: element,
                                words: trimmed.split(/\s+/).filter(w => w.length > 0),
                                startOffset: text.indexOf(trimmed, startOffset),
                                endOffset: endPos
                            });
                            startOffset = endPos;
                        }
                        currentChunk = sentence;
                    }
                }
                
                if (currentChunk) {
                    const trimmed = currentChunk.trim();
                    chunks.push({
                        text: trimmed,
                        element: element,
                        words: trimmed.split(/\s+/).filter(w => w.length > 0),
                        startOffset: text.indexOf(trimmed, startOffset),
                        endOffset: text.indexOf(trimmed, startOffset) + trimmed.length
                    });
                }
            }
        }
        
        return chunks;
    }
    
    // Request TTS audio from backend
    async function requestTTS(text, settings) {
        const backendUrl = settings.backendUrl || 'http://localhost:8000';
        
        try {
            const response = await fetch(`${backendUrl}/api/generate_speech`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    voice: settings.voice || 'piper',
                    speed: settings.speed || 1.0
                })
            });
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);
            
            return audioUrl;
        } catch (error) {
            console.error('TTS request failed:', error);
            throw error;
        }
    }
    
    // Request TTS audio with timing data from backend
    async function requestTTSWithTiming(text, settings) {
        const backendUrl = settings.backendUrl || 'http://localhost:8000';
        
        try {
            const response = await fetch(`${backendUrl}/api/generate_speech_with_timing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    voice: settings.voice || 'piper',
                    speed: settings.speed || 1.0,
                    chunkSize: settings.chunkSize || 50
                })
            });
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Convert each chunk's audio URL to a blob URL to bypass CSP restrictions
            for (const chunk of data.chunks) {
                const audioUrl = `${backendUrl}${chunk.audioUrl}`;
                try {
                    const audioResponse = await fetch(audioUrl);
                    if (!audioResponse.ok) {
                        console.warn(`⚠️ Failed to fetch audio: ${audioUrl}`);
                        continue;
                    }
                    const audioBlob = await audioResponse.blob();
                    const blobUrl = URL.createObjectURL(audioBlob);
                    chunk.audioUrl = blobUrl;  // Replace with blob URL
                    state.audioBlobUrls.push(blobUrl);  // Track for cleanup
                } catch (error) {
                    console.error(`Error converting audio to blob: ${error}`);
                }
            }
            
            return {
                audioUrl: data.audioUrl,  // Not used, kept for compatibility
                duration: data.duration,
                chunks: data.chunks,
                normalizedText: data.normalizedText
            };
        } catch (error) {
            console.error('TTS with timing request failed:', error);
            throw error;
        }
    }
    
    // Highlight chunk
    function highlightChunk(chunk) {
        // Clear previous chunk highlights (but not word wrapping)
        state.highlightedElements.forEach(el => {
            if (el.dataset.owttsHighlight === 'chunk') {
                // Unwrap highlight span
                const parent = el.parentNode;
                while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                }
                parent.removeChild(el);
            } else {
                el.classList.remove('owtts-chunk-highlight');
                // Remove all possible color classes
                el.classList.remove('owtts-color-yellow', 'owtts-color-green', 'owtts-color-blue', 'owtts-color-pink', 'owtts-color-orange');
            }
        });
        state.highlightedElements = [];
        
        // Clear word highlighting (but keep word wrapping)
        if (state.currentWordElement) {
            state.currentWordElement.classList.remove('owtts-word-highlight');
            // Remove all possible word color classes
            state.currentWordElement.classList.remove('owtts-word-color-yellow', 'owtts-word-color-green', 'owtts-word-color-blue', 'owtts-word-color-pink', 'owtts-word-color-orange');
            state.currentWordElement.classList.remove('owtts-color-yellow', 'owtts-color-green', 'owtts-color-blue', 'owtts-color-pink', 'owtts-color-orange');
            state.currentWordElement = null;
        }
        
        const element = chunk.element;
        
        // If word wrapping is already applied, highlight word spans instead of wrapping text
        if (element.dataset.owttsProcessed) {
            const wordOffset = parseInt(element.dataset.owttsWordOffset || '0', 10);
            const chunkWordCount = chunk.words.length;
            const wordSpans = element.querySelectorAll('.owtts-word');
            
            // Add chunk highlight class to all words in this chunk
            for (let i = 0; i < chunkWordCount; i++) {
                const span = wordSpans[wordOffset + i];
                if (span) {
                    span.classList.add('owtts-chunk-highlight', `owtts-color-${state.settings.highlightColor}`);
                    state.highlightedElements.push(span);
                }
            }
        } else {
            // No word wrapping, use traditional range-based chunk highlighting
            const fullText = element.textContent;
            const startIdx = fullText.indexOf(chunk.text, chunk.startOffset || 0);
            
            if (startIdx === -1) {
                // Fallback: highlight whole element
                element.classList.add('owtts-chunk-highlight', `owtts-color-${state.settings.highlightColor}`);
                state.highlightedElements.push(element);
            } else {
                // Wrap only the chunk text in a highlight span
                const range = document.createRange();
                const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
                
                let charCount = 0;
                let startNode = null, startNodeOffset = 0;
                let endNode = null, endNodeOffset = 0;
                
                while (walker.nextNode()) {
                    const node = walker.currentNode;
                    const nodeLength = node.textContent.length;
                    
                    if (startNode === null && charCount + nodeLength > startIdx) {
                        startNode = node;
                        startNodeOffset = startIdx - charCount;
                    }
                    
                    if (startNode !== null && charCount + nodeLength >= startIdx + chunk.text.length) {
                        endNode = node;
                        endNodeOffset = startIdx + chunk.text.length - charCount;
                        break;
                    }
                    
                    charCount += nodeLength;
                }
                
                if (startNode && endNode) {
                    try {
                        range.setStart(startNode, startNodeOffset);
                        range.setEnd(endNode, endNodeOffset);
                        
                        const span = document.createElement('span');
                        span.className = `owtts-chunk-highlight owtts-color-${state.settings.highlightColor}`;
                        span.dataset.owttsHighlight = 'chunk';
                        range.surroundContents(span);
                        state.highlightedElements.push(span);
                    } catch (e) {
                        // Fallback if range wrapping fails
                        element.classList.add('owtts-chunk-highlight', `owtts-color-${state.settings.highlightColor}`);
                        state.highlightedElements.push(element);
                    }
                }
            }
        }
        
        // Scroll to element if auto-scroll is enabled
        if (state.settings.autoScroll) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
    
    // Prepare word highlighting by wrapping words in advance
    function prepareWordHighlighting(chunk) {
        // If switching to a different element, clear its word wrapping
        if (state.previousChunkElement && state.previousChunkElement !== chunk.element) {
            if (state.previousChunkElement.dataset.owttsOriginal) {
                state.previousChunkElement.innerHTML = state.previousChunkElement.dataset.owttsOriginal;
                delete state.previousChunkElement.dataset.owttsOriginal;
                delete state.previousChunkElement.dataset.owttsProcessed;
                delete state.previousChunkElement.dataset.owttsChunkId;
                delete state.previousChunkElement.dataset.owttsWordOffset;
            }
        }
        
        // If same element but different chunk index, recalculate offset
        const currentChunkId = state.currentChunkIndex.toString();
        if (chunk.element.dataset.owttsProcessed && chunk.element.dataset.owttsChunkId !== currentChunkId) {
            // Element already processed for a different chunk - recalculate offset
            const textBeforeChunk = chunk.element.textContent.slice(0, chunk.startOffset || 0);
            const wordsBeforeChunk = textBeforeChunk.split(/\s+/).filter(w => w.trim().length > 0).length;
            chunk.element.dataset.owttsWordOffset = wordsBeforeChunk.toString();
            chunk.element.dataset.owttsChunkId = currentChunkId;
        }
        
        // Process current chunk if not already processed
        if (!chunk.element.dataset.owttsProcessed) {
            wrapWordsInSpans(chunk);
            chunk.element.dataset.owttsChunkId = currentChunkId;
            
            // Calculate word offset: count words before chunk's startOffset
            const textBeforeChunk = chunk.element.textContent.slice(0, chunk.startOffset || 0);
            const wordsBeforeChunk = textBeforeChunk.split(/\s+/).filter(w => w.trim().length > 0).length;
            chunk.element.dataset.owttsWordOffset = wordsBeforeChunk.toString();
            
            state.previousChunkElement = chunk.element;
        }
    }
    
    // Highlight individual word
    function highlightWord(chunk, wordIndex) {
        if (state.currentWordElement) {
            state.currentWordElement.classList.remove('owtts-word-highlight');
            // Remove all possible word color classes
            state.currentWordElement.classList.remove('owtts-word-color-yellow', 'owtts-word-color-green', 'owtts-word-color-blue', 'owtts-word-color-pink', 'owtts-word-color-orange');
            state.currentWordElement.classList.remove('owtts-color-yellow', 'owtts-color-green', 'owtts-color-blue', 'owtts-color-pink', 'owtts-color-orange');
            
            // Restore chunk highlighting to previous word
            if (state.currentWordElement.classList.contains('owtts-word')) {
                state.currentWordElement.classList.add('owtts-chunk-highlight', `owtts-color-${state.settings.highlightColor}`);
            }
        }
        
        if (!state.settings.wordHighlight) return;
        
        // Apply the word offset to get the correct position in the element
        const wordOffset = parseInt(chunk.element.dataset.owttsWordOffset || '0', 10);
        const actualWordIndex = wordOffset + wordIndex;
        
        const wordSpans = chunk.element.querySelectorAll('.owtts-word');
        if (wordSpans[actualWordIndex]) {
            // Remove chunk highlighting from current word to show only word color
            wordSpans[actualWordIndex].classList.remove('owtts-chunk-highlight');
            wordSpans[actualWordIndex].classList.remove('owtts-color-yellow', 'owtts-color-green', 'owtts-color-blue', 'owtts-color-pink', 'owtts-color-orange');
            
            // Apply word highlighting
            const wordColor = state.settings.wordHighlightColor || state.settings.highlightColor;
            wordSpans[actualWordIndex].classList.add('owtts-word-highlight', `owtts-word-color-${wordColor}`);
            state.currentWordElement = wordSpans[actualWordIndex];
        }
    }
    
    // Wrap words in spans
    function wrapWordsInSpans(chunk) {
        const element = chunk.element;
        element.dataset.owttsOriginal = element.innerHTML;
        element.dataset.owttsProcessed = 'true';
        
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        while (walker.nextNode()) {
            if (walker.currentNode.textContent.trim().length > 0) {
                textNodes.push(walker.currentNode);
            }
        }
        
        for (const textNode of textNodes) {
            const words = textNode.textContent.split(/(\s+)/);
            const fragment = document.createDocumentFragment();
            
            words.forEach(word => {
                if (word.trim().length > 0) {
                    const span = document.createElement('span');
                    span.className = 'owtts-word';
                    span.textContent = word;
                    fragment.appendChild(span);
                } else if (word.length > 0) {
                    fragment.appendChild(document.createTextNode(word));
                }
            });
            
            textNode.parentNode.replaceChild(fragment, textNode);
        }
    }
    
    // Clear highlights
    function clearHighlights() {
        state.highlightedElements.forEach(el => {
            if (el.dataset.owttsHighlight === 'chunk') {
                // Unwrap highlight span
                const parent = el.parentNode;
                while (el.firstChild) {
                    parent.insertBefore(el.firstChild, el);
                }
                parent.removeChild(el);
            } else {
                el.classList.remove('owtts-chunk-highlight');
                // Remove all possible color classes
                el.classList.remove('owtts-color-yellow', 'owtts-color-green', 'owtts-color-blue', 'owtts-color-pink', 'owtts-color-orange');
            }
        });
        state.highlightedElements = [];
        
        if (state.currentWordElement) {
            state.currentWordElement.classList.remove('owtts-word-highlight');
            // Remove all possible word color classes
            state.currentWordElement.classList.remove('owtts-word-color-yellow', 'owtts-word-color-green', 'owtts-word-color-blue', 'owtts-word-color-pink', 'owtts-word-color-orange');
            state.currentWordElement.classList.remove('owtts-color-yellow', 'owtts-color-green', 'owtts-color-blue', 'owtts-color-pink', 'owtts-color-orange');
            state.currentWordElement = null;
        }
        
        document.querySelectorAll('[data-owtts-processed]').forEach(el => {
            if (el.dataset.owttsOriginal) {
                el.innerHTML = el.dataset.owttsOriginal;
                delete el.dataset.owttsOriginal;
                delete el.dataset.owttsProcessed;
                delete el.dataset.owttsChunkId;
                delete el.dataset.owttsWordOffset;
            }
        });
        
        // Normalize text nodes
        document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote').forEach(el => {
            if (el.normalize) el.normalize();
        });
    }
    
    // Play audio chunk with timing data
    async function playChunkWithTiming(chunk, chunkIndex) {
        // Prepare word wrapping if needed
        if (state.settings.wordHighlight) {
            prepareWordHighlighting(chunk);
        }
        
        highlightChunk(chunk);
        
        // Get audio URL from chunk (already converted to blob URL)
        const audioUrl = chunk.audioUrl;  // Already a blob URL from requestTTSWithTiming
        const chunkTimingData = chunk.timingData;
        
        return new Promise((resolve, reject) => {
            const audio = new Audio(audioUrl);
            audio.playbackRate = state.settings.speed || 1.0;
            state.currentAudio = audio;
            
            let lastWordIndex = -1;
            let animationFrame = null;
            
            // Use precise timing data from backend
            const updateWordHighlight = () => {
                if (!state.settings.wordHighlight) {
                    animationFrame = requestAnimationFrame(updateWordHighlight);
                    return;
                }
                
                if (!audio.duration || audio.duration === 0 || audio.paused || audio.ended) {
                    animationFrame = requestAnimationFrame(updateWordHighlight);
                    return;
                }
                
                const currentTime = audio.currentTime;
                
                // Find the current word based on timing data
                if (!chunkTimingData || !chunkTimingData.words) {
                    animationFrame = requestAnimationFrame(updateWordHighlight);
                    return;
                }
                
                // Find which word should be highlighted at current time
                let wordIndex = -1;
                for (let i = 0; i < chunkTimingData.words.length; i++) {
                    const wordTiming = chunkTimingData.words[i];
                    
                    // Skip citation markers and other marked skip regions
                    if (wordTiming.skip) {
                        continue;
                    }
                    
                    if (currentTime >= wordTiming.startTime && currentTime <= wordTiming.endTime) {
                        wordIndex = i;
                        break;
                    } else if (currentTime < wordTiming.startTime) {
                        // We haven't reached this word yet, find previous non-skip word
                        for (let j = i - 1; j >= 0; j--) {
                            if (!chunkTimingData.words[j].skip) {
                                wordIndex = j;
                                break;
                            }
                        }
                        break;
                    }
                }
                
                // If past all words, use last non-skip word
                if (wordIndex === -1 && chunkTimingData.words.length > 0) {
                    const lastWordTiming = chunkTimingData.words[chunkTimingData.words.length - 1];
                    if (currentTime > lastWordTiming.endTime) {
                        // Find last non-skip word
                        for (let i = chunkTimingData.words.length - 1; i >= 0; i--) {
                            if (!chunkTimingData.words[i].skip) {
                                wordIndex = i;
                                break;
                            }
                        }
                    }
                }
                
                // Update highlight if word changed
                if (wordIndex !== lastWordIndex && wordIndex >= 0) {
                    lastWordIndex = wordIndex;
                    highlightWord(chunk, wordIndex);
                }
                
                animationFrame = requestAnimationFrame(updateWordHighlight);
            };
            
            audio.addEventListener('loadedmetadata', () => {
                console.log(`🎵 Audio loaded: ${audio.duration}s, ${chunkTimingData.words.length} words`);
            });
            
            audio.addEventListener('play', () => {
                if (animationFrame) cancelAnimationFrame(animationFrame);
                animationFrame = requestAnimationFrame(updateWordHighlight);
            });
            
            audio.addEventListener('playing', () => {
                if (!animationFrame) {
                    animationFrame = requestAnimationFrame(updateWordHighlight);
                }
            });
            
            audio.addEventListener('ended', () => {
                if (animationFrame) cancelAnimationFrame(animationFrame);
                animationFrame = null;
                resolve();
            });
            
            audio.addEventListener('pause', () => {
                if (animationFrame) cancelAnimationFrame(animationFrame);
                animationFrame = null;
            });
            
            audio.addEventListener('error', (error) => {
                if (animationFrame) cancelAnimationFrame(animationFrame);
                animationFrame = null;
                reject(error);
            });
            
            audio.play().catch(reject);
        });
    }
    
    // Main reading function
    async function startReading(mode, settings) {
        if (state.isReading) {
            console.warn('Already reading, stopping current...');
            stopReading();
            // Small delay to ensure cleanup
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        state.settings = settings || await loadSettings();
        
        let textNodes;
        if (mode === 'selection') {
            textNodes = extractSelection();
            if (!textNodes || textNodes.length === 0) {
                updateMenuStatus('No text selected', 'error');
                return;
            }
        } else {
            textNodes = extractPageText();
        }
        
        await readTextNodes(textNodes);
    }
    
    // Stop reading
    function stopReading() {
        state.isReading = false;
        
        if (state.currentAudio) {
            state.currentAudio.pause();
            state.currentAudio = null;
        }
        
        clearHighlights();
        
        // Delay blob URL cleanup to prevent ERR_REQUEST_RANGE_NOT_SATISFIABLE
        setTimeout(() => {
            // Clean up old audioQueue blob URLs
            state.audioQueue.forEach(url => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {
                    // Ignore errors during cleanup
                }
            });
            state.audioQueue = [];
            
            // Clean up audioBlobUrls (timing-based audio)
            state.audioBlobUrls.forEach(url => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {
                    // Ignore errors during cleanup
                }
            });
            state.audioBlobUrls = [];
        }, 500);
        
        state.chunks = [];
        state.currentChunkIndex = 0;
        state.previousChunkElement = null;
        
        updateMenuStatus('Ready to read', 'idle');
        hideProgress();
        
        console.log('⏹️ Reading stopped');
    }
    
    // Toggle menu visibility
    function toggleMenu() {
        if (!state.floatingMenu) {
            createFloatingMenu();
        }
        
        const menu = state.floatingMenu;
        if (menu.style.display === 'none' || !state.isMenuVisible) {
            menu.style.display = 'block';
            state.isMenuVisible = true;
        } else {
            menu.style.display = 'none';
            state.isMenuVisible = false;
        }
    }
    
    // Listen for messages from popup and background
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startReading') {
            startReading(message.mode, message.settings);
            sendResponse({ success: true });
        } else if (message.action === 'stopReading') {
            stopReading();
            sendResponse({ success: true });
        } else if (message.action === 'toggleMenu') {
            toggleMenu();
            sendResponse({ success: true });
        } else if (message.action === 'readFromHere') {
            // This will be handled by click listener
            sendResponse({ success: true });
        } else if (message.action === 'updateSettings') {
            // Update settings immediately without page refresh
            state.settings = message.settings;
            
            // If currently reading, update highlight colors immediately
            if (state.isReading) {
                // Reapply chunk highlight with new color
                const currentChunk = state.chunks[state.currentChunkIndex];
                if (currentChunk) {
                    // Clear old highlights with old colors
                    state.highlightedElements.forEach(el => {
                        el.classList.remove('owtts-chunk-highlight');
                        el.classList.remove('owtts-color-yellow', 'owtts-color-green', 'owtts-color-blue', 'owtts-color-pink', 'owtts-color-orange');
                    });
                    state.highlightedElements = [];
                    
                    // Reapply with new color
                    highlightChunk(currentChunk);
                    
                    // Update word highlight color if active
                    if (state.currentWordElement) {
                        state.currentWordElement.classList.remove('owtts-word-color-yellow', 'owtts-word-color-green', 'owtts-word-color-blue', 'owtts-word-color-pink', 'owtts-word-color-orange');
                        const wordColor = state.settings.wordHighlightColor || state.settings.highlightColor;
                        state.currentWordElement.classList.add(`owtts-word-color-${wordColor}`);
                    }
                }
            }
            
            sendResponse({ success: true });
        }
        
        return true;
    });
    
    // Listen for keyboard commands
    browser.runtime.onMessage.addListener((message) => {
        if (message.command) {
            switch (message.command) {
                case 'read-page':
                    startReading('page', state.settings);
                    break;
                case 'read-selection':
                    startReading('selection', state.settings);
                    break;
                case 'stop-reading':
                    stopReading();
                    break;
                case 'toggle-menu':
                    toggleMenu();
                    break;
            }
        }
    });
    
    // Initialize
    setTimeout(() => {
        createFloatingMenu();
        addParagraphButtons();
        makeTextClickable();
        
        // Show menu by default
        toggleMenu();
    }, 1000);
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes owtts-slide-down {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
        
        kbd {
            background: rgba(255, 255, 255, 0.2);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-family: monospace;
        }
        
        .owtts-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .owtts-btn:active {
            transform: translateY(0);
        }
        
        #owtts-close-menu:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: rotate(90deg);
        }
    `;
    document.head.appendChild(style);
    
})();
