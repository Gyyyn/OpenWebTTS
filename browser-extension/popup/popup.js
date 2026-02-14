// Popup script for OpenWebTTS browser extension

// Get browser API (works for both Chrome and Firefox)
const browser = window.browser || window.chrome;

// DOM Elements
const statusElement = document.getElementById('status');
const statusText = document.getElementById('status-text');
const backendUrlInput = document.getElementById('backend-url');
const voiceSelect = document.getElementById('voice-select');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const chunkSizeInput = document.getElementById('chunk-size');
const autoScrollCheckbox = document.getElementById('auto-scroll');
const wordHighlightCheckbox = document.getElementById('word-highlight');
const highlightColorSelect = document.getElementById('highlight-color');
const wordHighlightColorSelect = document.getElementById('word-highlight-color');
const readPageBtn = document.getElementById('read-page');
const readSelectionBtn = document.getElementById('read-selection');
const stopReadingBtn = document.getElementById('stop-reading');
const testConnectionBtn = document.getElementById('test-connection');
const saveSettingsBtn = document.getElementById('save-settings');
const playbackInfo = document.getElementById('playback-info');
const progressFill = document.getElementById('progress-fill');
const currentChunkSpan = document.getElementById('current-chunk');
const timeRemainingSpan = document.getElementById('time-remaining');

// Default settings
const defaultSettings = {
    backendUrl: 'http://localhost:8000',
    voice: 'piper',
    speed: 1.0,
    chunkSize: 50,
    autoScroll: true,
    wordHighlight: true,
    highlightColor: 'yellow',
    wordHighlightColor: 'yellow'
};

// Load settings from storage
async function loadSettings() {
    try {
        const result = await browser.storage.local.get('settings');
        const settings = result.settings || defaultSettings;
        
        backendUrlInput.value = settings.backendUrl;
        voiceSelect.value = settings.voice;
        speedSlider.value = settings.speed;
        speedValue.textContent = `${settings.speed}x`;
        chunkSizeInput.value = settings.chunkSize;
        autoScrollCheckbox.checked = settings.autoScroll;
        wordHighlightCheckbox.checked = settings.wordHighlight;
        highlightColorSelect.value = settings.highlightColor;
        wordHighlightColorSelect.value = settings.wordHighlightColor || settings.highlightColor;
        
        return settings;
    } catch (error) {
        console.error('Error loading settings:', error);
        return defaultSettings;
    }
}

// Save settings to storage
async function saveSettings() {
    const settings = {
        backendUrl: backendUrlInput.value.trim(),
        voice: voiceSelect.value,
        speed: parseFloat(speedSlider.value),
        chunkSize: parseInt(chunkSizeInput.value),
        autoScroll: autoScrollCheckbox.checked,
        wordHighlight: wordHighlightCheckbox.checked,
        highlightColor: highlightColorSelect.value,
        wordHighlightColor: wordHighlightColorSelect.value
    };
    
    try {
        await browser.storage.local.set({ settings });
        
        // Notify all tabs about settings change for immediate effect
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            for (const tab of tabs) {
                browser.tabs.sendMessage(tab.id, {
                    action: 'updateSettings',
                    settings: settings
                }).catch(() => {
                    // Tab might not have content script, ignore error
                });
            }
        } catch (e) {
            // Ignore message sending errors
        }
        
        showStatus('connected', 'Settings saved!');
        setTimeout(() => testConnection(), 1000);
        return settings;
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('disconnected', 'Failed to save settings');
    }
}

// Update status display
function showStatus(state, message) {
    statusElement.className = `status ${state}`;
    statusText.textContent = message;
}

