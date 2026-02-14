import os
import base64
import hashlib
import shutil
import tempfile
from io import BytesIO
from typing import List, Dict, Optional, Any
import ebooklib
import fitz
import docx
import requests
import whisper
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

# Configure tesseract path for Windows
import platform
if platform.system() == 'Windows':
    # Try common Tesseract installation paths
    possible_paths = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]
    for path in possible_paths:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            print(f"✅ Tesseract configured at: {path}")
            break
    else:
        print("⚠️ Tesseract not found in standard paths. OCR may fail.")

from bs4 import BeautifulSoup
from ebooklib import epub
from fastapi import (APIRouter, BackgroundTasks, File, Form, HTTPException, Request, UploadFile)
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response
from pydantic import BaseModel, Field
from langdetect import detect

# Import shared objects from app.py
from config import templates, AUDIO_DIR, AUDIO_CACHE_DIR, COQUI_DIR, PIPER_DIR, KOKORO_DIR, USERS_DIR, DEVICE

# Import other function modules
from functions.users import UserManager
from functions.webpage import extract_readable_content
from functions.text_processor import process_text_for_tts, split_into_sentences_semantic

# Lazy imports for TTS engines - these will be imported only when needed
def lazy_import_piper():
    from functions.piper import piper_process_audio
    return piper_process_audio

def lazy_import_gemini():
    from functions.gemini import gemini_process_audio, gemini_list_voices
    return gemini_process_audio, gemini_list_voices

def lazy_import_coqui():
    from functions.coqui import coqui_process_audio, save_voice_sample
    return coqui_process_audio, save_voice_sample

def lazy_import_kokoro():
    from functions.kokoro import kokoro_process_audio
    return kokoro_process_audio

def lazy_import_kitten():
    from functions.kitten import kitten_process_audio
    return kitten_process_audio

def lazy_import_chatterbox():
    from functions.chatterbox import chatterbox_process_audio
    return chatterbox_process_audio

router = APIRouter()

# --- Pydantic Models ---
class DetectLangRequest(BaseModel):
    text: str

class SynthesizeRequest(BaseModel):
    engine: str
    lang: Optional[str] = 'en'
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

class BookData(BaseModel):
    title: str
    content: str
    is_pdf: bool = False

class PodcastGenerate(BaseModel):
    title: str
    text: str
    engine: str
    voice: str
    api_key: Optional[str] = None

class ReadWebsiteRequest(BaseModel):
    url: str

class BookUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    is_pdf: Optional[bool] = None
    ocr_text: Optional[str] = None


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

# --- Voice Listing ---

# Coqui doesn't need model files, but we do list .wavs
# that are used for voice cloning.
def get_coqui_voices() -> List[Voice]:
    voices = []
    if not os.path.exists(COQUI_DIR):
        return voices
    for file_name in os.listdir(COQUI_DIR):
        if file_name.endswith(".wav"):
            voice_id = file_name.replace(".wav", "")
            voices.append(Voice(id=voice_id, name=f"Coqui: {voice_id}"))
    return voices

# Piper's models are just .onnx files.
def get_piper_voices() -> List[Voice]:
    voices = []
    if not os.path.exists(PIPER_DIR):
        return voices
    for file_name in os.listdir(PIPER_DIR):
        if file_name.endswith(".onnx"):
            voice_id = file_name.replace(".onnx", "")
            voices.append(Voice(id=voice_id, name=f"Piper: {voice_id}"))
    return voices

# Kokoro uses .pt for models files
def get_kokoro_voices() -> List[Voice]:
    voices = []
    if not os.path.exists(KOKORO_DIR):
        return voices
    for file_name in os.listdir(KOKORO_DIR):
        if file_name.endswith(".pt"):
            voice_id = file_name.replace(".pt", "")
            voices.append(Voice(id=voice_id, name=f"Kokoro: {voice_id}"))
    return voices

# Kitten doesn't need model files. And currently
# has a limited selection of voices.
def get_kitten_voices() -> List[Voice]:
    output = []
    voices = [
        "expr-voice-2-m",
        "expr-voice-2-f",
        "expr-voice-3-m",
        "expr-voice-3-f", 
        "expr-voice-4-m",
        "expr-voice-4-f",
        "expr-voice-5-m",
        "expr-voice-5-f"
    ]

    for voice in voices:
        output.append(Voice(id=voice, name=f"Kitten: {voice}"))

    return output

# "Gemini Voice", or Google Cloud Text-To-Speech requires a service account 
# JSON file, or the enviroment variable to authenticate with Google Cloud.
def get_gemini_voices(api_key: str) -> List[Voice]:
    output = []
    
    # The 'api_key' parameter should be the file path to your Google Cloud service account JSON file.
    credentials_path = None
    if api_key:
        if os.path.exists(api_key):
            credentials_path = api_key
        else:
            print(f"WARNING: The provided api_key='{api_key}' is not a valid file path. Trying to fall back on environment variables.")
    
    # Lazy import Gemini functions
    _, gemini_list_voices = lazy_import_gemini()
    voices = gemini_list_voices(credentials_json_path=credentials_path)

    for voice in voices:
        # Also adding the language code to the name for better user experience
        lang_code = voice.language_codes[0] if voice.language_codes else 'unknown'
        output.append(Voice(id=voice.name, name=f"Gemini: {voice.name} ({lang_code})"))

    if not voices:
         print("---")
         print("DEBUG: Gemini voices list is empty. This is likely a credential issue.")
         print("Please check the following:")
         print("1. If using the 'api_key' parameter, ensure it's a VALID PATH to your service account JSON file.")
         print("2. If not using 'api_key', ensure the GOOGLE_APPLICATION_CREDENTIALS environment variable is set correctly.")
         print("3. Ensure the service account has the 'Cloud Text-to-Speech API' enabled in your Google Cloud project.")
         print("4. Check the server logs for any specific authentication errors from the Google Cloud client library.")
         print("---")

    return output

