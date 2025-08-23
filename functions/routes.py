import os
import subprocess
import hashlib
import shutil
import tempfile
from io import BytesIO
from typing import List, Dict, Optional
import ebooklib
import fitz
import requests
import whisper
from bs4 import BeautifulSoup
from ebooklib import epub
from fastapi import (APIRouter, BackgroundTasks, File, HTTPException, Request, UploadFile)
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

# Import shared objects from app.py
from config import templates, AUDIO_DIR, AUDIO_CACHE_DIR, COQUI_DIR, PIPER_DIR, KOKORO_DIR, USERS_DIR

# Import other function modules
import functions.gemini
from functions.kokoro import kokoro_process_audio
from functions.users import UserManager

router = APIRouter()

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

# --- Helper Functions ---

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

def get_coqui_voices() -> List[Voice]:
    voices = []
    if not os.path.exists(COQUI_DIR):
        return voices
    for model_dir in os.listdir(COQUI_DIR):
        model_path = os.path.join(COQUI_DIR, model_dir)
        if os.path.isdir(model_path):
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
        if request.engine == "piper":
            model_path = os.path.join(PIPER_DIR, f"{request.voice}.onnx")
            command = [
                "piper",
                "--model", model_path,
                "--output_file", output_path,
            ]
            subprocess.run(command, input=request.text, text=True, check=True, encoding='utf-8')
        elif request.engine == "kokoro":
            kokoro_process_audio(request.voice, False, request.text, output_path)
        elif request.engine == "gemini":
            if not request.api_key:
                raise ValueError("Gemini API key is required for Gemini engine.")
            audio_content = functions.gemini.text_to_speech(request.api_key, request.text, request.voice)
            if audio_content:
                with open(output_path, "wb") as f:
                    f.write(audio_content)
            else:
                raise ValueError("Failed to get audio content from Gemini API.")
        else:
            raise ValueError("Unsupported TTS engine.")
    except Exception as e:
        print(f"Error generating audio for engine {request.engine}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate audio. Reason: {str(e)}")

# --- API Endpoints ---

@router.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/config", response_class=HTMLResponse)
async def read_config(request: Request):
    return templates.TemplateResponse("config.html", {"request": request})

@router.get("/api/piper_voices")
async def get_piper_voices_from_hf():
    try:
        response = requests.get("https://huggingface.co/rhasspy/piper-voices/raw/main/voices.json")
        response.raise_for_status()
        return JSONResponse(content=response.json())
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch voices from Hugging Face: {e}")

