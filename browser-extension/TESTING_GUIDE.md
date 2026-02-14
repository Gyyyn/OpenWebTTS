# 🧪 OpenWebTTS Enhanced Extension - Testing Guide

## ✅ Pre-Testing Checklist

Before testing the extension, make sure:
- [ ] Backend server is running on `http://localhost:8000`
- [ ] Extension is loaded in browser (Chrome or Firefox)
- [ ] Test page or real website is open
- [ ] Extension icon appears in browser toolbar

## 🔧 Backend Setup

### Start the Backend
```powershell
# Navigate to project directory
cd d:\tts\OpenWebTTS

# Start the backend server
python app.py
```

Expected output:
```
INFO:     Started server process
INFO:     Uvicorn running on http://localhost:8000
```

### Test Backend Health
```powershell
# In another terminal
curl http://localhost:8000/api/health
```

Expected: `{"status": "healthy", "timestamp": "..."}`

## 🔄 Load Extension

### For Chrome/Edge
1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select folder: `d:\tts\OpenWebTTS\browser-extension`
5. Extension should appear with purple icon

### For Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select: `d:\tts\OpenWebTTS\browser-extension\manifest_firefox.json`
4. Extension should appear

## 📝 Test Plan

### Test 1: Floating Paragraph Buttons ⭐

**Steps:**
1. Open test page: `d:\tts\OpenWebTTS\browser-extension\test-page.html`
2. Hover mouse over any paragraph
3. Look for purple play button appearing on the left

**Expected Result:**
- ✅ Button appears with smooth fade-in animation
- ✅ Button is purple with white play icon (▶)
- ✅ Button position: about 40px to the left of paragraph
- ✅ Button scales up on hover

**Test clicking button:**
4. Click the play button on first paragraph

**Expected Result:**
- ✅ Reading starts immediately
- ✅ Paragraph highlights with yellow background
- ✅ Words highlight individually as they're spoken
- ✅ Auto-scrolls if paragraph is off-screen

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

### Test 2: Floating Menu 🎛️

**Steps:**
1. Look for floating menu on right side of page
2. Should appear automatically (purple gradient box)

**Expected Result:**
- ✅ Menu visible on right side
- ✅ Purple gradient background
- ✅ Shows "Ready to read" status
- ✅ Has 3 buttons: "Read Page", "Read Selection", "Stop"
- ✅ Has close button (×) in top-right

**Test dragging:**
3. Click and hold on menu header ("🔊 OpenWebTTS")
4. Drag menu to different position
5. Release mouse

**Expected Result:**
- ✅ Menu follows cursor smoothly
- ✅ Position updates in real-time
- ✅ Menu stays in new position

**Test buttons:**
6. Click "Read Page" button

**Expected Result:**
- ✅ Reading starts
- ✅ Status changes to "Reading X chunks..."
- ✅ Progress bar appears and updates
- ✅ "Stop" button becomes visible
- ✅ Chunk counter updates (e.g., "Chunk 3/25")

7. Click "Stop" button

**Expected Result:**
- ✅ Reading stops immediately
- ✅ Highlights disappear
- ✅ Progress bar resets
- ✅ Status returns to "Ready to read"

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

### Test 3: Keyboard Shortcuts ⌨️

**Test Shortcut 1: Read Page**
1. Refresh the page
2. Press `Ctrl+Shift+R`

**Expected Result:**
- ✅ Reading starts immediately
- ✅ Same behavior as clicking "Read Page" button

**Test Shortcut 2: Stop Reading**
3. While reading, press `Ctrl+Shift+X`

**Expected Result:**
- ✅ Reading stops immediately
- ✅ Highlights clear

**Test Shortcut 3: Read Selection**
4. Select some text with mouse
5. Press `Ctrl+Shift+S`

**Expected Result:**
- ✅ Only selected text is read
- ✅ Highlights only appear on selected text

**Test Shortcut 4: Toggle Menu**
6. Press `Ctrl+Shift+M`

**Expected Result:**
- ✅ Menu disappears (if visible)

7. Press `Ctrl+Shift+M` again

**Expected Result:**
- ✅ Menu reappears in same position

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