// Test backend connection
async function testConnection() {
    const backendUrl = backendUrlInput.value.trim();
    showStatus('connecting', 'Testing connection...');
    
    try {
        const response = await fetch(`${backendUrl}/api/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            showStatus('connected', 'Connected to backend');
            return true;
        } else {
            showStatus('disconnected', 'Backend not responding');
            return false;
        }
    } catch (error) {
        console.error('Connection error:', error);
        showStatus('disconnected', 'Cannot reach backend');
        return false;
    }
}

// Get current tab
async function getCurrentTab() {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

// Send message to content script
async function sendMessageToContent(message) {
    const tab = await getCurrentTab();
    return browser.tabs.sendMessage(tab.id, message);
}

// Read entire page
async function readPage() {
    const settings = await loadSettings();
    
    showStatus('connecting', 'Starting to read page...');
    readPageBtn.disabled = true;
    readSelectionBtn.disabled = true;
    stopReadingBtn.disabled = false;
    playbackInfo.style.display = 'block';
    
    try {
        await sendMessageToContent({
            action: 'startReading',
            mode: 'page',
            settings: settings
        });
        
        showStatus('connected', 'Reading page...');
    } catch (error) {
        console.error('Error starting reading:', error);
        showStatus('disconnected', 'Failed to start reading');
        readPageBtn.disabled = false;
        readSelectionBtn.disabled = false;
        stopReadingBtn.disabled = true;
        playbackInfo.style.display = 'none';
    }
}

// Read selected text
async function readSelection() {
    const settings = await loadSettings();
    
    showStatus('connecting', 'Starting to read selection...');
    readPageBtn.disabled = true;
    readSelectionBtn.disabled = true;
    stopReadingBtn.disabled = false;
    playbackInfo.style.display = 'block';
    
    try {
        await sendMessageToContent({
            action: 'startReading',
            mode: 'selection',
            settings: settings
        });
        
        showStatus('connected', 'Reading selection...');
    } catch (error) {
        console.error('Error starting reading:', error);
        showStatus('disconnected', 'Failed to start reading');
        readPageBtn.disabled = false;
        readSelectionBtn.disabled = false;
        stopReadingBtn.disabled = true;
        playbackInfo.style.display = 'none';
    }
}

// Stop reading
async function stopReading() {
    try {
        await sendMessageToContent({ action: 'stopReading' });
        
        showStatus('connected', 'Stopped reading');
        readPageBtn.disabled = false;
        readSelectionBtn.disabled = false;
        stopReadingBtn.disabled = true;
        playbackInfo.style.display = 'none';
        progressFill.style.width = '0%';
    } catch (error) {
        console.error('Error stopping reading:', error);
    }
}

// Update playback progress
function updateProgress(current, total, timeRemaining) {
    const percent = total > 0 ? (current / total) * 100 : 0;
    progressFill.style.width = `${percent}%`;
    currentChunkSpan.textContent = `Chunk ${current}/${total}`;
    
    if (timeRemaining) {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        timeRemainingSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateProgress') {
        updateProgress(message.current, message.total, message.timeRemaining);
    } else if (message.action === 'readingComplete') {
        showStatus('connected', 'Reading complete!');
        readPageBtn.disabled = false;
        readSelectionBtn.disabled = false;
        stopReadingBtn.disabled = true;
        setTimeout(() => {
            playbackInfo.style.display = 'none';
            progressFill.style.width = '0%';
        }, 2000);
    } else if (message.action === 'readingError') {
        showStatus('disconnected', message.error || 'Reading error');
        readPageBtn.disabled = false;
        readSelectionBtn.disabled = false;
        stopReadingBtn.disabled = true;
        playbackInfo.style.display = 'none';
    }
});

// Event listeners
speedSlider.addEventListener('input', (e) => {
    speedValue.textContent = `${e.target.value}x`;
});

testConnectionBtn.addEventListener('click', testConnection);
saveSettingsBtn.addEventListener('click', saveSettings);
readPageBtn.addEventListener('click', readPage);
readSelectionBtn.addEventListener('click', readSelection);
stopReadingBtn.addEventListener('click', stopReading);

// Auto-save settings on change
[voiceSelect, autoScrollCheckbox, wordHighlightCheckbox, highlightColorSelect, wordHighlightColorSelect, speedSlider, chunkSizeInput].forEach(element => {
    element.addEventListener('change', saveSettings);
});

// Save backend URL on blur (when user finishes typing)
backendUrlInput.addEventListener('blur', saveSettings);

// Also save on input for immediate feedback on sliders
speedSlider.addEventListener('input', () => {
    speedValue.textContent = speedSlider.value + 'x';
});

// Initialize
(async function init() {
    await loadSettings();
    await testConnection();
})();
