# OpenWebTTS: Local Text-to-Speech Web UI

![GitHub stars](https://img.shields.io/github/stars/Gyyyn/OpenWebTTS)
![GitHub forks](https://img.shields.io/github/forks/Gyyyn/OpenWebTTS)
![License](https://img.shields.io/github/license/Gyyyn/OpenWebTTS)

OpenWebTTS is the open-source, privacy-first alternative to Speechify and ElevenLabs. Run it locally, use any TTS engine, and read PDFs, Epubs and other documents without subscriptions or tracking.

<img width="2373" height="1445" alt="image" src="https://github.com/user-attachments/assets/5bcdd59d-f30e-4b56-9b14-a58c1a29ab36" />

## Better than paid alternatives

- **Clean Interface**: Straight to the point and no ads, simple by design, powerful if needed.
- **Multiple Engine Support**: Options for any type of hardware, and even cloud options if wanted.
- **Voice cloning\***: With a simple 10 second `wav` file you can clone any voice to read for you!
- **Import anything**: Most document types are supported, and URLs too!
- **Automatically skip headers and footers\***: Premium feature no more!
- **Automatic OCR\***: If your PDF doesn't have text, we can make some for you.
- **Offline first\***: No connection neeeded.
- **Self-hostable**: Take control of your data, with no feature locked away.

Features marked with an `*` are *paid* on other platforms!

## Project Structure

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

## Setup and Installation

### 1. Prerequisites

- Python 3.11 (Recommended). **Note:** Other Python versions might not be fully compatiible due to dependencies. Later version might work, but use at your own risk.
- `pip` and `venv` for managing dependencies.
- `espeak-ng` for Kokoro.

### 2. Create a Virtual Environment

It is highly recommended to use a virtual environment to avoid conflicts with system-wide packages. **Note:** Make sure you're using the correct python version (3.11 recommended) to create the venv.

```bash
# Navigate to the project directory
cd /path/to/OpenWebTTS

# Create a virtual environment
python3.11 -m venv venv

# Activate the virtual environment
# On macOS and Linux:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate
```

### 3. Install Dependencies

Install all the required Python libraries using the `requirements.txt` file. **Note:** If you have an older graphics card PyTorch might need to be installed differently. Check the PyTorch docs.

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

The app will be available at `http://127.0.0.1:8000`. If you want the app to be available to your LAN, pass the `--host=0.0.0.0` flag. For Desktop Mode see below.

### 4. Download and Place TTS Models

#### Piper

1.  Use the integrated model downloader (recommended)

Or

1.  Download a Piper voice model from the [official repository](https://huggingface.co/rhasspy/piper-voices/tree/main).
2.  Place the files inside `models/piper/`. For example: `models/piper/en_US-lessac-medium.onnx` and `models/piper/en_US-lessac-medium.onnx.json`.

#### Kokoro

1.  Use the integrated model downloader (recommended)

Or

1.  Download a model from the [officla repository](https://huggingface.co/hexgrad/Kokoro-82M/tree/main/voices).
2.  Place the file inside `models/kokoro/`. For example: `models/kokoro/af_heart.pt`

#### Coqui

Coqui downloads itself automatically with Python. Currently we only support XTTS2, with YourTTS coming soon. We don't plan on supporting every Coqui version, as it will be mostly used for voice cloning since other models have since surpassed it in regular TTS.

1.  Place the audio files for voice cloning inside `models/coqui/`. For example: `models/coqui/my-voice.wav`.

### Desktop Mode (Experimental)

You can also run OpenWebTTS as a desktop app using a lightweight webview window. This requires a webview backend such as `webkit2gtk` as well as `PyGObject`, which can be install via `pip install PyGObject`, or using apt (recommended for Debian-based distros) `sudo apt install -y python3-gi python3-gi-cairo gir1.2-gtk-3.0`. This is still experimental, so if you experience any issues try running it as a web app instead.

```bash
python app.py --desktop
```
