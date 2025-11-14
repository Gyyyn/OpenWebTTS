import os
from fastapi.templating import Jinja2Templates

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
USERS_DIR = "users"
DEVICE = 'cpu';

def set_device(str):
    global DEVICE
    DEVICE = str

# --- Templates ---
templates = Jinja2Templates(directory=TEMPLATES_DIR)
