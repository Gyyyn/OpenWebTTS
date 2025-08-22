# OpenWebTTS: Local Text-to-Speech Web UI

OpenWebTTS is a local web-based application that provides a simple interface for generating speech using multiple Text-to-Speech (TTS) engines. It's designed to be easy to set up and use, allowing you to leverage powerful TTS models like Coqui TTS, Piper, and Kokoro directly from your browser.

## Features

- **Simple Web Interface**: A clean, single-page UI for text input and audio generation.
- **Multiple Engine Support**: Seamlessly switch between Coqui, Piper, and Kokoro.
- **Dynamic Voice Selection**: Automatically lists available voices/speakers for the selected engine.
- **Real-time Generation**: Generate and play back audio without leaving the page.
- **Speech-to-Text**: Record audio and convert it to text using OpenAI's Whisper model.
- **Easy to Extend**: The architecture is modular, making it straightforward to add new TTS engines.

## Project Structure

```
/OpenWebTTS
|
├── app.py                 # Main FastAPI application
├── requirements.txt       # Python dependencies
├── README.md              # This file
|
├── models/                # Place your TTS models here
|   ├── coqui/
|   ├── piper/
|   └── kokoro/
|
├── static/
|   ├── css/style.css      # Stylesheet
|   ├── js/script.js       # Frontend JavaScript
|   └── audio/             # Temporary storage for generated audio
|
└── templates/
    └── index.html         # Main HTML page
```

## Setup and Installation

### 1. Prerequisites

- Python 3.9 to 3.11 (Recommended). **Note:** The Coqui TTS library is not yet available for Python 3.12+.
- `pip` and `venv` for managing dependencies.

### 2. Create a Virtual Environment

It is highly recommended to use a virtual environment to avoid conflicts with system-wide packages.

```bash
# Navigate to the project directory
cd /path/to/OpenWebTTS

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
# On macOS and Linux:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate
```

### 3. Install Dependencies

Install all the required Python libraries using the `requirements.txt` file.

```bash
pip install -r requirements.txt
```

### 4. Download and Place TTS Models

You need to download the pre-trained models for the TTS engines you wish to use. Place them in the corresponding subdirectories inside the `models/` folder.

#### Coqui TTS (In development.)

1.  Find a model from the [Coqui TTS releases](https://github.com/coqui-ai/TTS/releases) or train your own.
2.  A Coqui model is typically a directory containing files like `model.pth`, `config.json`, and `speakers.json` (for multi-speaker models).
3.  Place the entire model directory inside `models/coqui/`. For example: `models/coqui/your-coqui-model/`.

#### Piper

1.  Download a Piper voice model from the [official repository](https://huggingface.co/rhasspy/piper-voices/tree/main).
2.  A Piper model consists of two files: an `.onnx` file (the model itself) and a `.json` file (the model config).
3.  Place both files inside `models/piper/`. For example: `models/piper/en_US-lessac-medium.onnx` and `models/piper/en_US-lessac-medium.onnx.json`.

#### Kokoro (In development)

1.  Kokoro integration is done via its command-line interface.
2.  Ensure the Kokoro executable or script is available in your system's `PATH` or provide a full path to it.
3.  Place any required Kokoro model files inside the `models/kokoro/` directory. The application will pass the path to these models when calling the Kokoro CLI.

## How to Run the Application

Once you have installed the dependencies and placed your models, you can start the web server.

```bash
python app.py
```

The application will be available at `http://127.0.0.1:8000`.

## Speech-to-Text Feature

OpenWebTTS now includes speech-to-text functionality using OpenAI's Whisper model. This feature allows you to:

- **Record Audio**: Click the "Record Audio" button to start recording speech through your microphone
- **Automatic Transcription**: The recorded audio is automatically converted to text using the Whisper tiny model
- **Language Detection**: The system automatically detects the language of the spoken content
- **Text Integration**: Transcribed text is automatically added to the text input area for further processing

### Requirements for Speech-to-Text

- **Microphone Access**: Your browser must have permission to access your microphone
- **Whisper Model**: The application will automatically download the Whisper tiny model on first use (approximately 39MB)
- **Internet Connection**: Required for the initial model download

### Supported Audio Formats

The speech-to-text feature supports various audio formats including:
- WebM (recommended)
- MP4
- WAV
- MP3
- M4A
- FLAC
- OGG
- AAC

### Usage

1. Click the green "Record Audio" button to start recording
2. Speak clearly into your microphone
3. Click the red "Stop Recording" button when finished
4. Wait for the transcription to complete
5. The transcribed text will appear in the text input area
6. You can then use the text-to-speech features to convert the transcribed text back to audio

### Desktop Mode (In development)

You can also run OpenWebTTS as a desktop app using a lightweight webview window.

```bash
python app.py --desktop
```

Optional flags:

- `--host` to bind to a different host (defaults to `127.0.0.1`)
- `--port` to request a specific port (if taken, a free port is chosen)

Notes:

- Desktop mode requires `pywebview` and `PyGObject` (installed via `requirements.txt`). On Linux, you may need a GUI backend such as GTK or Qt.
- For GTK backend on Linux, install system packages: `sudo pacman -S webkit2gtk` (Arch) or `sudo apt install libwebkit2gtk-4.0-37` (Debian/Ubuntu; package names may vary).
- The Python GTK bindings (`PyGObject`) are automatically installed via pip in the virtual environment.
- If you encounter issues opening the window, try running in browser mode without `--desktop`.

## Usage

1.  Open your web browser and navigate to `http://127.0.0.1:8000`.
2.  Select the desired TTS engine from the first dropdown menu.
3.  The second dropdown will automatically populate with the available voices/speakers for that engine. Select one.
4.  Enter the text you want to convert to speech in the textarea.
5.  Click the "Generate Speech" button.
6.  The audio will be generated and will start playing automatically.
7.  A "Download Audio" link will appear, allowing you to save the generated `.wav` file.
