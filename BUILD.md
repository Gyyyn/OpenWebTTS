
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
|   ├── openai_api.py      # OpenAI compatible API endpoints
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
3. `espeak-ng` for fallback.
4. `ffmpeg` or `libav` for audio processing.

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

Install all the required Python libraries using the `requirements.txt` file.
> **Note:** If you have an older graphics card PyTorch might need to be installed differently. Check the [PyTorch docs](https://pytorch.org/get-started/locally/).

```bash
pip install -r requirements.txt
pip install https://github.com/KittenML/KittenTTS/releases/download/0.1/kittentts-0.1.0-py3-none-any.whl
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

This uses the `--app` mode and PyWebView. PyInstaller needs to be running on the target OS. Run:

```bash
./venv/bin/pyinstaller OpenWebTTS.spec
```