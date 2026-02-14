# OpenWebTTS Browser Extension

🔊 A powerful browser extension that reads any webpage aloud with word-by-word highlighting, powered by your local OpenWebTTS backend.

## ✨ New in v1.1.0 - Enhanced UI/UX

🎯 **Floating Paragraph Buttons** - Hover over paragraphs to reveal play buttons
🎛️ **Draggable Floating Menu** - Full-featured control panel you can move anywhere
⌨️ **Keyboard Shortcuts** - Quick access with Ctrl+Shift combinations
🖱️ **Context Menu Integration** - Right-click selected text to read it
🎯 **Ctrl+Click Reading** - Click any paragraph while holding Ctrl to start from there
🎨 **Professional UI** - Glass morphism effects, smooth animations, gradient themes
♿ **Accessibility** - High contrast mode, reduced motion support, keyboard navigation

## Features

### Reading Features
✨ **Read Any Webpage** - Convert any web content to speech with a single click
📝 **Smart Text Selection** - Read selected paragraphs or the entire page
🎯 **Word-by-Word Highlighting** - Follow along with synchronized highlighting
🎯 **Click to Read** - Ctrl+Click on any paragraph to start reading from there
📍 **Paragraph Buttons** - Floating play buttons appear on hover for instant reading

### UI/UX Features
🎛️ **Floating Menu** - Draggable control panel with live progress tracking
⌨️ **Keyboard Shortcuts** - Fast control with Ctrl+Shift+R/S/X/M
🖱️ **Context Menu** - Right-click "Read this text" option
🎨 **Modern Design** - Purple gradient theme with glass morphism
📊 **Progress Tracking** - Visual progress bar with chunk counter

### Customization
🎨 **Customizable Colors** - Choose from 5 highlight color schemes (Yellow, Green, Blue, Pink, Orange)
⚡ **Adjustable Speed** - Control reading speed from 0.5x to 2.0x
🚀 **Auto-scroll** - Automatically scroll to keep reading position visible
🎭 **Multiple Voices** - Support for Piper, Kokoro, Coqui, and OpenAI TTS

### Privacy & Performance
🔐 **Privacy First** - All processing done locally on your backend (port 8000)
⚡ **Smart Chunking** - Optimized 50-word chunks for better synchronization
💾 **Audio Caching** - Cached audio for improved performance

## Installation

### Prerequisites

1. **OpenWebTTS Backend Running**
   - Make sure your OpenWebTTS backend is running on `http://localhost:8000`
   - Start it with: `python app.py`

### Chrome Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Navigate to and select the `browser-extension` folder
5. The extension icon will appear in your toolbar!

### Firefox Installation

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Navigate to the `browser-extension` folder
4. Select the `manifest_firefox.json` file
5. The extension will be loaded temporarily
   - **Note:** For permanent installation, you need to sign the extension

#### Making Firefox Extension Permanent

To use the extension permanently in Firefox:

1. **Package the extension:**
   ```bash
   cd browser-extension
   # Rename manifest for Firefox
   mv manifest.json manifest_chrome.json
   mv manifest_firefox.json manifest.json
   # Create zip file
   zip -r openwebtts-extension.zip * -x "*.md" -x "manifest_chrome.json"
   ```

