import os
import uvicorn
import subprocess
import uuid
import wave
import fitz  # PyMuPDF
import requests
import ebooklib
import hashlib
from ebooklib import epub
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, BackgroundTasks
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Dict, Optional
from io import BytesIO
import tempfile
import shutil
import argparse
import threading
import time
import socket
import whisper
import functions.gemini
from functions.kokoro import kokoro_process_audio

# --- Configuration ---
DATA_DIR = os.environ.get("OPENWEBTTS_DATA_DIR")

if DATA_DIR:
    MODELS_DIR = os.path.join(DATA_DIR, "models")
    STATIC_DIR = os.path.join(DATA_DIR, "static")
    TEMPLATES_DIR = os.path.join(DATA_DIR, "templates")
else:
    MODELS_DIR = "models"
    STATIC_DIR = "static"
    TEMPLATES_DIR = "templates"

AUDIO_DIR = os.path.join(STATIC_DIR, "audio")
AUDIO_CACHE_DIR = os.path.join(STATIC_DIR, "audio_cache")
COQUI_DIR = os.path.join(MODELS_DIR, "coqui")
PIPER_DIR = os.path.join(MODELS_DIR, "piper")
KOKORO_DIR = os.path.join(MODELS_DIR, "kokoro")

# --- Functions ---

def check_model_directories():
    directories = [COQUI_DIR, PIPER_DIR, KOKORO_DIR]
    
    missing_directories = [directory for directory in directories if not os.path.exists(directory)]
    
    if missing_directories:
        print(f"Directories do not exist: {missing_directories}")
        print("Creating the necessary directories...")
        
        for directory in missing_directories:
            os.makedirs(directory, exist_ok=True)
        return True
    
    return False

# --- FastAPI Setup ---
app = FastAPI()
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# --- Pydantic Models ---
class SynthesizeRequest(BaseModel):
    engine: str
    voice: str
    text: str
    api_key: Optional[str] = None

class Voice(BaseModel):
    id: str
    name: str

class PdfText(BaseModel):
    text: str

class PiperVoice(BaseModel):
    key: str
    URL: str

class KokoroVoice(BaseModel):
    key: str
    URL: str

class SpeechToTextResponse(BaseModel):
    text: str
    language: Optional[str] = None

# --- TTS Engine Functions ---

def get_coqui_voices() -> List[Voice]:
    voices = []
    if not os.path.exists(COQUI_DIR):
        return voices
    for model_dir in os.listdir(COQUI_DIR):
        model_path = os.path.join(COQUI_DIR, model_dir)
        if os.path.isdir(model_path):
            # Simple check for a config file to identify a model
            if 'config.json' in os.listdir(model_path):
                voices.append(Voice(id=model_dir, name=f"Coqui: {model_dir}"))
    return voices

def get_piper_voices() -> List[Voice]:
    voices = []
    if not os.path.exists(PIPER_DIR):
        return voices
    for file_name in os.listdir(PIPER_DIR):
        if file_name.endswith(".onnx"):
            voice_id = file_name.replace(".onnx", "")
            voices.append(Voice(id=voice_id, name=f"Piper: {voice_id}"))
    return voices

def get_kokoro_voices() -> List[Voice]:
    voices = []
    if not os.path.exists(KOKORO_DIR):
        return voices
    for file_name in os.listdir(KOKORO_DIR):
        if file_name.endswith(".pt"):
            voice_id = file_name.replace(".pt", "")
            voices.append(Voice(id=voice_id, name=f"Kokoro: {voice_id}"))
    return voices

