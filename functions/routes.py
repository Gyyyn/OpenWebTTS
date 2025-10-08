import os
import subprocess
import hashlib
import shutil
import tempfile
from io import BytesIO
from typing import List, Dict, Optional
import ebooklib
import fitz
import docx
import requests
import whisper
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
from bs4 import BeautifulSoup
from ebooklib import epub
from fastapi import (APIRouter, BackgroundTasks, File, Form, HTTPException, Request, UploadFile)
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from pydantic import BaseModel, Field
from langdetect import detect

# Import shared objects from app.py
from config import templates, AUDIO_DIR, AUDIO_CACHE_DIR, COQUI_DIR, PIPER_DIR, KOKORO_DIR, USERS_DIR

# Import other function modules
from functions.gemini import gemini_process_audio, gemini_list_voices
from functions.coqui import coqui_process_audio, save_voice_sample
from functions.kokoro import kokoro_process_audio
from functions.kitten import kitten_process_audio
from functions.users import UserManager
from functions.webpage import extract_readable_content

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

def get_coqui_voices() -> List[Voice]:
    voices = []
    if not os.path.exists(COQUI_DIR):
        return voices
    for file_name in os.listdir(COQUI_DIR):
        if file_name.endswith(".wav"):
            voice_id = file_name.replace(".wav", "")
            voices.append(Voice(id=voice_id, name=f"Coqui: {voice_id}"))
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

def get_kitten_voices() -> List[Voice]:
    # Kitten doesn't need model files.
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

def get_gemini_voices(api_key: str) -> List[Voice]:
    output = []
    
    # The 'api_key' parameter should be the file path to your Google Cloud service account JSON file.
    credentials_path = None
    if api_key:
        if os.path.exists(api_key):
            credentials_path = api_key
        else:
            print(f"WARNING: The provided api_key='{api_key}' is not a valid file path. Trying to fall back on environment variables.")
    
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

def _generate_audio_file(request: SynthesizeRequest, output_path: str):
    try:
        # ---
        # Process audio with Piper
        # ---
        if request.engine == "piper":
            model_path = os.path.join(PIPER_DIR, f"{request.voice}.onnx")
            command = [
                "piper",
                "--model", model_path,
                "--output_file", output_path,
            ]
            subprocess.run(command, input=request.text, text=True, check=True, encoding='utf-8')
        # ---
        # Process audio with Coqui
        # ---
        elif request.engine == 'coqui':
            coqui_process_audio('models/coqui/sample.wav', request.lang, request.text, output_path)
        # ---
        # Process audio with Kokoro
        # ---
        elif request.engine == "kokoro":
            kokoro_process_audio(request.voice, False, request.text, output_path)
        # ---
        # Process audio with Google Cloud TTS
        # ---
        elif request.engine == "gemini":
            use_env_var = "GOOGLE_APPLICATION_CREDENTIALS" in os.environ

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
            kitten_process_audio(request.voice, False, request.text, output_path)
        # ---
        # Or fail.
        # ---
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

@router.post("/api/voice_cloning")
async def voice_cloning(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.content_type == "audio/wav":
         print(f"Warning: Received file with content type {file.content_type}, expected audio/wav.")

    try:
        audio_content = await file.read()
        
        saved_path = save_voice_sample(audio_content, file.filename)
        
        return JSONResponse(content={"message": f"Voice sample saved successfully as {os.path.basename(saved_path)}"}, status_code=200)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save voice sample. Reason: {str(e)}")

@router.get("/api/voices", response_model=List[Voice])
async def list_voices(engine: str, api_key: Optional[str] = None):
    if engine == "coqui":
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
        images = convert_from_bytes(pdf_bytes)
        ocr_text = ""
        for image in images:
            ocr_text += pytesseract.image_to_string(image)
        
        result_path = os.path.join(OCR_CACHE_DIR, f"{task_id}.txt")
        with open(result_path, "w", encoding="utf-8") as f:
            f.write(ocr_text)
        print(f"OCR for task {task_id} completed. Result saved to {result_path}")
    except Exception as e:
        print(f"Error during OCR for task {task_id}: {e}")
        result_path = os.path.join(OCR_CACHE_DIR, f"{task_id}.error")
        with open(result_path, "w", encoding="utf-8") as f:
            f.write(str(e))

@router.post("/api/read_pdf")
async def read_pdf(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")
    try:
        pdf_bytes = await file.read()
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page_num in range(len(pdf_document)):
            page = pdf_document.load_page(page_num)
            text += page.get_text()

        if text.strip():
            print("Extracted text directly from PDF.")
            return JSONResponse(content={"status": "completed", "text": text})

        # If text is empty, perform OCR in the background
        print("No text in PDF, starting OCR in background.")
        
        # Generate a unique ID for this task
        task_id = hashlib.sha256(pdf_bytes).hexdigest()
        
        # Check if result already exists (e.g. from a previous run)
        result_path = os.path.join(OCR_CACHE_DIR, f"{task_id}.txt")
        if os.path.exists(result_path):
            with open(result_path, "r", encoding="utf-8") as f:
                ocr_text = f.read()
            return JSONResponse(content={"status": "completed", "text": ocr_text})

        if background_tasks:
            background_tasks.add_task(_perform_ocr, pdf_bytes, task_id)
        
        return JSONResponse(content={"status": "ocr_started", "task_id": task_id})

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

    return FileResponse(user_pdf_path, media_type="application/pdf")

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

