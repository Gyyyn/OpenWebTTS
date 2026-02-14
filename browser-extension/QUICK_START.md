# 🚀 Quick Start Guide - Browser Extension

Get your OpenWebTTS browser extension up and running in 5 minutes!

## Step 1: Start the Backend (30 seconds)

```bash
cd OpenWebTTS
python app.py
```

**Expected output:**
```
✅ Piper configured
✅ Kokoro configured
INFO:     Started server process
INFO:     Uvicorn running on http://127.0.0.1:5000
```

**Verify:** Open http://localhost:5000 in browser - should see OpenWebTTS interface

## Step 2: Install Extension (2 minutes)

### For Chrome/Edge/Brave:

1. **Open extensions page:**
   - Type in address bar: `chrome://extensions/`
   - Or: Menu → Extensions → Manage Extensions

2. **Enable Developer Mode:**
   - Toggle switch in top-right corner

3. **Load extension:**
   - Click "Load unpacked"
   - Navigate to: `OpenWebTTS/browser-extension/`
   - Click "Select Folder"

4. **Pin to toolbar (optional):**
   - Click puzzle icon in toolbar
   - Click pin icon next to OpenWebTTS

### For Firefox:

1. **Open debugging page:**
   - Type in address bar: `about:debugging#/runtime/this-firefox`

2. **Load extension:**
   - Click "Load Temporary Add-on..."
   - Navigate to: `OpenWebTTS/browser-extension/`
   - Select file: `manifest_firefox.json`
   - Click "Open"

**Note:** Firefox temporary extensions are removed on restart. For permanent install, see [README.md](README.md).

## Step 3: Test Extension (2 minutes)

1. **Open test page:**
   - File → Open File (or Ctrl+O)
   - Navigate to: `OpenWebTTS/browser-extension/test-page.html`
   - Or just drag the file into your browser

2. **Click extension icon** in toolbar
   - Should see popup with settings

3. **Verify connection:**
   - Status should show: "🟢 Connected to backend"
   - If not, click "Test Connection"

4. **Start reading:**
   - Click "📖 Read Page" button
   - Audio should start playing
   - Text should highlight as it reads

5. **Test controls:**
   - Watch highlighting follow along
   - Try "⏹️ Stop" button
   - Select some text and try "📝 Read Selection"

## Step 4: Try on Real Websites (30 seconds)

1. **Navigate to any website:**
   - Wikipedia: https://en.wikipedia.org/wiki/Artificial_intelligence
   - News site: https://news.ycombinator.com
   - Blog: https://blog.google/
   - Any webpage with text!

2. **Click extension icon**

3. **Click "📖 Read Page"**

4. **Enjoy hands-free reading!** 🎉

## Common Quick Fixes

### ❌ "Cannot reach backend"
**Fix:** Make sure backend is running
```bash
cd OpenWebTTS
python app.py
```

### ❌ Extension icon not showing
**Fix:** Pin it to toolbar
- Click puzzle icon in toolbar
- Find "OpenWebTTS - Text to Speech Reader"
- Click pin icon

### ❌ No audio playing
**Fix:** Click somewhere on the page first (browser autoplay policy)

### ❌ Icons showing as puzzle pieces
**Fix:** Generate PNG icons:
```bash
cd browser-extension
python generate_icons.py
# OR just use the SVG icons - they work fine!
```

## Customize Settings

Click extension icon to access settings:

- **Voice:** Choose Piper (fast), Kokoro (quality), Coqui (cloning), or OpenAI (cloud)
- **Speed:** Drag slider from 0.5x (slow) to 2.0x (fast)
- **Colors:** Pick yellow, green, blue, pink, or orange highlights
- **Auto-scroll:** Toggle on/off to follow reading position
- **Word Highlight:** Toggle word-by-word highlighting effect

Click "Save Settings" to persist your preferences!

## What's Next?

### Explore Features:
- Read long articles hands-free while doing other tasks
- Use selection reading to focus on specific paragraphs
- Try different voices to find your favorite
- Experiment with reading speeds for different content types
- Use auto-scroll for comfortable reading experience

### Advanced Usage:
- Read research papers and documentation
- Listen while exercising or commuting
- Help with proofreading by hearing your own writing
- Accessibility aid for visual impairments or dyslexia
- Language learning tool (pronunciation)

### Get Help:
- 📖 Full documentation: [README.md](README.md)
- 🔧 Installation guide: [INSTALL.md](INSTALL.md)
- 💻 Developer guide: [DEVELOPMENT.md](DEVELOPMENT.md)
- ✅ Verification: [VERIFICATION_CHECKLIST.md](VERIFICATION_CHECKLIST.md)

## Showcase Example

**Try this now:**
1. Go to: https://en.wikipedia.org/wiki/OpenAI
2. Click extension icon
3. Click "Read Page"
4. Watch the magic happen! ✨

The extension will:
- Extract all readable content
- Generate speech in real-time
- Highlight sentences and words
- Scroll to keep position visible
- Show progress and time remaining

## Share & Contribute

Love the extension? Consider:
- ⭐ Star the repo on GitHub
- 🐛 Report bugs or request features
- 📝 Improve documentation
- 💻 Contribute code improvements
- 📢 Share with others who might benefit

## Support

Need help? Check:
1. [INSTALL.md](INSTALL.md) - Detailed installation instructions
2. [README.md](README.md) - Complete feature documentation
3. [Troubleshooting section](README.md#troubleshooting) - Common issues
4. Browser console (F12) - Error messages
5. GitHub Issues - Report problems

---

**You're all set! Happy reading (or listening)! 🎧📚**

The OpenWebTTS extension transforms any webpage into an audiobook with synchronized highlighting. Enjoy hands-free web browsing with complete privacy and control.
