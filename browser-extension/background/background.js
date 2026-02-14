// Background script for OpenWebTTS browser extension
// Handles communication, keyboard shortcuts, and context menus

// Get browser API (works for both Chrome and Firefox)
// Service workers don't have 'window', use 'self' or global 'chrome'
const browser = self.browser || self.chrome || chrome;

console.log('🔊 OpenWebTTS background service initialized');

// Handle extension installation
browser.runtime.onInstalled.addListener((details) => {
    console.log('OpenWebTTS extension installed/updated');
    
    // Create context menu
    browser.contextMenus.create({
        id: 'owtts-read-selection',
        title: '🔊 Read this text',
        contexts: ['selection']
    });
    
    if (details.reason === 'install') {
        // Set default settings on first install
        const defaultSettings = {
            backendUrl: 'http://localhost:8000',
            voice: 'piper',
            speed: 1.0,
            chunkSize: 50,
            autoScroll: true,
            wordHighlight: true,
            highlightColor: 'yellow'
        };
        
        browser.storage.local.set({ settings: defaultSettings });
        console.log('Default settings initialized');
    }
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'owtts-read-selection' && info.selectionText) {
        console.log('Context menu clicked - reading selection');
        
        // Send message to content script to read the selection
        browser.tabs.sendMessage(tab.id, {
            action: 'startReading',
            mode: 'selection'
        });
    }
});

// Handle keyboard shortcuts
browser.commands.onCommand.addListener((command) => {
    console.log('Keyboard command received:', command);
    
    browser.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            // Forward command to content script
            browser.tabs.sendMessage(tabs[0].id, {
                command: command
            });
        }
    });
});

// Handle extension icon click
browser.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked on tab:', tab.id);
});

// Listen for messages from content scripts and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    // Handle different message types
    if (message.action === 'getState') {
        // Return current state
        browser.storage.local.get('state').then(result => {
            sendResponse(result.state || {});
        });
        return true; // Keep channel open for async response
    }
    
    if (message.action === 'setState') {
        // Save state
        browser.storage.local.set({ state: message.state }).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }
    
    // Forward reading actions to active tab
    if (message.action === 'startReading' || message.action === 'stopReading' || message.action === 'toggleMenu') {
        browser.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                browser.tabs.sendMessage(tabs[0].id, message, (response) => {
                    sendResponse(response || {success: true});
                });
            }
        });
        return true;
    }
    
    // Forward progress messages to popup
    if (message.action === 'updateProgress' || 
        message.action === 'readingComplete' || 
        message.action === 'readingError') {
        browser.runtime.sendMessage(message);
    }
    
    // Health check
    if (message.action === 'ping') {
        sendResponse({pong: true});
    }
});

// Cleanup on extension update
browser.runtime.onUpdateAvailable.addListener((details) => {
    console.log('Extension update available:', details);
});

// Keep service worker alive (Chrome specific)
if (typeof chrome !== 'undefined' && chrome.alarms) {
    // Create a keepalive alarm
    chrome.alarms.create('keepalive', { periodInMinutes: 1 });
    
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'keepalive') {
            // Just log to keep service worker active
            console.log('Service worker keepalive ping');
        }
    });
}
