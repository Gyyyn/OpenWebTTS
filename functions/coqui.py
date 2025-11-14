import os
import torch
from TTS.api import TTS
from config import COQUI_DIR
from config import DEVICE

def save_voice_sample(file_data: bytes, filename: str):
    """Saves an audio file to the Coqui models directory."""
    if not os.path.exists(COQUI_DIR):
        os.makedirs(COQUI_DIR)
    
    # Sanitize filename to prevent security issues like path traversal
    sanitized_filename = os.path.basename(filename)
    
    # Ensure it has a .wav extension
    if not sanitized_filename.lower().endswith('.wav'):
        sanitized_filename = os.path.splitext(sanitized_filename)[0] + '.wav'
        
    file_path = os.path.join(COQUI_DIR, sanitized_filename)
    
    with open(file_path, "wb") as f:
        f.write(file_data)
        
    return file_path

# TTS to a file, use a preset speaker
def coqui_process_audio(voice, lang, text, output):
    # Initialize TTS
    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(DEVICE)

    torch.cuda.empty_cache()

    tts.tts_to_file(
        text=text,
        speaker_wav=voice,
        language=lang,
        file_path=output
    )