### Test 4: Context Menu 🖱️

**Steps:**
1. Select a paragraph or sentence with mouse
2. Right-click on the selected text
3. Look for menu item "🔊 Read this text"

**Expected Result:**
- ✅ Menu item appears in context menu
- ✅ Has speaker icon (🔊)

4. Click "🔊 Read this text"

**Expected Result:**
- ✅ Reading starts immediately
- ✅ Only selected text is read
- ✅ Highlighting appears on selected text

**Test without selection:**
5. Click anywhere to deselect text
6. Right-click

**Expected Result:**
- ✅ "Read this text" option should NOT appear (or be grayed out)

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

### Test 5: Ctrl+Click Reading 🎯

**Test Ctrl indicator:**
1. Stop any ongoing reading
2. Press and hold `Ctrl` key

**Expected Result:**
- ✅ Blue indicator appears at top-center of page
- ✅ Shows message: "Ctrl held - Click text to start reading from there"

3. Release `Ctrl` key

**Expected Result:**
- ✅ Indicator disappears

**Test Ctrl+Click:**
4. Hold `Ctrl` key
5. Click on any paragraph in the middle of the page
6. Release `Ctrl`

**Expected Result:**
- ✅ Reading starts from clicked paragraph
- ✅ Continues to end of page
- ✅ Skips paragraphs before clicked one

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

### Test 6: Visual Highlighting 🎨

**Test chunk highlighting:**
1. Start reading (any method)
2. Observe paragraph currently being read

**Expected Result:**
- ✅ Paragraph has yellow background (25% opacity)
- ✅ Has subtle glow/shadow around edges
- ✅ Background color is semi-transparent
- ✅ Text remains fully readable

**Test word highlighting:**
3. Watch individual words within paragraph

**Expected Result:**
- ✅ Each word highlights individually (65% opacity)
- ✅ Word highlighting is brighter than paragraph
- ✅ Word highlight moves smoothly across text
- ✅ Only one word highlighted at a time
- ✅ Slight scale effect on current word

**Test color change** (via popup):
4. Click extension icon in toolbar
5. Change "Highlight Color" to "Green"
6. Start reading

**Expected Result:**
- ✅ Highlights now appear in green
- ✅ Both chunk and word highlights use new color

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

### Test 7: Progress Tracking 📊

**Steps:**
1. Start reading a page with multiple paragraphs
2. Watch the floating menu

**Expected Result:**
- ✅ Progress bar fills from left to right
- ✅ Percentage increases smoothly
- ✅ Chunk counter shows: "Chunk X/Y"
- ✅ Time remaining shows estimate: "MM:SS"
- ✅ Status text updates

**Test at completion:**
3. Let reading complete naturally

**Expected Result:**
- ✅ Progress bar reaches 100%
- ✅ Counter shows "Chunk Y/Y" (max/max)
- ✅ Status changes to "Ready to read"
- ✅ Stop button disappears
- ✅ Read buttons reappear

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

### Test 8: Settings & Configuration ⚙️

**Test popup:**
1. Click extension icon in toolbar
2. Popup should open

**Expected Result:**
- ✅ Popup shows all settings
- ✅ Backend URL is "http://localhost:8000"
- ✅ Chunk Size is "50"
- ✅ Voice dropdown has options (Piper, Kokoro, etc.)
- ✅ Speed slider (0.5x - 2.0x)

**Test connection:**
3. Click "Test Connection" button

**Expected Result:**
- ✅ Status shows "Testing..."
- ✅ Changes to "✅ Connected" (green)
- ✅ If backend offline: Shows "❌ Connection failed" (red)

**Test settings save:**
4. Change chunk size to 100
5. Change speed to 1.5x
6. Change highlight color to Blue
7. Click "Save Settings"

**Expected Result:**
- ✅ Success message appears
- ✅ Settings persist after closing popup
- ✅ Reload page and verify settings still applied

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

### Test 9: Error Handling 🚨

**Test backend offline:**
1. Stop the backend server (Ctrl+C in terminal)
2. Try to read text with extension