@router.post("/api/download_piper_voice")
async def download_piper_voice(voice: PiperVoice):
    check_model_directories()
    try:
        voice_url = voice.URL
        url = f"{voice_url}"
        response = requests.get(url, stream=True)
        response.raise_for_status()
        model_path = os.path.join(PIPER_DIR, f"{voice.key}.onnx")
        with open(model_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
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

@router.post("/api/download_kokoro_voice")
async def download_kokoro_voice(voice: KokoroVoice):
    check_model_directories()
    try:
        response = requests.get(voice.URL, stream=True)
        response.raise_for_status()
        model_path = os.path.join(KOKORO_DIR, f"{voice.key}")
        with open(model_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return JSONResponse(content={"message": f"Successfully downloaded {voice.key}"})
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to download voice: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

@router.get("/api/voices", response_model=List[Voice])
async def list_voices(engine: str):
    if engine == "coqui":
        return get_coqui_voices()
    elif engine == "piper":
        return get_piper_voices()
    elif engine == "kokoro":
        return get_kokoro_voices()
    elif engine == "gemini":
        return functions.gemini.list_voices()
    else:
        return []

@router.post("/api/synthesize")
async def synthesize_speech(request: SynthesizeRequest, background_tasks: BackgroundTasks):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    hash_input = f"{request.text}-{request.voice}-{request.engine}"
    unique_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
    output_filename = f"{unique_hash}.wav"
    output_path = os.path.join(AUDIO_CACHE_DIR, output_filename)
    audio_url = f"/static/audio_cache/{output_filename}"
    if os.path.exists(output_path):
        return JSONResponse(content={"audio_url": audio_url, "status": "ready"})
    else:
        background_tasks.add_task(_generate_audio_file, request, output_path)
        return JSONResponse(content={"audio_url": audio_url, "status": "generating"})

@router.post("/api/read_pdf", response_model=PdfText)
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

@router.post("/api/read_epub", response_model=PdfText)
async def read_epub(file: UploadFile = File(...)):
    if not file.filename.endswith((".epub", ".opf")):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an EPUB file.")
    try:
        epub_bytes = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".epub") as temp_epub_file:
            temp_epub_file.write(epub_bytes)
            temp_epub_path = temp_epub_file.name
        try:
            book = epub.read_epub(temp_epub_path)
            full_text = []
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    soup = BeautifulSoup(item.content, 'html.parser')
                    for tag in ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'div']:
                        for element in soup.find_all(tag):
                            text_content = element.get_text(separator=' ', strip=True)
                            if text_content:
                                full_text.append(text_content)
            return PdfText(text="""

""".join(full_text))
        finally:
            os.unlink(temp_epub_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read EPUB. Reason: {str(e)}")

@router.get("/api/clear_cache")
async def clear_cache():
    try:
        shutil.rmtree(AUDIO_CACHE_DIR)
        os.makedirs(AUDIO_CACHE_DIR)
        return JSONResponse(content={"message": "Cache cleared."})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache. Reason: {str(e)}")

@router.post("/api/speech_to_text", response_model=SpeechToTextResponse)
async def speech_to_text(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    audio_extensions = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.webm', '.aac', '.mp4'}
    file_extension = os.path.splitext(file.filename.lower())[1]
    if file_extension not in audio_extensions:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Supported formats: {', '.join(audio_extensions)}")
    try:
        audio_content = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_audio_file:
            temp_audio_file.write(audio_content)
            temp_audio_path = temp_audio_file.name
        try:
            model = whisper.load_model("tiny")
            result = model.transcribe(temp_audio_path)
            transcribed_text = result["text"].strip()
            detected_language = result.get("language", None)
            return SpeechToTextResponse(text=transcribed_text, language=detected_language)
        finally:
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio. Reason: {str(e)}")


# --- User Management ---
user_manager = UserManager(USERS_DIR)

class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class BookData(BaseModel):
    title: str
    content: str

class BookUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

@router.post("/api/users/create")
async def create_user_route(user: UserCreate):
    success, message = user_manager.create_user(user.username, user.password)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

@router.post("/api/users/login")
async def login_route(user: UserLogin):
    success, data = user_manager.authenticate_user(user.username, user.password)
    if not success:
        raise HTTPException(status_code=401, detail=data)
    return {"message": "Login successful", "username": data["username"]}

@router.get("/api/users/{username}/books")
async def get_books_route(username: str):
    books = user_manager.get_books(username)
    return {"books": books}

@router.post("/api/users/{username}/books")
async def add_book_route(username: str, book: BookData):
    success, book_id = user_manager.add_book(username, book.dict())
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Book added successfully.", "book_id": book_id}

@router.delete("/api/users/{username}/books/{book_id}")
async def delete_book_route(username: str, book_id: str):
    success = user_manager.delete_book(username, book_id)
    if not success:
        raise HTTPException(status_code=404, detail="Book not found or user does not exist.")
    return {"message": "Book deleted successfully."}

@router.patch("/api/users/{username}/books/{book_id}")
async def edit_book_route(username: str, book_id: str, book_update: BookUpdate):
    update_data = book_update.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided.")
    success = user_manager.edit_book(username, book_id, update_data)
    if not success:
        raise HTTPException(status_code=404, detail="Book not found.")
    return {"message": "Book updated successfully."}
