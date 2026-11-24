import os
from fastapi.templating import Jinja2Templates

# --- Configuration ---
DATA_DIR = os.environ.get("OPENWEBTTS_DATA_DIR")

if DATA_DIR:
    MODELS_DIR = os.path.join(DATA_DIR, "models")
    STATIC_DIR = os.path.join(DATA_DIR, "static")
    TEMPLATES_DIR = os.path.join(DATA_DIR, "templates")
    USERS_DIR = os.path.join(DATA_DIR, "users")
else:
    MODELS_DIR = "models"
    STATIC_DIR = "static"
    TEMPLATES_DIR = "templates"
    USERS_DIR = "users"

AUDIO_DIR = os.path.join(STATIC_DIR, "audio")
AUDIO_CACHE_DIR = os.path.join(STATIC_DIR, "audio_cache")
COQUI_DIR = os.path.join(MODELS_DIR, "coqui")
PIPER_DIR = os.path.join(MODELS_DIR, "piper")
KOKORO_DIR = os.path.join(MODELS_DIR, "kokoro")
DEVICE = 'cpu';

# Secret key for session authentication
SECRET_KEY = os.environ.get("OPENWEBTTS_SECRET_KEY")
if not SECRET_KEY:
    _secret_file = os.path.join(DATA_DIR if DATA_DIR else ".", ".secret_key")
    if os.path.exists(_secret_file):
        try:
            with open(_secret_file, "r", encoding="utf-8") as _f:
                SECRET_KEY = _f.read().strip()
        except Exception:
            SECRET_KEY = None
    if not SECRET_KEY:
        import secrets
        SECRET_KEY = secrets.token_hex(32)
        try:
            with open(_secret_file, "w", encoding="utf-8") as _f:
                _f.write(SECRET_KEY)
        except Exception:
            pass

def set_device(str):
    global DEVICE
    DEVICE = str

# --- Templates ---
templates = Jinja2Templates(directory=TEMPLATES_DIR)
