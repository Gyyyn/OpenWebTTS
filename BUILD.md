
# Project Structure

```
OpenWebTTS/
|
├── app.py                 # Main FastAPI application
├── requirements.txt       # Python dependencies
├── README.md              # This file
├── .gitignore             # Git ignore file
├── flatpak-manifest.yml   # Flatpak manifest for Linux
|
├── functions/
|   ├── users.py           # User management and authentication
│   ├── gemini.py          # Gemini and Google Cloud TTS API
│   ├── piper.py           # Piper TTS
│   ├── whisper.py         # OpenAI's Whisper STT
|   ├── kitten.py          # Kitten TTS
│   ├── kokoro.py          # Kokoro TTS
│   ├── coqui.py           # Coqui TTS
|   └── webpage.py         # Webpage extraction
|
├── models/                # Place your TTS models here
|   ├── coqui/
|   ├── piper/
|   └── kokoro/
|
├── translations/          # Translations
|   └── en/ (etc...)
|
├── users/                 # User settings and preferences         
|
├── static/
|   ├── css/               # Stylesheets
|   ├── js/                # JavaScript files  
|   ├── audio/             # Static audio  
|   └── audio_cache/       # Generated audio cache
|
└── templates/
    ├── config.html        # Configuration page
    └── index.html         # Main HTML page
```

## Running Manually

### 1. Prerequisites

1. Python 3.12 (Recommended).
2. `pip` for managing dependencies (usually comes with Python).
3. `espeak-ng` for fallback (Piper and Kokoro also bundle their own via Python wheels).
4. `ffmpeg` or `libav` for audio processing (automatically bundled via `imageio-ffmpeg` if not installed on your system).
5. **Optional — Scanned PDF OCR only** (`tesseract-ocr` and `poppler`): Regular text PDFs work out of the box, but OCR on image-only PDFs requires both tools installed and available on `PATH`:
   - **Linux (Debian/Ubuntu):** `sudo apt install tesseract-ocr poppler-utils`
   - **macOS (Homebrew):** `brew install tesseract poppler`
   - **Windows:** Install [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) and [Poppler for Windows](https://github.com/oschwartz10612/poppler-windows/releases), and add both `bin` folders to your `PATH`.

> **Note:** Other Python versions might not be fully compatible due to dependencies. Later version might work, but use at your own risk.

### 2. Create a Virtual Environment

It is highly recommended to use a virtual environment to avoid conflicts with system-wide packages.

> **Note:** Make sure you're using the correct python version (3.12 recommended) to create the venv.

```bash
# Navigate to the project directory
cd /path/to/OpenWebTTS

# Create a virtual environment
python3.12 -m venv venv

# Activate the virtual environment
# On macOS and Linux:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate
```

### 3. Install Dependencies

Install PyTorch first (CPU-only is recommended for smaller standalone builds; use the CUDA index if you want GPU acceleration), then install all required Python libraries from `requirements.txt`.
> **Note:** If you have an older graphics card, check the [PyTorch docs](https://pytorch.org/get-started/locally/) for the right index URL.

```bash
# CPU-only PyTorch (recommended for smaller builds)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Optional: CUDA PyTorch instead of CPU-only (example: CUDA 12.4)
# pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124

pip install -r requirements.txt
```

Next, adquire dependencies using npm:

```bash
npm install
npm run build
```

Finally you can run the app.

```bash
python app.py
```

The app will be available at `http://127.0.0.1:8000`. If you want the app to be available to your LAN, pass the `--host=0.0.0.0` flag. To run as a WebView window see below.

### App Mode

You can also run OpenWebTTS as a desktop app using a lightweight webview window. This is how the app is run in Flatpak mode.

First, make sure `pywebview[qt]` is installed via `pip`. Then run:

```bash
python app.py --app
```

# Building

Keep in mind that due to the nature of AI models, the final app will be *big*. Usually in the 5-10GB range. Work is ongoing to allow for modularity in the models to keep the size down, but for now, be mindful of your disk space.

## Building Flatpak

This uses the `--app` mode and PyWebView. Use the Flatpak manifest JSON:

```bash
flatpak-builder build-dir io.github.gyyyn.OpenWebTTS.json
flatpak-builder --run build-dir io.github.gyyyn.OpenWebTTS.json
```

## Building using PyInstaller

This uses the `--app` mode and PyWebView. PyInstaller needs to be running on the target OS. Make sure `npm run build` has been run and CPU PyTorch is installed in your `venv` before running PyInstaller:

```bash
# On macOS / Linux:
./venv/bin/pyinstaller OpenWebTTS.spec

# On Windows:
.\venv\Scripts\pyinstaller OpenWebTTS.spec
```

Optional build flags via environment variables:
- `OPENWEBTTS_CONSOLE=1`: Keep the terminal/console window visible for debugging.
- `OPENWEBTTS_CUDA=1`: Keep NVIDIA/CUDA packages when building from a CUDA-enabled `venv`.

### Platform Notes

- **Windows (`dist/OpenWebTTS/OpenWebTTS.exe`)**: Uses `tts.ico` for the executable icon and Edge WebView2 at runtime (preinstalled on Windows 11 and most Windows 10 systems; otherwise install the [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)).
- **macOS (`dist/OpenWebTTS.app`)**: Uses `tts.icns` if present (otherwise falls back to `maskable_icon_x512.png` via Pillow). Package for distribution as a `.dmg`:
  ```bash
  hdiutil create -volname "OpenWebTTS" -srcfolder dist/OpenWebTTS.app -ov -format UDZO dist/OpenWebTTS-macOS.dmg
  ```
- **Linux (`dist/OpenWebTTS/OpenWebTTS`)**: Uses `pywebview[qt]` (installed automatically via `requirements.txt` on Linux) for a self-contained webview backend. You can pair `dist/OpenWebTTS/` with `io.github.gyyyn.OpenWebTTS.desktop` and `maskable_icon_x512.png` to wrap into an AppImage (`appimagetool`) or archive.