# -------------------------
# --- Speech Generation ---
# -------------------------

def _generate_audio_file(request: SynthesizeRequest, output_path: str):
    try:
        # ---
        # Process audio with Piper
        # ---
        if request.engine == "piper":
            model_path = os.path.join(PIPER_DIR, f"{request.voice}.onnx")
            piper_process_audio = lazy_import_piper()
            piper_process_audio(model_path, request.lang, request.text, output_path)
        # ---
        # Process audio with Coqui
        # ---
        elif request.engine == 'coqui':
            voice_path = os.path.join(COQUI_DIR, f"{request.voice}.wav")
            coqui_process_audio, _ = lazy_import_coqui()
            coqui_process_audio(voice_path, request.lang, request.text, output_path)
        elif request.engine == 'chatterbox':
            voice_path = os.path.join(COQUI_DIR, f"{request.voice}.wav")
            chatterbox_process_audio = lazy_import_chatterbox()
            chatterbox_process_audio(voice_path, request.lang, request.text, output_path)
        # ---
        # Process audio with Kokoro
        # ---
        elif request.engine == "kokoro":
            kokoro_process_audio = lazy_import_kokoro()
            kokoro_process_audio(request.voice, False, request.text, output_path)
        # ---
        # Process audio with Google Cloud TTS
        # ---
        elif request.engine == "gemini":
            use_env_var = "GOOGLE_APPLICATION_CREDENTIALS" in os.environ

            gemini_process_audio, _ = lazy_import_gemini()
            if os.path.exists(request.api_key):
                print(f"Found '{request.api_key}', using it for authentication.")
                gemini_process_audio(text=request.text, voice=request.voice, output_filename=output_path, credentials_json_path=request.api_key)
            elif use_env_var:
                print("Found GOOGLE_APPLICATION_CREDENTIALS environment variable, using it for authentication.")
                # No need to pass the path, the function will find it automatically
                gemini_process_audio(text=request.text, voice=request.voice, output_filename=output_path)
            else:
                print("-" * 80)
                print("WARNING: Could not find credentials.")
                print("This script requires authentication to work.")
                print("\nPlease do one of the following:")
                print(f"1. Place your service account JSON key in this directory and name it '{local_credentials_file}'")
                print("OR")
                print("2. Set the GOOGLE_APPLICATION_CREDENTIALS environment variable.")
                print("\nSee the README.md file for detailed instructions.")
                print("-" * 80)
        # ---
        # Process audio with Kitten
        # ---
        elif request.engine == "kitten":
            kitten_process_audio = lazy_import_kitten()
            kitten_process_audio(request.voice, False, request.text, output_path)
        # ---
        # Or fail.
        # ---
        else:
            raise ValueError("Unsupported TTS engine.")
    except Exception as e:
        print(f"Error generating audio for engine {request.engine}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate audio. Reason: {str(e)}")

# --- Standard routes ---

@router.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    os.makedirs(AUDIO_DIR, exist_ok=True)
    os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/config", response_class=HTMLResponse)
async def read_config(request: Request):
    return templates.TemplateResponse("config.html", {"request": request})

@router.get("/favicon.ico")
async def favicon():
    return FileResponse("static/favicon.png", media_type="image/png")

# -----------------------
# ---  API Endpoints  ---
# -----------------------

@router.get("/api/health")
async def health_check():
    """Health check endpoint for browser extension and monitoring."""
    return JSONResponse(content={
        "status": "healthy",
        "service": "OpenWebTTS",
        "version": "1.0.0"
    })

class GenerateSpeechRequest(BaseModel):
    text: str = Field(..., description="Text to convert to speech")
    voice: Optional[str] = Field("piper", description="TTS engine/voice to use")
    speed: Optional[float] = Field(1.0, description="Playback speed multiplier")
    chunkSize: Optional[int] = Field(50, description="Words per chunk for splitting")

class WordTiming(BaseModel):
    word: str
    startTime: float
    endTime: float
    index: int

class ChunkTiming(BaseModel):
    text: str
    startTime: float
    endTime: float
    startOffset: int
    endOffset: int
    words: List[WordTiming]

class SpeechTimingResponse(BaseModel):
    audioUrl: str
    duration: float
    chunks: List[ChunkTiming]
    originalText: str
    normalizedText: str

