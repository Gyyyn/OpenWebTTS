import os
import uvicorn
import subprocess
import uuid
import wave
import fitz  # PyMuPDF
import requests
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Dict
from io import BytesIO
import tempfile
import shutil

# --- Configuration ---
MODELS_DIR = "models"
AUDIO_DIR = "static/audio"
COQUI_DIR = os.path.join(MODELS_DIR, "coqui")
PIPER_DIR = os.path.join(MODELS_DIR, "piper")
KOKORO_DIR = os.path.join(MODELS_DIR, "kokoro")

# --- FastAPI Setup ---
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- Pydantic Models ---
class SynthesizeRequest(BaseModel):
    engine: str
    voice: str
    text: str

class Voice(BaseModel):
    id: str
    name: str

class PdfText(BaseModel):
    text: str

class PiperVoice(BaseModel):
    key: str
    URL: str

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
    # Kokoro voices are managed by the CLI, so we might have a placeholder
    # or a config file to list them. Here, we'll assume a simple convention.
    voices = []
    if not os.path.exists(KOKORO_DIR):
        return voices
    # This is a placeholder. You might need to adapt this based on how
    # you manage Kokoro models.
    for model_file in os.listdir(KOKORO_DIR):
        voices.append(Voice(id=model_file, name=f"Kokoro: {model_file}"))
    return [Voice(id="default", name="Kokoro: Default")] # Placeholder

def generate_audio(request: SynthesizeRequest) -> str:
    output_filename = f"{uuid.uuid4()}.wav"
    output_path = os.path.join(AUDIO_DIR, output_filename)

    try:
        if request.engine == "coqui":
            from TTS.api import TTS
            model_path = os.path.join(COQUI_DIR, request.voice)
            tts = TTS(model_path=model_path)
            tts.tts_to_file(text=request.text, file_path=output_path)

        elif request.engine == "piper":
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
            # This is a placeholder command. You MUST adapt it to your Kokoro CLI's syntax.
            # Example: kokoro --model models/kokoro/your_model --text "Hello" --out speech.wav
            command = [
                "kokoro", # Assuming 'kokoro' is in the system PATH
                "--model", os.path.join(KOKORO_DIR, request.voice),
                "--text", request.text,
                "--out", output_path
            ]
            subprocess.run(command, check=True, capture_output=True, text=True)

        else:
            raise ValueError("Unsupported TTS engine.")

    except Exception as e:
        # Log the full error for debugging
        print(f"Error generating audio for engine {request.engine}: {e}")
        # Re-raise as HTTPException to send a clean error to the client
        raise HTTPException(status_code=500, detail=f"Failed to generate audio. Reason: {str(e)}")

    return f"/static/audio/{output_filename}"

# --- API Endpoints ---

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    # Ensure audio directory exists
    os.makedirs(AUDIO_DIR, exist_ok=True)
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
        config_url = f"{voice.URL}.json"
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

@app.get("/api/voices", response_model=List[Voice])
async def list_voices(engine: str):
    if engine == "coqui":
        return get_coqui_voices()
    elif engine == "piper":
        return get_piper_voices()
    elif engine == "kokoro":
        return get_kokoro_voices()
    else:
        return []

@app.post("/api/synthesize")
async def synthesize_speech(request: SynthesizeRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    audio_url = generate_audio(request)
    return JSONResponse(content={"audio_url": audio_url})

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


# --- Main Execution ---

if __name__ == "__main__":
    print("Starting OpenWebTTS server...")
    print(f"Access the UI at http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
