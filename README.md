# OpenWebTTS: Local Text-to-Speech Web UI

OpenWebTTS is a local web-based application that provides a simple interface for generating speech using multiple Text-to-Speech (TTS)  or Speech-to-Text (STT) engines.

<img width="2373" height="1445" alt="image" src="https://github.com/user-attachments/assets/5bcdd59d-f30e-4b56-9b14-a58c1a29ab36" />

## Features

- **Simple Web Interface**: A clean UI for text input and audio generation.
- **Multiple Engine Support**: Use Piper, Kokoro or Coqui for TTS or OpenAI Whisper for STT.
- **Real-time Generation**: Generates as you listen for smooth playback or recording.

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
│   ├── gemini.py          # Gemini API
│   ├── piper.py           # Piper TTS
│   ├── whisper.py         # OpenAI's Whisper STT
|   ├── kitten.py          # Kitten TTS
│   ├── kokoro.py          # Kokoro functions
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
├── users/
│   └── *.json             # User settings and preferences
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

- Python 3.11 (Recommended). **Note:** Other Python versions might not be fully compatiible due to dependencies. If you wish to use 3.12 or above, make sure to adjust the `requirements.txt` file accordingly, and note that not all functions will work.
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

#### Coqui TTS (In development.)

1.  Find a model from the [Coqui TTS releases](https://github.com/coqui-ai/TTS/releases) or train your own.
2.  A Coqui model is typically a directory containing files like `model.pth`, `config.json`, and `speakers.json` (for multi-speaker models).
3.  Place the entire model directory inside `models/coqui/`. For example: `models/coqui/your-coqui-model/`.

## How to Run the Application

Once you have installed the dependencies and placed your models, you can start the web server.

```bash
python app.py
```

The application will be available at `http://127.0.0.1:8000`. If you want the app to be available to your LAN, pass the `--host=0.0.0.0` flag.

### Desktop Mode (Experimental)

You can also run OpenWebTTS as a desktop app using a lightweight webview window. This requires a webview backend such as `webkit2gtk`. This is still experimental, so if you experience any issues try running it as a web app instead.

```bash
python app.py --desktop
```