def calculate_word_timings(text: str, duration: float, chunk_size: int = 50) -> List[ChunkTiming]:
    """
    Calculate precise timing for words and chunks based on text and audio duration.
    Uses character-based distribution for more accurate timing.
    """
    import re
    
    # Normalize text: remove extra whitespace, normalize punctuation
    normalized_text = ' '.join(text.split())
    normalized_text = re.sub(r'\s+([.,!?;:])', r'\1', normalized_text)
    
    # Split into words while preserving positions
    words_with_pos = []
    for match in re.finditer(r'\S+', normalized_text):
        words_with_pos.append({
            'word': match.group(),
            'start': match.start(),
            'end': match.end()
        })
    
    if not words_with_pos:
        return []
    
    total_chars = len(normalized_text)
    chunks = []
    
    # Split words into chunks
    for chunk_idx in range(0, len(words_with_pos), chunk_size):
        chunk_words = words_with_pos[chunk_idx:chunk_idx + chunk_size]
        
        # Calculate chunk boundaries
        chunk_start_offset = chunk_words[0]['start']
        chunk_end_offset = chunk_words[-1]['end']
        chunk_text = normalized_text[chunk_start_offset:chunk_end_offset]
        
        # Calculate chunk timing based on character position
        chunk_start_time = (chunk_start_offset / total_chars) * duration
        chunk_end_time = (chunk_end_offset / total_chars) * duration
        
        # Calculate word timings within chunk
        word_timings = []
        for word_idx, word_data in enumerate(chunk_words):
            word_start_time = (word_data['start'] / total_chars) * duration
            word_end_time = (word_data['end'] / total_chars) * duration
            
            word_timings.append(WordTiming(
                word=word_data['word'],
                startTime=round(word_start_time, 3),
                endTime=round(word_end_time, 3),
                index=word_idx
            ))
        
        chunks.append(ChunkTiming(
            text=chunk_text,
            startTime=round(chunk_start_time, 3),
            endTime=round(chunk_end_time, 3),
            startOffset=chunk_start_offset,
            endOffset=chunk_end_offset,
            words=word_timings
        ))
    
    return chunks

@router.post("/api/generate_speech")
async def generate_speech(request: GenerateSpeechRequest):
    """
    Generate speech audio from text for browser extension.
    Returns audio file directly as response.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    # Create hash for caching
    hash_input = f"{request.text}-{request.voice}-{request.speed}"
    unique_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
    output_filename = f"{unique_hash}.wav"
    output_path = os.path.join(AUDIO_CACHE_DIR, output_filename)
    
    # Check if audio already exists in cache
    if not os.path.exists(output_path):
        # Generate audio based on engine/voice
        try:
            engine = request.voice.lower()
            
            if engine == "piper":
                piper_process_audio = lazy_import_piper()
                # Piper requires: model_path, lang, text, output
                model_path = os.path.join(PIPER_DIR, "en_US-lessac-high.onnx")
                piper_process_audio(model_path, "en_US", request.text, output_path)
            elif engine == "kokoro":
                kokoro_process_audio = lazy_import_kokoro()
                # Kokoro requires: voice, lang, text, output
                # Default to American English Liam voice
                kokoro_process_audio(voice="am_liam", lang="a", text=request.text, output=output_path)
            elif engine == "coqui":
                coqui_process_audio, _ = lazy_import_coqui()
                # Coqui requires: voice_path, lang, text, output
                # Use default voice sample if available
                voice_path = os.path.join(COQUI_DIR, "default.wav")
                if not os.path.exists(voice_path):
                    raise HTTPException(status_code=400, detail="Coqui requires a voice sample. Please upload one first.")
                coqui_process_audio(voice_path, "en", request.text, output_path)
            elif engine == "openai":
                # For OpenAI, we'd need API key - use default for now
                raise HTTPException(status_code=400, detail="OpenAI TTS requires API key configuration")
            else:
                # Default to Piper
                piper_process_audio = lazy_import_piper()
                model_path = os.path.join(PIPER_DIR, "en_US-lessac-high.onnx")
                piper_process_audio(model_path, "en_US", request.text, output_path)
                
        except Exception as e:
            print(f"❌ Error generating speech: {e}")
            raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")
    
    # Return audio file
    if not os.path.exists(output_path):
        raise HTTPException(status_code=500, detail="Audio generation failed")
    
    # For backward compatibility, return file directly
    return FileResponse(
        output_path,
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"attachment; filename={output_filename}",
            "Cache-Control": "public, max-age=31536000",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Private-Network": "true"
        }
    )

@router.post("/api/generate_speech_with_timing")
async def generate_speech_with_timing(request: GenerateSpeechRequest):
    """
    Generate speech audio with precise timing information for synchronized highlighting.
    Generates separate audio for each chunk with timing data.
    Detects and marks skip regions (like citation markers) for non-highlighting.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    import re
    
    # Normalize text
    normalized_text = ' '.join(request.text.split())
    normalized_text = re.sub(r'\s+([.,!?;:])', r'\1', normalized_text)
    
    # Pattern to detect skip regions: citation markers like [1], [2][3], etc.
    skip_pattern = re.compile(r'\[\d+\](?:\[\d+\])*')
    
    # Split into chunks based on chunk size
    words = normalized_text.split()
    chunk_size = request.chunkSize or 50
    
    chunks_data = []
    current_pos = 0
    
    for chunk_idx in range(0, len(words), chunk_size):
        chunk_words = words[chunk_idx:chunk_idx + chunk_size]
        chunk_text = ' '.join(chunk_words)
        
        # Calculate character offsets
        start_offset = normalized_text.find(chunk_text, current_pos)
        end_offset = start_offset + len(chunk_text)
        current_pos = end_offset
        
        # Create hash for this chunk
        hash_input = f"{chunk_text}-{request.voice}-{request.speed}"
        unique_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
        output_filename = f"{unique_hash}.wav"
        output_path = os.path.join(AUDIO_CACHE_DIR, output_filename)
        
        # Generate audio if not cached (includes citation markers for TTS)
        if not os.path.exists(output_path):
            try:
                engine = request.voice.lower()
                
                if engine == "piper":
                    piper_process_audio = lazy_import_piper()
                    model_path = os.path.join(PIPER_DIR, "en_US-lessac-high.onnx")
                    piper_process_audio(model_path, "en_US", chunk_text, output_path)
                elif engine == "kokoro":
                    kokoro_process_audio = lazy_import_kokoro()
                    kokoro_process_audio(voice="am_liam", lang="a", text=chunk_text, output=output_path)
                elif engine == "coqui":
                    coqui_process_audio, _ = lazy_import_coqui()
                    voice_path = os.path.join(COQUI_DIR, "default.wav")
                    if not os.path.exists(voice_path):
                        raise HTTPException(status_code=400, detail="Coqui requires a voice sample.")
                    coqui_process_audio(voice_path, "en", chunk_text, output_path)
                else:
                    # Default to Piper
                    piper_process_audio = lazy_import_piper()
                    model_path = os.path.join(PIPER_DIR, "en_US-lessac-high.onnx")
                    piper_process_audio(model_path, "en_US", chunk_text, output_path)
                    
            except Exception as e:
                print(f"❌ Error generating speech for chunk {chunk_idx}: {e}")
                raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail=f"Audio generation failed for chunk {chunk_idx}")
        
        # Get audio duration for this chunk
        import wave
        try:
            with wave.open(output_path, 'rb') as wav_file:
                frames = wav_file.getnframes()
                rate = wav_file.getframerate()
                duration = frames / float(rate)
        except Exception as e:
            print(f"⚠️ Could not read audio duration: {e}")
            duration = len(chunk_words) * 0.5  # Fallback
        
        # Calculate word timings for this chunk with skip detection
        word_timings = []
        chunk_char_count = len(chunk_text)
        
        for word_idx, word in enumerate(chunk_words):
            # Find word position in chunk text
            word_search_start = sum(len(chunk_words[i]) + 1 for i in range(word_idx))
            word_start_pos = chunk_text.find(word, word_search_start)
            if word_start_pos == -1:
                word_start_pos = word_search_start
            word_end_pos = word_start_pos + len(word)
            
            # Calculate timing based on character position
            word_start_time = (word_start_pos / chunk_char_count) * duration if chunk_char_count > 0 else 0
            word_end_time = (word_end_pos / chunk_char_count) * duration if chunk_char_count > 0 else duration
            
            # Check if this word matches skip pattern (citation marker)
            is_skip = bool(skip_pattern.fullmatch(word))
            
            word_timings.append({
                'word': word,
                'startTime': round(word_start_time, 3),
                'endTime': round(word_end_time, 3),
                'index': word_idx,
                'skip': is_skip  # Mark citation markers to skip highlighting
            })
        
        # Create chunk timing data
        chunks_data.append({
            'audioUrl': f"/audio_cache/{output_filename}",
            'duration': round(duration, 3),
            'text': chunk_text,
            'startTime': 0,  # Each chunk's audio starts at 0
            'endTime': round(duration, 3),
            'startOffset': start_offset,
            'endOffset': end_offset,
            'words': word_timings
        })
    
    # Return timing data
    return JSONResponse(
        content={
            'chunks': chunks_data,
            'originalText': request.text,
            'normalizedText': normalized_text
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Private-Network": "true"
        }
    )