**Expected Result:**
- ✅ Shows error in floating menu status
- ✅ Error message: "Backend error: 500" or similar
- ✅ Doesn't cause extension to crash
- ✅ Can retry after restarting backend

**Test invalid text:**
2. Try to read page with no text content

**Expected Result:**
- ✅ Shows "No readable content found"
- ✅ Doesn't crash
- ✅ Returns to ready state

**Test rapid clicking:**
3. Start reading, immediately click stop, then start again rapidly

**Expected Result:**
- ✅ Handles rapid state changes gracefully
- ✅ No audio overlap
- ✅ Highlights clear properly

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

### Test 10: Cross-Browser Compatibility 🌐

**Test on Chrome:**
- [ ] All features work
- [ ] Keyboard shortcuts work
- [ ] Context menu works
- [ ] Visual design correct

**Test on Firefox:**
- [ ] All features work
- [ ] Keyboard shortcuts work
- [ ] Context menu works
- [ ] Visual design correct

**Status:** ⬜ Pass | ⬜ Fail | ⬜ Partial

---

## 📸 Visual Inspection Checklist

### UI/UX Quality
- [ ] Floating menu has smooth gradient
- [ ] Buttons have hover effects
- [ ] Animations are smooth (not janky)
- [ ] Text is readable
- [ ] Icons are crisp
- [ ] No visual glitches
- [ ] Shadows look professional
- [ ] Colors are consistent
- [ ] Responsive to window resize

### Accessibility
- [ ] Can tab through all controls
- [ ] Focus indicators visible
- [ ] Keyboard shortcuts work
- [ ] Contrast is sufficient
- [ ] Works with screen readers (if available)

## 🐛 Bug Reporting Template

If you find issues, document them:

```
**Bug Title**: [Short description]

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happens]

**Browser**: Chrome/Firefox [version]
**OS**: Windows [version]
**Backend**: Running/Not running

**Screenshots**: [If applicable]

**Console Errors**: [Press F12, check Console tab]
```

## 📊 Test Summary

Fill out after completing all tests:

| Test | Status | Notes |
|------|--------|-------|
| 1. Paragraph Buttons | ⬜ Pass | |
| 2. Floating Menu | ⬜ Pass | |
| 3. Keyboard Shortcuts | ⬜ Pass | |
| 4. Context Menu | ⬜ Pass | |
| 5. Ctrl+Click | ⬜ Pass | |
| 6. Highlighting | ⬜ Pass | |
| 7. Progress Tracking | ⬜ Pass | |
| 8. Settings | ⬜ Pass | |
| 9. Error Handling | ⬜ Pass | |
| 10. Cross-Browser | ⬜ Pass | |

**Overall Status**: ⬜ All Pass | ⬜ Minor Issues | ⬜ Major Issues

**Notes**:
_[Add any additional observations]_

---

## 🚀 Quick Test Commands

### PowerShell Helper Commands

```powershell
# Start backend
cd d:\tts\OpenWebTTS; python app.py

# Test health endpoint
curl http://localhost:8000/api/health

# Check if backend is running
Test-NetConnection -ComputerName localhost -Port 8000

# Kill backend if stuck
Get-Process -Name python | Where-Object {$_.Path -like "*OpenWebTTS*"} | Stop-Process
```

### Browser Console Tests

Press F12, paste in Console tab:

```javascript
// Test if content script loaded
console.log('Testing OpenWebTTS...');

// Check for floating menu
document.querySelector('.owtts-floating-menu') ? 
  console.log('✅ Menu found') : 
  console.error('❌ Menu not found');

// Check for paragraph buttons
document.querySelectorAll('.owtts-para-btn').length > 0 ? 
  console.log('✅ Buttons found') : 
  console.warn('⚠️ No buttons found');

// Force show menu
if (window.browser || window.chrome) {
  (window.browser || window.chrome).runtime.sendMessage({
    action: 'toggleMenu'
  });
}
```

## 📞 Support

If tests fail:
1. Check browser console (F12) for errors
2. Check backend terminal for errors
3. Verify backend is on port 8000
4. Try reloading the extension
5. Try hard refresh (Ctrl+Shift+R) on page
6. Check CORS headers in Network tab

---

**Happy Testing! 🎉**