def _generate_audio_file(request: SynthesizeRequest, output_path: str):
    try:
        """ if request.engine == "coqui":
            from TTS.api import TTS
            model_path = os.path.join(COQUI_DIR, request.voice)
            tts = TTS(model_path=model_path)
            tts.tts_to_file(text=request.text, file_path=output_path) """

        if request.engine == "piper":
            # Ensure the piper command is in the system's PATH
            model_path = os.path.join(PIPER_DIR, f"{request.voice}.onnx")
            command = [
                "piper",
                "--model", model_path,
                "--output_file", output_path,
            ]
            # We pipe the text to the command's stdin
            subprocess.run(command, input=request.text, text=True, check=True, encoding='utf-8')

        elif request.engine == "kokoro":
            kokoro_process_audio(request.voice, False, request.text, output_path)

        elif request.engine == "gemini":
            if not request.api_key:
                raise ValueError("Gemini API key is required for Gemini engine.")
            audio_content = gemini.text_to_speech(request.api_key, request.text, request.voice)
            if audio_content:
                with open(output_path, "wb") as f:
                    f.write(audio_content)
            else:
                raise ValueError("Failed to get audio content from Gemini API.")

        else:
            raise ValueError("Unsupported TTS engine.")

    except Exception as e:
        # Log the full error for debugging
        print(f"Error generating audio for engine {request.engine}: {e}")
        # Re-raise as HTTPException to send a clean error to the client
        raise HTTPException(status_code=500, detail=f"Failed to generate audio. Reason: {str(e)}")

# --- API Endpoints ---

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    # Ensure audio directories exist
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/config", response_class=HTMLResponse)
async def read_config(request: Request):
    return templates.TemplateResponse("config.html", {"request": request})

@app.get("/api/piper_voices")
async def get_piper_voices_from_hf():
    try:
        response = requests.get("https://huggingface.co/rhasspy/piper-voices/raw/main/voices.json")
        response.raise_for_status()
        return JSONResponse(content=response.json())
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch voices from Hugging Face: {e}")