@router.options("/api/generate_speech")
async def generate_speech_options(request: Request):
    """Handle CORS preflight request for browser extension."""
    # Check if Private Network Access is requested
    access_pna = request.headers.get("Access-Control-Request-Private-Network") == "true"
    
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "3600"
    }
    
    # Add Private Network Access header if requested
    if access_pna:
        headers["Access-Control-Allow-Private-Network"] = "true"
    
    return JSONResponse(content={}, headers=headers)

@router.options("/api/generate_speech_with_timing")
async def generate_speech_with_timing_options(request: Request):
    """Handle CORS preflight request for timing-based endpoint."""
    access_pna = request.headers.get("Access-Control-Request-Private-Network") == "true"
    
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "3600"
    }
    
    if access_pna:
        headers["Access-Control-Allow-Private-Network"] = "true"
    
    return JSONResponse(content={}, headers=headers)
# -----------------------

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
        with open(config_path, "w", encoding="utf-8") as f:
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

@router.post("/api/voice_cloning")
async def voice_cloning(file: UploadFile = File(...)):    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.content_type == "audio/wav":
         print(f"Warning: Received file with content type {file.content_type}, expected audio/wav.")

    try:
        audio_content = await file.read()
        
        # Lazy import Coqui functions
        _, save_voice_sample = lazy_import_coqui()
        saved_path = save_voice_sample(audio_content, file.filename)
        
        return JSONResponse(content={"message": f"Voice sample saved successfully as {os.path.basename(saved_path)}"}, status_code=200)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save voice sample. Reason: {str(e)}")

@router.get("/api/voices", response_model=List[Voice])
async def list_voices(engine: str, api_key: Optional[str] = None):
    
    if engine == "coqui":
        return get_coqui_voices()
    elif engine == "chatterbox":
        return get_coqui_voices()
    elif engine == "piper":
        return get_piper_voices()
    elif engine == "kokoro":
        return get_kokoro_voices()
    elif engine == "kitten":
        return get_kitten_voices()
    elif engine == "gemini":
        return get_gemini_voices(api_key=api_key)
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

