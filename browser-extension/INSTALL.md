# OpenWebTTS Browser Extension - Installation Guide

## Quick Start

### 1. Ensure Backend is Running

```bash
cd OpenWebTTS
python app.py
```

Verify it's running by visiting: http://localhost:5000

### 2. Install Extension

#### For Chrome/Edge/Brave:

1. Open browser and go to extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`

2. **Enable "Developer mode"** (toggle in top-right)

3. Click **"Load unpacked"**

4. Navigate to and select: `OpenWebTTS/browser-extension/`

5. Extension icon appears in toolbar! 🎉

#### For Firefox:

1. Open: `about:debugging#/runtime/this-firefox`

2. Click **"Load Temporary Add-on..."**

3. Navigate to: `OpenWebTTS/browser-extension/`

4. Select file: `manifest_firefox.json`

5. Extension loaded! (temporary until browser restart)

### 3. Generate Icons (Optional)

The extension includes SVG icons which work in modern browsers. To create PNG versions:

```bash
cd browser-extension
python generate_icons.py
```

This will create `icon16.png`, `icon48.png`, and `icon128.png` in the `icons/` folder.

**Requirements:** `pip install pillow`

### 4. Test the Extension

1. **Click extension icon** in toolbar
2. Should show: "Connected to backend" (green)
3. Navigate to any webpage with text
4. Click **"📖 Read Page"**
5. Watch as text is highlighted and read aloud! 🔊

## Troubleshooting

### ❌ "Cannot reach backend"

**Fix:**
```bash
# Make sure backend is running
cd OpenWebTTS
python app.py

# Should see: Running on http://127.0.0.1:5000
```

### ❌ Icons not showing

**Options:**
1. Use SVG icons (already included, work in modern browsers)
2. Generate PNG: `python generate_icons.py`
3. Download PNG icons from a converter service

### ❌ Extension not loading

**Chrome:**
- Check for manifest errors in extensions page
- Make sure you selected the `browser-extension` folder (not a file)

**Firefox:**
- Make sure you selected `manifest_firefox.json` (not `manifest.json`)
- For permanent install, see README for signing instructions

### ❌ No audio playing

**Fix:**
1. Click somewhere on the page first (browser autoplay policy)
2. Check backend console for errors
3. Verify voice/TTS engine is working:
   ```bash
   curl -X POST http://localhost:5000/api/generate_speech \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello world", "voice": "piper"}'
   ```

## Features to Try

1. **Read Selection**
   - Select any text on a page
   - Click "📝 Read Selection"
   
2. **Adjust Speed**
   - Move speed slider (0.5x to 2.0x)
   - Click "Save Settings"

3. **Change Highlight Color**
   - Try yellow, green, blue, pink, or orange
   - Watch how highlighting changes

4. **Auto-scroll**
   - Enable/disable auto-scroll
   - Page follows along as it reads

5. **Word Highlighting**
   - Toggle word-by-word option
   - See individual words light up as spoken

## Next Steps

See full [README.md](README.md) for:
- Complete feature list
- API documentation
- Development guide
- Contributing guidelines

---

**Need Help?**
- Check main OpenWebTTS documentation
- Open an issue on GitHub
- Review browser console for errors (`F12` → Console tab)
