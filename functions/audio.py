from pydub import AudioSegment, effects
import os
import time

def normalize_audio(path):
    # Longer delay to ensure file is fully written
    time.sleep(0.3)
    
    rawsound = AudioSegment.from_file(f'{path}', "wav")
    normalizedsound = effects.compress_dynamic_range(rawsound)
    normalizedsound = effects.normalize(rawsound)
    normalizedsound.export(f'{path}', format="wav")
    
    # Ensure file is flushed to disk (Windows-compatible)
    try:
        # Force flush file system buffers
        with open(path, 'rb') as f:
            os.fsync(f.fileno())
    except Exception:
        pass
    time.sleep(0.1)  # Additional safety delay