OCR_CACHE_DIR = os.path.join(tempfile.gettempdir(), "openwebtts_ocr_cache")
os.makedirs(OCR_CACHE_DIR, exist_ok=True)

def _perform_ocr(pdf_bytes: bytes, task_id: str):
    """Background task to perform OCR and save the result."""
    try:
        # Convert PDF to images - requires Poppler
        # On Windows, specify poppler path if installed via conda/scoop/manual
        poppler_path = None
        if platform.system() == 'Windows':
            # Try common Poppler installation locations
            possible_poppler = [
                r'C:\Program Files\poppler\Library\bin',
                r'C:\poppler\Library\bin',
                os.path.expanduser('~\\scoop\\apps\\poppler\\current\\Library\\bin'),
            ]
            for path in possible_poppler:
                if os.path.exists(path):
                    poppler_path = path
                    break
        
        images = convert_from_bytes(pdf_bytes, poppler_path=poppler_path)
        ocr_text = ""
        
        # Process images in batches to avoid memory issues
        for i, image in enumerate(images):
            try:
                page_text = pytesseract.image_to_string(image, timeout=30)
                ocr_text += f"\n--- Page {i+1} ---\n{page_text}"
            except Exception as page_error:
                print(f"Warning: Failed to OCR page {i+1}: {page_error}")
                ocr_text += f"\n--- Page {i+1} ---\n[OCR failed for this page]\n"
        
        result_path = os.path.join(OCR_CACHE_DIR, f"{task_id}.txt")
        with open(result_path, "w", encoding="utf-8") as f:
            f.write(ocr_text)
        print(f"✅ OCR for task {task_id} completed. Result saved to {result_path}")
        
    except ImportError as e:
        error_msg = f"Missing dependency: {e}. Install with: pip install pdf2image pytesseract"
        print(f"❌ {error_msg}")
        result_path = os.path.join(OCR_CACHE_DIR, f"{task_id}.error")
        with open(result_path, "w", encoding="utf-8") as f:
            f.write(error_msg)
            
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        
        # Provide specific error messages based on the exception
        if 'poppler' in error_msg.lower() or 'Unable to get page count' in error_msg:
            error_msg = (
                "Poppler not found. OCR requires Poppler to convert PDF pages to images. "
                "Install with: 'choco install poppler' or download from https://github.com/oschwartz10612/poppler-windows/releases/"
            )
        elif 'tesseract' in error_msg.lower():
            error_msg = (
                "Tesseract error. Ensure Tesseract is properly installed. "
                "Download from: https://github.com/UB-Mannheim/tesseract/wiki"
            )
        else:
            error_msg = f"{error_type}: {error_msg}"
        
        print(f"❌ Error during OCR for task {task_id}: {error_msg}")
        result_path = os.path.join(OCR_CACHE_DIR, f"{task_id}.error")
        with open(result_path, "w", encoding="utf-8") as f:
            f.write(error_msg)

def _merge_extracted_and_ocr_text(extracted_text: str, ocr_text: str) -> str:
    """
    Intelligently merge direct text extraction with OCR results.
    Prioritizes direct extraction but adds OCR content for pages with little/no text.
    """
    if not ocr_text or not ocr_text.strip():
        return extracted_text
    
    if not extracted_text or not extracted_text.strip():
        return ocr_text
    
    # Split by pages if OCR has page markers
    ocr_pages = ocr_text.split("--- Page ")
    extracted_lines = extracted_text.split('\n')
    
    # If OCR found significantly more content, prefer OCR
    if len(ocr_text.strip()) > len(extracted_text.strip()) * 1.5:
        print(f"OCR found more content ({len(ocr_text)} vs {len(extracted_text)} chars), using OCR")
        return ocr_text
    
    # Otherwise, combine: use extracted text + OCR for pages with minimal extracted text
    print(f"Combining extracted text ({len(extracted_text)} chars) with OCR ({len(ocr_text)} chars)")
    return extracted_text + "\n\n--- Additional OCR Content ---\n" + ocr_text

