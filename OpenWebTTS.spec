# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from PyInstaller.utils.hooks import collect_all, collect_submodules

_console = os.environ.get("OPENWEBTTS_CONSOLE", "0") == "1"
_cuda_build = os.environ.get("OPENWEBTTS_CUDA", "0") == "1"

if sys.platform == "win32":
    _icon = "tts.ico" if os.path.exists("tts.ico") else None
elif sys.platform == "darwin":
    if os.path.exists("tts.icns"):
        _icon = "tts.icns"
    elif os.path.exists("maskable_icon_x512.png"):
        _icon = "maskable_icon_x512.png"
    else:
        _icon = None
else:
    _icon = "maskable_icon_x512.png" if os.path.exists("maskable_icon_x512.png") else None

datas = [
    ('static/audio/noise', 'static/audio/noise'),
    ('static/css', 'static/css'),
    ('static/icons', 'static/icons'),
    ('static/image', 'static/image'),
    ('static/js', 'static/js'),
    ('static/favicon.png', 'static'),
    ('templates', 'templates'),
    ('functions', 'functions'),
    ('maskable_icon_x128.png', '.'),
]
binaries = []
hiddenimports = [
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'functions.piper',
    'functions.coqui',
    'functions.kokoro',
    'functions.kitten',
    'functions.chatterbox',
    'functions.phonon',
    'functions.gemini',
]

# Packages with dynamic imports, native libraries, or bundled data assets
_collect_packages = [
    'piper',
    'espeakng_loader',
    'kokoro',
    'misaki',
    'kittentts',
    'TTS',
    'ptts',
    'chatterbox',
    'whisper',
    'webview',
    'langdetect',
    'en_core_web_sm',
    'spacy',
    'thinc',
    'pyopenjtalk',
    'sudachipy',
    'sudachidict_core',
    'phonemizer',
    'onnxruntime',
    'soundfile',
    '_soundfile_data',
    'imageio_ffmpeg',
    'qtpy',
    'pythonnet',
    'clr_loader',
]

for _pkg in _collect_packages:
    try:
        _d, _b, _h = collect_all(_pkg)
        datas += _d
        binaries += _b
        hiddenimports += _h
    except Exception:
        pass

for _sub_pkg in ('google.cloud.texttospeech', 'webview.platforms'):
    try:
        hiddenimports += collect_submodules(_sub_pkg)
    except Exception:
        pass

excludes = [] if _cuda_build else ['nvidia', 'triton']


a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='OpenWebTTS',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=_console,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=_icon,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='OpenWebTTS',
)

if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name='OpenWebTTS.app',
        icon=_icon,
        bundle_identifier='io.github.gyyyn.OpenWebTTS',
        info_plist={
            'CFBundleName': 'OpenWebTTS',
            'CFBundleDisplayName': 'OpenWebTTS',
            'NSHighResolutionCapable': True,
            'LSMinimumSystemVersion': '11.0',
        },
    )
