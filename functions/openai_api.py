
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, Header
from pydantic import BaseModel
import io
import os
import hashlib
import requests
from typing import List, Dict, Optional
from fastapi.responses import FileResponse

from functions.routes import (
    get_coqui_voices, 
    get_piper_voices, 
    get_kokoro_voices, 
    get_kitten_voices, 
    _generate_audio_file, 
    SynthesizeRequest, 
    Voice,
    AUDIO_CACHE_DIR,
)
import functions.gemini

openai_api_router = APIRouter()

class SpeechRequest(BaseModel):
    model: str
    input: str
    voice: str = "alloy"
    response_format: str = "mp3"
    speed: float = 1.0

# Global voice map
OPENAI_VOICE_MAP: Dict[str, Dict[str, str]] = {}

def build_voice_map():
    global OPENAI_VOICE_MAP
    # Clear previous map
    OPENAI_VOICE_MAP = {} 

    # Fetch voices from different engines
    all_voices: List[Voice] = []
    #all_voices.extend(get_coqui_voices())
    all_voices.extend(get_piper_voices())
    all_voices.extend(get_kokoro_voices())
    all_voices.extend(get_kitten_voices())
    #all_voices.extend(functions.gemini.list_voices()) # Add Gemini voices

    # Populate the OpenAI voice map
    # We'll use a simple mapping: OpenAI voice name -> (engine, voice_id)
    # For now, let's map directly if names are unique enough or define a priority/prefix
    for voice in all_voices:
        # Example: "Coqui: voice_name" becomes "coqui-voice_name"
        # Or, just use the voice.id directly if it's unique enough across engines
        # For simplicity, let's prioritize and make unique.
        
        # If the voice name already contains the engine prefix, remove it for cleaner OpenAI voice names
        if "Coqui: " in voice.name:
            openai_voice_name = voice.name.replace("Coqui: ", "coqui-").replace(" ", "-").lower()
            OPENAI_VOICE_MAP[openai_voice_name] = {"engine": "coqui", "voice_id": voice.id}
        elif "Piper: " in voice.name:
            openai_voice_name = voice.name.replace("Piper: ", "piper-").replace(" ", "-").lower()
            OPENAI_VOICE_MAP[openai_voice_name] = {"engine": "piper", "voice_id": voice.id}
        elif "Kokoro: " in voice.name:
            openai_voice_name = voice.name.replace("Kokoro: ", "kokoro-").replace(" ", "-").lower()
            OPENAI_VOICE_MAP[openai_voice_name] = {"engine": "kokoro", "voice_id": voice.id}
        elif "Kitten: " in voice.name:
            openai_voice_name = voice.name.replace("Kitten: ", "kitten-").replace(" ", "-").lower()
            OPENAI_VOICE_MAP[openai_voice_name] = {"engine": "kitten", "voice_id": voice.id}
        elif voice.id in ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]: # Gemini voices
            OPENAI_VOICE_MAP[voice.id] = {"engine": "gemini", "voice_id": voice.id}

    # Add a default mapping for common OpenAI voices if they don't explicitly map to an engine.
    # This assumes "alloy", "echo", etc., will default to a specific engine or be handled by Gemini directly.
    if "alloy" not in OPENAI_VOICE_MAP:
         OPENAI_VOICE_MAP["alloy"] = {"engine": "gemini", "voice_id": "alloy"}
    if "echo" not in OPENAI_VOICE_MAP:
        OPENAI_VOICE_MAP["echo"] = {"engine": "gemini", "voice_id": "echo"}
    if "fable" not in OPENAI_VOICE_MAP:
        OPENAI_VOICE_MAP["fable"] = {"engine": "gemini", "voice_id": "fable"}
    if "onyx" not in OPENAI_VOICE_MAP:
        OPENAI_VOICE_MAP["onyx"] = {"engine": "gemini", "voice_id": "onyx"}
    if "nova" not in OPENAI_VOICE_MAP:
        OPENAI_VOICE_MAP["nova"] = {"engine": "gemini", "voice_id": "nova"}
    if "shimmer" not in OPENAI_VOICE_MAP:
        OPENAI_VOICE_MAP["shimmer"] = {"engine": "gemini", "voice_id": "shimmer"}


@openai_api_router.on_event("startup")
async def startup_event():
    build_voice_map()

@openai_api_router.get("/v1/voices", response_model=List[Voice])
async def list_openai_voices():
    build_voice_map()  # Ensure the map is up-to-date
    voices_list = []
    for openai_name, info in OPENAI_VOICE_MAP.items():
        voices_list.append(Voice(id=openai_name, name=f"{info['engine'].capitalize()}: {info['voice_id']}"))
    return voices_list

@openai_api_router.post("/v1/audio/speech")
async def generate_speech(request: SpeechRequest, background_tasks: BackgroundTasks, api_key: Optional[str] = Header(None)):
    
    # Rebuild voice map for dynamic voice changes
    build_voice_map()

    # Validate voice selection
    if request.voice not in OPENAI_VOICE_MAP:
        raise HTTPException(status_code=400, detail=f"Voice not supported. Choose from {list(OPENAI_VOICE_MAP.keys())}")

    voice_info = OPENAI_VOICE_MAP[request.voice]
    engine = voice_info["engine"]
    voice_id = voice_info["voice_id"]

    # Validate output format
    supported_formats = ["mp3", "opus", "aac", "flac", "wav"]
    if request.response_format not in supported_formats:
        raise HTTPException(status_code=400, detail=f"Format {request.response_format} not supported. Use one of {supported_formats}")

    # Create a SynthesizeRequest for audio generation
    synthesize_request = SynthesizeRequest(
        engine=engine,
        voice=voice_id,
        text=request.input,
        api_key=api_key # Pass the API key if provided
    )

    # Generate a unique hash for the audio file
    hash_input = f"{request.input}-{voice_id}-{engine}-{request.response_format}"
    unique_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
    output_filename = f"{unique_hash}.{request.response_format}"
    output_path = os.path.join(AUDIO_CACHE_DIR, output_filename)

    if not os.path.exists(output_path):
        # Generate audio if not cached
        try:
            _generate_audio_file(synthesize_request, output_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate audio: {str(e)}")

    # Set media type based on format
    media_types = {
        "mp3": "audio/mpeg",
        "opus": "audio/ogg", # Assuming opus is Ogg Opus
        "aac": "audio/aac",
        "flac": "audio/flac",
        "wav": "audio/wav"
    }

    return FileResponse(
        path=output_path,
        media_type=media_types[request.response_format],
        filename=output_filename
    )