@router.post("/api/read_pdf")
async def read_pdf(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")
    try:
        pdf_bytes = await file.read()
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Always extract direct text first
        extracted_text = ""
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            extracted_text += page.get_text()
        
        # Generate a unique ID for caching
        task_id = hashlib.sha256(pdf_bytes).hexdigest()
        result_path = os.path.join(OCR_CACHE_DIR, f"{task_id}.txt")
        
        # Check if OCR already completed from previous run
        if os.path.exists(result_path):
            with open(result_path, "r", encoding="utf-8") as f:
                ocr_text = f.read()
            merged_text = _merge_extracted_and_ocr_text(extracted_text, ocr_text)
            print(f"Using cached OCR + extracted text ({len(merged_text)} chars total)")
            return JSONResponse(content={"status": "completed", "text": merged_text})
        
        # Start OCR in background regardless of extracted text
        print(f"Starting OCR in background (extracted {len(extracted_text)} chars directly)")
        if background_tasks:
            background_tasks.add_task(_perform_ocr, pdf_bytes, task_id)
        
        # Return extracted text immediately, OCR will enhance it later
        if extracted_text.strip():
            return JSONResponse(content={
                "status": "ocr_started",
                "task_id": task_id,
                "text": extracted_text,
                "partial": True
            })
        else:
            # No extracted text, wait for OCR
            return JSONResponse(content={
                "status": "ocr_started", 
                "task_id": task_id
            })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF. Reason: {str(e)}")

@router.get("/api/ocr_result/{task_id}")
async def get_ocr_result(task_id: str):
    result_path = os.path.join(OCR_CACHE_DIR, f"{task_id}.txt")
    error_path = os.path.join(OCR_CACHE_DIR, f"{task_id}.error")

    if os.path.exists(result_path):
        with open(result_path, "r", encoding="utf-8") as f:
            text = f.read()
        return JSONResponse(content={"status": "completed", "text": text})
    elif os.path.exists(error_path):
        with open(error_path, "r", encoding="utf-8") as f:
            error_message = f.read()
        return JSONResponse(content={"status": "failed", "detail": error_message})
    else:
        return JSONResponse(content={"status": "processing"})

@router.post("/api/read_pdf_with_chunks")
async def read_pdf_with_chunks(file: UploadFile = File(...)):
    """
    Extract PDF content with positional information for each text element.
    Returns both raw text and structured data for rendering interactive text layer.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")
    try:
        pdf_bytes = await file.read()
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        pages_data = []
        full_text = ""
        
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            text = page.get_text()
            full_text += text + "\n"
            
            # Get text with position information
            blocks = page.get_text("dict")["blocks"]
            text_elements = []
            
            for block in blocks:
                if block.get("type") == 0:  # Text block
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text_elements.append({
                                "text": span.get("text", ""),
                                "bbox": span.get("bbox", [0, 0, 0, 0]),  # [x0, y0, x1, y1]
                                "font": span.get("font", ""),
                                "size": span.get("size", 12)
                            })
            
            pages_data.append({
                "page_num": page_num + 1,
                "width": page.rect.width,
                "height": page.rect.height,
                "text_elements": text_elements
            })
        
        return JSONResponse(content={
            "status": "success",
            "full_text": full_text,
            "pages": pages_data,
            "num_pages": len(pdf_document)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read PDF with chunks. Reason: {str(e)}")

@router.post("/api/process_pdf_interactive")
async def process_pdf_interactive(file: UploadFile = File(...), chunk_size: int = 50):
    """
    Comprehensive PDF processing endpoint that returns complete structured data
    for client-side rendering, clicking, and word-level highlighting.
    
    This endpoint:
    - Extracts text with precise positioning for every text element
    - Creates word-level mappings for highlighting during reading
    - Returns optimized data structure ready for client interaction
    - Enables clickable text overlay and real-time word highlighting
    
    Args:
        file: PDF file upload
        chunk_size: Number of words per reading chunk (default: 50)
    
    Returns:
        Complete structured PDF data with pages, elements, and chunks
    """
    from functions.pdf_processor import process_pdf_for_interactive_reading
    
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")
    
    try:
        pdf_bytes = await file.read()
        
        # Process PDF with comprehensive data extraction
        result = process_pdf_for_interactive_reading(
            pdf_bytes=pdf_bytes,
            options={"chunk_size": chunk_size}
        )
        
        return JSONResponse(content=result)
        
    except Exception as e:
        import traceback
        error_detail = f"Failed to process PDF: {str(e)}\n{traceback.format_exc()}"
        print(f"❌ PDF Processing Error: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)


@router.post("/api/get_chunk_highlight")
async def get_chunk_highlight(chunk_id: int, pdf_data: Dict[str, Any]):
    """
    Get highlighting data for a specific chunk during playback.
    This is called by the client during audio playback to highlight words.
    
    Args:
        chunk_id: ID of the chunk being played
        pdf_data: The processed PDF data structure
    
    Returns:
        Highlighting information for the requested chunk
    """
    from functions.pdf_processor import get_highlight_data_for_chunk
    
    try:
        highlight_data = get_highlight_data_for_chunk(pdf_data, chunk_id)
        return JSONResponse(content=highlight_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get highlight data: {str(e)}")


class TextProcessRequest(BaseModel):
    text: str
    chunk_size: int = Field(default=200, ge=50, le=1000)
    use_llm: bool = True

@router.post("/api/process_text")
async def process_text(request: TextProcessRequest):
    """
    Process text with semantic sentence splitting using Qwen2.5 LLM.
    Falls back to rule-based splitting if LLM unavailable.
    """
    try:
        chunks = process_text_for_tts(
            text=request.text,
            chunk_size=request.chunk_size,
            use_llm=request.use_llm
        )
        return JSONResponse(content={
            "status": "success",
            "chunks": chunks,
            "chunk_count": len(chunks)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process text: {str(e)}")

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
            full_html = []
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    soup = BeautifulSoup(item.content, 'html.parser')
                    full_html.append(str(soup))
            return PdfText(text="\n".join(full_html))
        finally:
            os.unlink(temp_epub_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read EPUB. Reason: {str(e)}")

@router.post("/api/read_docx", response_model=PdfText)
async def read_docx(file: UploadFile = File(...)):
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a DOCX file.")
    try:
        docx_bytes = await file.read()
        doc = docx.Document(BytesIO(docx_bytes))
        full_text = []
        for para in doc.paragraphs:
            full_text.append(para.text)
        return PdfText(text="\n".join(full_text))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read DOCX. Reason: {str(e)}")

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

def get_folder_size(folder_path):
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(folder_path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size

@router.get("/api/cache_size")
async def get_cache_size():
    try:
        size_in_bytes = get_folder_size(AUDIO_CACHE_DIR)
        size_in_mb = size_in_bytes / (1024 * 1024)
        return JSONResponse(content={"cache_size_mb": f"{size_in_mb:.2f} MB"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cache size. Reason: {str(e)}")

# -----------------------
# --- User Management ---
# -----------------------
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

class PodcastGenerate(BaseModel):
    title: str
    text: str
    engine: str
    voice: str
    api_key: Optional[str] = None

class ReadWebsiteRequest(BaseModel):
    url: str

class BookUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    ocr_text: Optional[str] = None

@router.post("/api/read_website", response_model=PdfText)
async def read_website(request: ReadWebsiteRequest):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(request.url, headers=headers)
        response.raise_for_status()  # Raise an exception for HTTP errors
        content = extract_readable_content(response.text)
        return PdfText(text=content)
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch website content: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read website. Reason: {str(e)}")

@router.post("/api/detect_lang")
async def detect_lang(request: DetectLangRequest):
    try:
        lang = detect(request.text)
        return JSONResponse(content={"language": lang})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to detect language. Reason: {str(e)}")

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

# -----------------------------
# --- Users Book Management ---
# -----------------------------
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

@router.get("/api/users/{username}/pdfs")
async def get_user_pdfs_route(username: str):
    pdfs = user_manager.get_pdf_books(username)
    return {"pdfs": pdfs}

@router.post("/api/users/{username}/pdfs")
async def upload_pdf_route(username: str, file: UploadFile = File(...), content: str = Form(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are supported.")

    pdf_content = await file.read()
    # Sanitize the content (which is the desired filename) to prevent path traversal
    sanitized_content = os.path.basename(content) # Ensures only the filename part is used
    filename_with_ext = f"{sanitized_content}.pdf"

    try:
        # Save the PDF to the user's folder and get the absolute path on the server
        absolute_pdf_path = user_manager.save_pdf_to_user_folder(username, filename_with_ext, pdf_content)
        
        # Construct the URL that the frontend will use to fetch the PDF
        pdf_fetch_url = f"/api/users/{username}/pdfs/{filename_with_ext}"

        # Save book metadata to user's JSON with the fetch URL as content
        book_data = {"title": sanitized_content, "content": pdf_fetch_url, "is_pdf": True}
        success, book_id = user_manager.add_book(username, book_data)
        if not success:
            # If book metadata fails to save, attempt to remove the uploaded PDF file
            if os.path.exists(absolute_pdf_path):
                os.unlink(absolute_pdf_path)
            raise HTTPException(status_code=500, detail="Failed to record PDF in user's books.")

        return JSONResponse(content={
            "message": "PDF uploaded and saved successfully.",
            "book_id": book_id,
            "path": pdf_fetch_url  # Return the fetch URL to the frontend
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save PDF: {str(e)}")

@router.get("/api/users/{username}/pdfs/{filename}")
async def get_user_pdf(username: str, filename: str):
    # Sanitize filename to prevent path traversal issues
    sanitized_filename = os.path.basename(filename)
    user_pdf_path = os.path.join(user_manager._get_user_folder(username), sanitized_filename)

    if not os.path.exists(user_pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found.")

    # Read the PDF file content and return it directly with proper headers
    with open(user_pdf_path, 'rb') as f:
        pdf_content = f.read()
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={sanitized_filename}",
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
    )

def extract_pdf_text_positions(pdf_path: str):
    """Extract text with positions from PDF using PyMuPDF - comprehensive extraction"""
    try:
        doc = fitz.open(pdf_path)
        pages_data = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            page_dict = {
                "page_number": page_num + 1,  # 1-based page numbering
                "width": page.rect.width,
                "height": page.rect.height,
                "text_items": []
            }
            
            # Extract text with detailed position information using "dict" method
            # This provides the most complete text extraction
            try:
                blocks = page.get_text("dict")["blocks"]
                
                for block in blocks:
                    if block.get("type") == 0:  # Text block
                        for line in block.get("lines", []):
                            for span in line.get("spans", []):
                                # Only add non-empty text
                                if span["text"].strip():
                                    text_item = {
                                        "text": span["text"],
                                        "x": span["bbox"][0],  # left
                                        "y": span["bbox"][1],  # top
                                        "width": span["bbox"][2] - span["bbox"][0],
                                        "height": span["bbox"][3] - span["bbox"][1],
                                        "font": span.get("font", "sans-serif"),
                                        "size": span.get("size", 12),
                                        "color": span.get("color", 0)
                                    }
                                    page_dict["text_items"].append(text_item)
            except Exception as e:
                print(f"Error extracting text from page {page_num + 1}: {e}")
                # Fallback to simpler text extraction
                try:
                    text_content = page.get_text("text")
                    if text_content.strip():
                        # Create a single text item for the whole page as fallback
                        rect = page.rect
                        page_dict["text_items"].append({
                            "text": text_content,
                            "x": rect.x0,
                            "y": rect.y0,
                            "width": rect.width,
                            "height": rect.height,
                            "font": "sans-serif",
                            "size": 12,
                            "color": 0
                        })
                except Exception as fallback_error:
                    print(f"Fallback text extraction also failed for page {page_num + 1}: {fallback_error}")
            
            pages_data.append(page_dict)
            print(f"✅ Page {page_num + 1}: Extracted {len(page_dict['text_items'])} text items")
        
        doc.close()
        print(f"📄 Total pages processed: {len(pages_data)}")
        return pages_data
    except Exception as e:
        print(f"❌ Error extracting PDF text positions: {e}")
        import traceback
        traceback.print_exc()
        return []

@router.post("/api/users/{username}/pdfs/{filename}/data")
async def get_user_pdf_data(username: str, filename: str):
    """Return PDF as base64 JSON data with text positions extracted by PyMuPDF"""
    # Sanitize filename to prevent path traversal issues
    sanitized_filename = os.path.basename(filename)
    user_pdf_path = os.path.join(user_manager._get_user_folder(username), sanitized_filename)

    if not os.path.exists(user_pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found.")

    # Read the PDF file content and encode as base64
    with open(user_pdf_path, 'rb') as f:
        pdf_content = f.read()
    
    pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
    
    # Extract text positions using PyMuPDF
    text_positions = extract_pdf_text_positions(user_pdf_path)
    
    return JSONResponse(content={
        "filename": sanitized_filename,
        "data": pdf_base64,
        "size": len(pdf_content),
        "text_positions": text_positions
    })

# --------------------------------
# --- Users Podcast Management ---
# --------------------------------
@router.get("/api/users/{username}/podcasts")
async def get_podcasts_route(username: str):
    podcasts = user_manager.get_podcasts(username)
    return {"podcasts": podcasts}

@router.delete("/api/users/{username}/books/{book_id}")
async def delete_book_route(username: str, book_id: str):
    # When deleting a book, check if it's a PDF and remove the file from the server
    user_data = user_manager.get_user_data(username)
    if user_data and book_id in user_data.get('books', {}):
        book_to_delete = user_data['books'][book_id]
        if book_to_delete.get('is_pdf') and book_to_delete.get('content'):
            # Extract filename from the URL to construct the absolute path
            pdf_url = book_to_delete['content']
            filename = os.path.basename(pdf_url)
            pdf_absolute_path = os.path.join(user_manager._get_user_folder(username), filename)
            
            if os.path.exists(pdf_absolute_path):
                os.unlink(pdf_absolute_path) # Delete the actual PDF file
                print(f"Deleted PDF file: {pdf_absolute_path}")

    success = user_manager.delete_book(username, book_id)
    if not success:
        raise HTTPException(status_code=404, detail="Book not found or user does not exist.")
    return {"message": "Book deleted successfully."}

@router.delete("/api/users/{username}/podcasts/{podcast_id}")
async def delete_podcast_route(username: str, podcast_id: str):
    success = user_manager.delete_podcast(username, podcast_id)
    if not success:
        raise HTTPException(status_code=404, detail="Podcast not found or user does not exist.")
    return {"message": "Podcast deleted successfully."}

@router.patch("/api/users/{username}/books/{book_id}")
async def edit_book_route(username: str, book_id: str, book_update: BookUpdate):
    update_data = book_update.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided.")
    success = user_manager.edit_book(username, book_id, update_data)
    if not success:
        raise HTTPException(status_code=404, detail="Book not found.")
    return {"message": "Book updated successfully."}

async def _generate_and_update_podcast_audio(username: str, podcast_id: str, request: SynthesizeRequest, output_path: str, audio_url: str):
    try:
        _generate_audio_file(request, output_path)
        user_manager.update_podcast(username, podcast_id, {"status": "ready", "audio_url": audio_url})
    except Exception as e:
        print(f"Error generating podcast audio for {username}/{podcast_id}: {e}")
        user_manager.update_podcast(username, podcast_id, {"status": "failed", "error": str(e)})

@router.post("/api/users/{username}/podcast")
async def generate_podcast_route(username: str, podcast: PodcastGenerate, background_tasks: BackgroundTasks):
    if not podcast.text.strip():
        raise HTTPException(status_code=400, detail="Podcast text cannot be empty.")

    # Create a SynthesizeRequest for audio generation
    synthesize_request = SynthesizeRequest(
        engine=podcast.engine,
        voice=podcast.voice,
        text=podcast.text,
        api_key=podcast.api_key
    )

    # Generate a unique hash for the audio file
    hash_input = f"{podcast.text}-{podcast.voice}-{podcast.engine}"
    unique_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
    output_filename = f"{unique_hash}.wav"
    output_path = os.path.join(AUDIO_CACHE_DIR, output_filename)
    audio_url = f"/static/audio_cache/{output_filename}"

    # Add initial podcast entry with 'Generating' status
    podcast_data = podcast.dict()
    podcast_data["status"] = "generating"
    podcast_data["audio_url"] = audio_url # Add the audio_url even if not ready yet
    success, podcast_id = user_manager.add_podcast(username, podcast_data)

    if not success:
        raise HTTPException(status_code=404, detail="User not found or failed to add podcast.")
    
    # Schedule the audio generation as a background task
    background_tasks.add_task(_generate_and_update_podcast_audio, username, podcast_id, synthesize_request, output_path, audio_url)

    return JSONResponse(content={
        "message": "Podcast generation started.",
        "podcast_id": podcast_id,
        "status": "generating",
        "audio_url": audio_url
    })


@router.get("/api/noise_files")
async def get_noise_files():
    """Get all noise audio files from /static/audio/noise"""
    noise_dir = os.path.join("static", "audio", "noise")
    if not os.path.exists(noise_dir):
        return JSONResponse(content={"files": []})
    
    try:
        files = []
        for filename in os.listdir(noise_dir):
            if filename.lower().endswith(('.wav', '.mp3', '.ogg', '.flac')):
                files.append(filename)
        return JSONResponse(content={"files": files})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read noise files: {str(e)}")