2. **Sign on Firefox Add-ons:**
   - Go to [https://addons.mozilla.org/developers/](https://addons.mozilla.org/developers/)
   - Create an account and submit for signing
   - OR use web-ext for self-distribution

3. **Or use web-ext for development:**
   ```bash
   npm install -g web-ext
   cd browser-extension
   web-ext run --firefox-profile=your-profile
   ```

## Usage

### Quick Start

#### Method 1: Floating Paragraph Buttons (NEW! ⭐)
1. Navigate to any webpage
2. Hover your mouse over any paragraph
3. A purple play button (▶) appears on the left
4. Click the button to start reading from that paragraph

#### Method 2: Ctrl+Click (NEW! 🎯)
1. Hold down `Ctrl` (or `Cmd` on Mac)
2. Notice the blue indicator at the top of the page
3. Click on any paragraph
4. Reading starts from that paragraph to the end

#### Method 3: Context Menu (NEW! 🖱️)
1. Select any text on the page
2. Right-click on the selection
3. Choose "🔊 Read this text"
4. Selected text is read aloud

#### Method 4: Floating Menu (NEW! 🎛️)
1. Look for the floating purple menu on the right side
2. Use the control buttons:
   - **📖 Read Page** - Read entire page
   - **📝 Read Selection** - Read selected text
   - **⏹️ Stop** - Stop reading
3. Drag the menu header to reposition it anywhere
4. Track progress with the visual progress bar

#### Method 5: Keyboard Shortcuts (NEW! ⌨️)
- `Ctrl+Shift+R` - Read entire page
- `Ctrl+Shift+S` - Read selected text
- `Ctrl+Shift+X` - Stop reading
- `Ctrl+Shift+M` - Toggle floating menu visibility

### Configuration

#### Backend URL
- Default: `http://localhost:8000` (changed from 5000)
- Change if your backend runs on different host/port
- Click "Test Connection" to verify connectivity

#### Voice Selection
- **Piper** - Fast, high-quality neural TTS (default)
- **Kokoro** - Alternative high-quality voice
- **Coqui** - Open-source TTS engine
- **OpenAI** - Cloud-based (requires API key)

#### Reading Settings
- **Speed:** 0.5x to 2.0x playback speed
- **Chunk Size:** Default 50 words (optimized for better sync)
- **Auto-scroll:** Automatically scroll to current reading position
- **Word Highlight:** Show word-by-word highlighting

#### Highlight Colors
- Yellow (default)
- Green
- Blue
- Pink
- Orange

### Advanced Features

#### Progress Tracking
- Visual progress bar shows completion percentage
- Chunk counter displays "Chunk X/Y"
- Estimated time remaining
- Real-time status updates

#### Smart Text Extraction
- Automatically filters navigation, headers, footers
- Focuses on main content
- Skips hidden and invisible elements
- Respects semantic HTML structure

#### Audio Caching
- Caches generated audio for better performance
- Reduces backend calls for repeated text
- Automatically cleans up on stop

### Keyboard Shortcuts

The extension includes these built-in shortcuts:

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+R` | Read Page | Start reading entire page |
| `Ctrl+Shift+S` | Read Selection | Read currently selected text |
| `Ctrl+Shift+X` | Stop | Stop reading immediately |
| `Ctrl+Shift+M` | Toggle Menu | Show/hide floating menu |
| `Ctrl+Click` | Read from Here | Start reading from clicked paragraph |

**Customizing Shortcuts:**

**Chrome/Edge:**
1. Go to `chrome://extensions/shortcuts`
2. Find "OpenWebTTS"
3. Modify the default shortcuts if desired

**Firefox:**
1. Go to `about:addons`
2. Click gear icon → "Manage Extension Shortcuts"
3. Customize the OpenWebTTS shortcuts

## How It Works

### Architecture

```
┌─────────────┐
│  Web Page   │
│  (Content)  │
└──────┬──────┘
       │
       │ Extract Text
       ▼
┌─────────────────┐
│ Content Script  │
│ - Text Extract  │
│ - Highlighting  │
│ - Audio Playback│
└──────┬──────────┘
       │
       │ TTS Request
       ▼
┌─────────────────┐
│ OpenWebTTS      │
│ Backend         │
│ (localhost:5000)│
└──────┬──────────┘
       │
       │ Audio Stream
       ▼
┌─────────────────┐
│ Browser Audio   │
│ (Playback)      │
└─────────────────┘
```

### Text Extraction

The content script intelligently extracts readable text:
- Identifies paragraphs, headings, lists, and blockquotes
- Ignores scripts, styles, hidden elements
- Maintains document structure
- Filters out navigation and UI elements

### Highlighting System

**Two-tier highlighting:**
1. **Chunk/Sentence Level (25% opacity)** - Shows current sentence being read
2. **Word Level (65% opacity)** - Highlights the specific word being spoken

**Timing:**
- Calculates word position based on audio progress
- Updates highlighting in real-time (using `timeupdate` events)
- Smooth transitions between words

### API Communication

**Endpoint:** `POST /api/generate_speech`

**Request:**
```json
{
  "text": "Text to convert to speech",
  "voice": "piper",
  "speed": 1.0
}
```

**Response:** Audio file (WAV/MP3) as blob

## Troubleshooting

### "Cannot reach backend" Error

**Causes:**
- Backend not running
- Wrong URL configured
- CORS issues

**Solutions:**
1. Start backend: `python app.py`
2. Verify URL in extension settings
3. Test connection with "Test Connection" button
4. Check browser console for CORS errors

### No Text Being Read

**Causes:**
- Page has no readable content
- Content is in iframes or shadow DOM
- JavaScript-rendered content not loaded

**Solutions:**
1. Wait for page to fully load
2. Try selecting specific text manually
3. Check if page has readable paragraphs

### Highlighting Not Working

**Causes:**
- Word highlight disabled in settings
- Page CSS conflicts
- Dynamic content changes

**Solutions:**
1. Enable "Word-by-word highlighting" in settings
2. Try different highlight colors
3. Refresh the page and try again

### Audio Not Playing

**Causes:**
- Browser autoplay policy
- Audio format not supported
- Backend audio generation failed

**Solutions:**
1. Click somewhere on the page first (user interaction required)
2. Check backend logs for errors
3. Try different voice/TTS engine

## Development

### Project Structure

```
browser-extension/
├── manifest.json              # Chrome manifest
├── manifest_firefox.json      # Firefox manifest
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.css             # Popup styles
│   └── popup.js              # Popup logic
├── content/
│   ├── content.js            # Content script (runs on pages)
│   └── content.css           # Highlighting styles
├── background/
│   └── background.js         # Background service worker
├── icons/
│   ├── icon16.svg            # 16x16 icon
│   ├── icon48.svg            # 48x48 icon
│   └── icon128.svg           # 128x128 icon
└── README.md                 # This file
```

### Building Icons (Optional)

The extension includes SVG icons. To convert to PNG:

```bash
# Install ImageMagick or use online converter
convert icon128.svg -resize 128x128 icon128.png
convert icon48.svg -resize 48x48 icon48.png
convert icon16.svg -resize 16x16 icon16.png
```

Or use provided SVGs directly (modern browsers support this).

### Modifying the Extension

1. **Edit Files**
   - Modify popup UI: `popup/popup.html`, `popup/popup.css`
   - Change logic: `popup/popup.js`, `content/content.js`
   - Update styles: `content/content.css`

2. **Reload Extension**
   - Chrome: Go to `chrome://extensions/` and click reload icon
   - Firefox: Click "Reload" in `about:debugging`

3. **Test Changes**
   - Open popup to test UI changes
   - Navigate to webpage to test content script
   - Check browser console for errors

## API Reference

### Content Script Messages

**Start Reading:**
```javascript
browser.tabs.sendMessage(tabId, {
  action: 'startReading',
  mode: 'page' | 'selection',
  settings: {...}
});
```

**Stop Reading:**
```javascript
browser.tabs.sendMessage(tabId, {
  action: 'stopReading'
});
```

### Background Script Messages

**Update Progress:**
```javascript
browser.runtime.sendMessage({
  action: 'updateProgress',
  current: 5,
  total: 20,
  timeRemaining: 45
});
```

**Reading Complete:**
```javascript
browser.runtime.sendMessage({
  action: 'readingComplete'
});
```

**Reading Error:**
```javascript
browser.runtime.sendMessage({
  action: 'readingError',
  error: 'Error message'
});
```

## Contributing

Contributions welcome! Areas for improvement:

- [ ] Better text extraction for complex layouts
- [ ] Support for PDF reading in browser
- [ ] Playback controls (pause, skip, rewind)
- [ ] Reading history and bookmarks
- [ ] Custom voice settings per website
- [ ] Keyboard shortcuts for controls
- [ ] Dictionary/pronunciation customization
- [ ] Multi-language support UI

## License

MIT License - Same as OpenWebTTS main project

## Credits

Part of the [OpenWebTTS](https://github.com/Gyyyn/OpenWebTTS) project.

## Support

- **Issues:** Report bugs on GitHub
- **Docs:** See main OpenWebTTS documentation
- **Backend:** Ensure OpenWebTTS backend is properly configured

---

**Made with ❤️ for accessible web reading**