@app.post("/api/download_piper_voice")
async def download_piper_voice(voice: PiperVoice):

    check_model_directories()

    try:
        voice_url = voice.URL
        # Construct the download URL
        url = f"{voice_url}"
        
        # Download the model file
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Save the model to the piper directory
        model_path = os.path.join(PIPER_DIR, f"{voice.key}.onnx")
        with open(model_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        # Download the model config file
        config_url = f"{voice_url}.json"
        config_response = requests.get(config_url)
        config_response.raise_for_status()
        config_path = os.path.join(PIPER_DIR, f"{voice.key}.onnx.json")
        with open(config_path, "w") as f:
            f.write(config_response.text)

        return JSONResponse(content={"message": f"Successfully downloaded {voice.key}"})

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to download voice: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@app.post("/api/download_kokoro_voice")
async def download_piper_voice(voice: KokoroVoice):

    check_model_directories()

    try:        
        # Download the model file
        response = requests.get(voice.URL, stream=True)
        response.raise_for_status()
        
        # Save the model to the piper directory
        model_path = os.path.join(KOKORO_DIR, f"{voice.key}")
        with open(model_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return JSONResponse(content={"message": f"Successfully downloaded {voice.key}"})

    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to download voice: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@app.get("/api/voices", response_model=List[Voice])
async def list_voices(engine: str):
    if engine == "coqui":
        return get_coqui_voices()
    elif engine == "piper":
        return get_piper_voices()
    elif engine == "kokoro":
        return get_kokoro_voices()
    elif engine == "gemini":
        return gemini.list_voices()
    else:
        return []

@app.post("/api/synthesize")
async def synthesize_speech(request: SynthesizeRequest, background_tasks: BackgroundTasks):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # 1. Create a Unique Identifier
    hash_input = f"{request.text}-{request.voice}-{request.engine}"
    unique_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
    output_filename = f"{unique_hash}.wav"
    output_path = os.path.join(AUDIO_CACHE_DIR, output_filename)
    audio_url = f"/static/audio_cache/{output_filename}"
    
    # 2. Check if audio is already cached
    if os.path.exists(output_path):
        # 3. Cache Hit: Return URL immediately
        return JSONResponse(content={"audio_url": audio_url, "status": "ready"})
    else:
        # 4. Cache Miss: Generate audio in the background
        background_tasks.add_task(_generate_audio_file, request, output_path)
        return JSONResponse(content={"audio_url": audio_url, "status": "generating"})

@app.post("/api/read_pdf", response_model=PdfText)
async def read_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")

    try:
        pdf_bytes = await file.read()
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            text += page.get_text()
        return PdfText(text=text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF. Reason: {str(e)}")

@app.post("/api/read_epub", response_model=PdfText) # Reusing PdfText model for simplicity
async def read_epub(file: UploadFile = File(...)):
    if not file.filename.endswith((".epub", ".opf")): # .opf is sometimes used for epub content
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an EPUB file.")

    try:
        epub_bytes = await file.read()
        
        # Create a temporary file to write the epub bytes
        with tempfile.NamedTemporaryFile(delete=False, suffix=".epub") as temp_epub_file:
            temp_epub_file.write(epub_bytes)
            temp_epub_path = temp_epub_file.name

        try:
            book = epub.read_epub(temp_epub_path)
            
            full_text = []
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    # Use BeautifulSoup to parse HTML and extract text
                    soup = BeautifulSoup(item.content, 'html.parser')
                    # Extract text from common tags, you might need to refine this
                    for tag in ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'div']:
                        for element in soup.find_all(tag):
                            text_content = element.get_text(separator=' ', strip=True)
                            if text_content:
                                full_text.append(text_content)
            
            return PdfText(text="\n\n".join(full_text)) # Join with double newline for readability
        finally:
            # Ensure the temporary file is deleted
            os.unlink(temp_epub_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read EPUB. Reason: {str(e)}")

@app.get("/api/clear_cache")
async def clear_cache():
    try:
        shutil.rmtree(AUDIO_CACHE_DIR)
        os.makedirs(AUDIO_CACHE_DIR)
        return JSONResponse(content={"message": "Cache cleared."})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache. Reason: {str(e)}")

@app.post("/api/speech_to_text", response_model=SpeechToTextResponse)
async def speech_to_text(file: UploadFile = File(...)):
    """
    Convert speech to text using OpenAI's Whisper model.
    Accepts audio files in various formats (wav, mp3, m4a, etc.)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check if file is an audio file
    audio_extensions = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.webm', '.aac', '.mp4'}
    file_extension = os.path.splitext(file.filename.lower())[1]
    
    if file_extension not in audio_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Supported formats: {', '.join(audio_extensions)}"
        )
    
    try:
        # Read the uploaded file
        audio_content = await file.read()
        
        # Create a temporary file to save the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_audio_file:
            temp_audio_file.write(audio_content)
            temp_audio_path = temp_audio_file.name
        
        try:
            # Load the Whisper model (tiny model for faster processing)
            model = whisper.load_model("tiny")
            
            # Transcribe the audio
            result = model.transcribe(temp_audio_path)
            
            # Extract the transcribed text and detected language
            transcribed_text = result["text"].strip()
            detected_language = result.get("language", None)
            
            return SpeechToTextResponse(
                text=transcribed_text,
                language=detected_language
            )
            
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
                
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to transcribe audio. Reason: {str(e)}"
        )

# --- Main Execution ---

def _find_free_port(preferred_port: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", preferred_port))
            return preferred_port
        except OSError:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenWebTTS server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind the server to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind the server to")
    parser.add_argument("--desktop", action="store_true", help="Launch as a desktop app using a webview")
    args = parser.parse_args()

    host = args.host
    port = _find_free_port(args.port)

    if not args.desktop:
        print("Starting OpenWebTTS server...")
        print(f"Access the UI at http://{host}:{port}")
        uvicorn.run(app, host=host, port=port)
    else:
        try:
            import webview
        except Exception as e:
            print("pywebview is required for desktop mode. Install with: pip install pywebview")
            raise

        print("Starting OpenWebTTS server in desktop mode...")
        config = uvicorn.Config(app, host=host, port=port, log_level="info")
        server = uvicorn.Server(config)

        server_thread = threading.Thread(target=server.run, daemon=True)
        server_thread.start()

        # Wait briefly for the server to start
        for _ in range(50):
            if getattr(server, "started", False):
                break
            time.sleep(0.1)

        url = f"http://{host}:{port}"
        print(f"Opening desktop window at {url}")
        try:
            window = webview.create_window("OpenWebTTS", url)
            webview.start()
        finally:
            # Signal server to exit and wait a moment
            try:
                server.should_exit = True
            except Exception:
                pass
            time.sleep(0.2)