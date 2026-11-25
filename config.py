import os
import sys
from fastapi.templating import Jinja2Templates


def _get_default_user_data_dir() -> str:
    """Return the OS-appropriate writable user data directory for frozen builds."""
    if sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, "OpenWebTTS")
    if sys.platform == "darwin":
        return os.path.join(os.path.expanduser("~"), "Library", "Application Support", "OpenWebTTS")
    base = os.environ.get("XDG_DATA_HOME") or os.path.join(os.path.expanduser("~"), ".local", "share")
    return os.path.join(base, "OpenWebTTS")


# --- Configuration ---
IS_FROZEN = getattr(sys, "frozen", False)
BUNDLE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))

_env_data_dir = os.environ.get("OPENWEBTTS_DATA_DIR")
if _env_data_dir:
    DATA_DIR = _env_data_dir
elif IS_FROZEN:
    DATA_DIR = _get_default_user_data_dir()
else:
    DATA_DIR = os.path.dirname(os.path.abspath(__file__))

os.makedirs(DATA_DIR, exist_ok=True)

# Read-only bundled assets (use OPENWEBTTS_DATA_DIR if explicitly provided and present, else BUNDLE_DIR)
if _env_data_dir and os.path.isdir(os.path.join(_env_data_dir, "static")):
    STATIC_DIR = os.path.join(_env_data_dir, "static")
else:
    STATIC_DIR = os.path.join(BUNDLE_DIR, "static")

if _env_data_dir and os.path.isdir(os.path.join(_env_data_dir, "templates")):
    TEMPLATES_DIR = os.path.join(_env_data_dir, "templates")
else:
    TEMPLATES_DIR = os.path.join(BUNDLE_DIR, "templates")

ICON_PATH = os.path.join(BUNDLE_DIR, "maskable_icon_x128.png")

# Writable user data directories
MODELS_DIR = os.path.join(DATA_DIR, "models")
USERS_DIR = os.path.join(DATA_DIR, "users")
AUDIO_DIR = os.path.join(STATIC_DIR, "audio")
if IS_FROZEN or STATIC_DIR != os.path.join(DATA_DIR, "static"):
    AUDIO_CACHE_DIR = os.path.join(DATA_DIR, "audio_cache")
else:
    AUDIO_CACHE_DIR = os.path.join(STATIC_DIR, "audio_cache")

COQUI_DIR = os.path.join(MODELS_DIR, "coqui")
PIPER_DIR = os.path.join(MODELS_DIR, "piper")
KOKORO_DIR = os.path.join(MODELS_DIR, "kokoro")
DEVICE = 'cpu'

# Secret key for session authentication
SECRET_KEY = os.environ.get("OPENWEBTTS_SECRET_KEY")
if not SECRET_KEY:
    _secret_file = os.path.join(DATA_DIR, ".secret_key")
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
