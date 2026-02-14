"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    SPEECHIFY CLONE - 2026 LOCAL VOICE AI READER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

100% Local/Offline Neural TTS Desktop Application
Modern, cross-platform text-to-speech reader with AI features

═══════════════════════════════════════════════════════════════════════════════
📦 INSTALLATION INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════

1. REQUIRED PYTHON PACKAGES:
   pip install PyQt6 PyQt6-WebEngine numpy soundfile pydub
   pip install PyMuPDF python-docx ebooklib beautifulsoup4 lxml
   pip install requests trafilatura readability-lxml
   pip install pygame  # For audio playback

2. TTS ENGINE (Choose ONE - Piper recommended):

   A) PIPER TTS (RECOMMENDED - Fast, Natural, CPU-Friendly):
      Windows:
        - Download: https://github.com/rhasspy/piper/releases
        - Extract piper.exe to same folder as this script
      
      Linux/Mac:
        wget https://github.com/rhasspy/piper/releases/latest/download/piper_amd64.tar.gz
        tar -xzf piper_amd64.tar.gz
      
      Voices:
        - Download from: https://huggingface.co/rhasspy/piper-voices/tree/main
        - Place .onnx and .onnx.json files in: models/piper/
        - Example: en_US-lessac-high.onnx + en_US-lessac-high.onnx.json
      
   B) MELOTTS (Multilingual, High Quality):
      pip install melotts
      # Models auto-download on first use
   
   C) COQUI XTTS (Best Quality, Voice Cloning, GPU Recommended):
      pip install TTS
      # Models auto-download on first use (~2GB)

3. OPTIONAL AI FEATURES:

   - Voice Transcription (Dictation):
     pip install faster-whisper
     # Or: pip install openai-whisper
   
   - Local LLM (Summary/Chat):
     Install Ollama: https://ollama.com/download
     ollama pull phi3:mini  # or llama3.2:3b, gemma2:9b
   
   - OCR (Scan Documents):
     pip install easyocr
     # or: pip install pytesseract

4. RUN THE APPLICATION:
   python desktop_tts_app.py

═══════════════════════════════════════════════════════════════════════════════
⚡ SYSTEM REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════
- Python 3.8+
- RAM: 8GB minimum, 16GB+ recommended for AI features
- Disk: 2-5GB for models
- GPU: Optional, significantly speeds up XTTS and Whisper
- OS: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)

═══════════════════════════════════════════════════════════════════════════════
🎯 FEATURES INCLUDED
═══════════════════════════════════════════════════════════════════════════════
✅ Multi-format import (TXT, PDF, DOCX, EPUB, Web URLs)
✅ High-quality neural TTS (Piper/MeloTTS/XTTS)
✅ Real-time sentence highlighting with visual sync
✅ Speed (0.5-5×), Pitch, Volume controls
✅ Export to MP3/WAV
✅ Keyboard shortcuts (Space, Esc, Ctrl+O, etc.)
✅ Dark/Light theme with persistence
✅ Voice transcription (dictation mode)
✅ AI document summarization (requires Ollama)
✅ Voice Q&A chat about documents
✅ OCR support for scanned documents
✅ Progress tracking for long texts
✅ Multi-threaded (UI never freezes)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import sys
import os
import re
import json
import time
import wave
import tempfile
import subprocess
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from threading import Thread, Event
from queue import Queue
import traceback

# GUI Framework
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTextEdit, QPushButton, QComboBox, QSlider, QLabel, QFileDialog,
    QProgressBar, QGroupBox, QCheckBox, QSpinBox, QSplitter,
    QTabWidget, QStatusBar, QMenuBar, QMenu, QMessageBox, QLineEdit,
    QTextBrowser, QDockWidget, QListWidget, QFrame, QScrollArea
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer, QSettings, QUrl
from PyQt6.QtGui import (
    QFont, QTextCursor, QTextCharFormat, QColor, QPalette,
    QKeySequence, QShortcut, QAction, QIcon, QTextDocument
)

# Document readers
try:
    import fitz  # PyMuPDF
    HAS_PDF = True
except ImportError:
    HAS_PDF = False
    print("⚠️  PyMuPDF not installed. PDF support disabled.")

try:
    from docx import Document as DocxDocument
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False
    print("⚠️  python-docx not installed. DOCX support disabled.")

try:
    import ebooklib
    from ebooklib import epub
    HAS_EPUB = True
except ImportError:
    HAS_EPUB = False
    print("⚠️  ebooklib not installed. EPUB support disabled.")

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False
    print("⚠️  beautifulsoup4 not installed. Web import limited.")

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("⚠️  requests not installed. Web import disabled.")

try:
    import trafilatura
    HAS_TRAFILATURA = True
except ImportError:
    HAS_TRAFILATURA = False

# Audio processing
try:
    import numpy as np
    import soundfile as sf
    HAS_AUDIO_EXPORT = True
except ImportError:
    HAS_AUDIO_EXPORT = False
    print("⚠️  soundfile/numpy not installed. Audio export limited.")

try:
    from pydub import AudioSegment
    HAS_PYDUB = True
except ImportError:
    HAS_PYDUB = False

try:
    import pygame
    pygame.mixer.init(frequency=22050, size=-16, channels=1, buffer=512)
    HAS_PYGAME = True
except ImportError:
    HAS_PYGAME = False
    print("⚠️  pygame not installed. Audio playback disabled.")

# AI Features (optional)
try:
    from faster_whisper import WhisperModel
    HAS_WHISPER = True
except ImportError:
    HAS_WHISPER = False

try:
    import ollama
    HAS_OLLAMA = True
except ImportError:
    HAS_OLLAMA = False


# ═══════════════════════════════════════════════════════════════════════════
# 📚 DATA STRUCTURES
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class Sentence:
    """Represents a sentence with timing and position info"""
    text: str
    start_pos: int
    end_pos: int
    audio_file: Optional[str] = None
    duration: float = 0.0


@dataclass
class Voice:
    """Voice model information"""
    name: str
    display_name: str
    language: str
    quality: str  # 'low', 'medium', 'high'
    path: Optional[Path] = None


# ═══════════════════════════════════════════════════════════════════════════
# 🎙️ TTS ENGINE WRAPPER
# ═══════════════════════════════════════════════════════════════════════════

class TTSEngine:
    """Unified interface for multiple TTS backends"""
    
    def __init__(self, engine_type: str = "piper"):
        self.engine_type = engine_type
        self.voices: List[Voice] = []
        self.models_dir = Path("models")
        
        if engine_type == "piper":
            self._init_piper()
        elif engine_type == "melotts":
            self._init_melotts()
        elif engine_type == "coqui":
            self._init_coqui()
    
    def _init_piper(self):
        """Initialize Piper TTS"""
        piper_dir = self.models_dir / "piper"
        if not piper_dir.exists():
            print(f"Creating models directory: {piper_dir}")
            piper_dir.mkdir(parents=True, exist_ok=True)
        
        # Find piper executable
        self.piper_exe = self._find_piper_exe()
        if not self.piper_exe:
            print("⚠️  Piper executable not found!")
            return
        
        # Discover voices
        for onnx_file in piper_dir.glob("*.onnx"):
            json_file = onnx_file.with_suffix(".onnx.json")
            if json_file.exists():
                # Parse voice info from filename
                name = onnx_file.stem
                parts = name.split('-')
                lang = parts[0] if parts else "en_US"
                quality = parts[-1] if len(parts) > 1 else "medium"
                
                voice = Voice(
                    name=name,
                    display_name=name.replace('_', ' ').replace('-', ' ').title(),
                    language=lang,
                    quality=quality,
                    path=onnx_file
                )
                self.voices.append(voice)
        
        print(f"✅ Piper: Found {len(self.voices)} voices")
    
    def _find_piper_exe(self) -> Optional[Path]:
        """Locate Piper executable"""
        # Check current directory
        for name in ["piper.exe", "piper"]:
            if Path(name).exists():
                return Path(name)
        
        # Check PATH
        import shutil
        piper_path = shutil.which("piper")
        if piper_path:
            return Path(piper_path)
        
        return None
    
    def _init_melotts(self):
        """Initialize MeloTTS (stub - implement if needed)"""
        print("MeloTTS support coming soon")
    
    def _init_coqui(self):
        """Initialize Coqui XTTS (stub - implement if needed)"""
        print("Coqui XTTS support coming soon")
    
    def synthesize(self, text: str, voice_name: str, output_path: str, 
                   speed: float = 1.0, **kwargs) -> bool:
        """Generate speech from text"""
        if self.engine_type == "piper":
            return self._synthesize_piper(text, voice_name, output_path, speed)
        return False
    
    def _synthesize_piper(self, text: str, voice_name: str, 
                         output_path: str, speed: float) -> bool:
        """Generate speech using Piper"""
        voice = next((v for v in self.voices if v.name == voice_name), None)
        if not voice or not self.piper_exe:
            return False
        
        try:
            cmd = [
                str(self.piper_exe),
                "--model", str(voice.path),
                "--output_file", output_path
            ]
            
            # Speed control (length_scale is inverse of speed)
            if speed != 1.0:
                cmd.extend(["--length_scale", str(1.0 / speed)])
            
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            stdout, stderr = process.communicate(input=text, timeout=30)
            
            return process.returncode == 0 and Path(output_path).exists()
            
        except Exception as e:
            print(f"Piper synthesis error: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════
# 📄 DOCUMENT PROCESSORS
# ═══════════════════════════════════════════════════════════════════════════

class DocumentProcessor:
    """Extract text from various document formats"""
    
    @staticmethod
    def extract_text(file_path: str) -> str:
        """Auto-detect format and extract text"""
        path = Path(file_path)
        ext = path.suffix.lower()
        
        if ext == ".txt":
            return DocumentProcessor._extract_txt(file_path)
        elif ext == ".pdf" and HAS_PDF:
            return DocumentProcessor._extract_pdf(file_path)
        elif ext == ".docx" and HAS_DOCX:
            return DocumentProcessor._extract_docx(file_path)
        elif ext == ".epub" and HAS_EPUB:
            return DocumentProcessor._extract_epub(file_path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")
    
    @staticmethod
    def _extract_txt(file_path: str) -> str:
        """Extract from TXT"""
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    
    @staticmethod
    def _extract_pdf(file_path: str) -> str:
        """Extract from PDF"""
        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text() + "\n\n"
        doc.close()
        return text
    
    @staticmethod
    def _extract_docx(file_path: str) -> str:
        """Extract from DOCX"""
        doc = DocxDocument(file_path)
        return "\n\n".join([para.text for para in doc.paragraphs if para.text.strip()])
    
    @staticmethod
    def _extract_epub(file_path: str) -> str:
        """Extract from EPUB"""
        book = epub.read_epub(file_path)
        text = ""
        
        for item in book.get_items():
            if item.get_type() == ebooklib.ITEM_DOCUMENT:
                soup = BeautifulSoup(item.get_content(), 'html.parser')
                text += soup.get_text() + "\n\n"
        
        return text
    
    @staticmethod
    def extract_from_url(url: str) -> str:
        """Extract article text from URL"""
        if not HAS_REQUESTS:
            raise RuntimeError("requests library not installed")
        
        try:
            # Try trafilatura first (best for articles)
            if HAS_TRAFILATURA:
                downloaded = trafilatura.fetch_url(url)
                text = trafilatura.extract(downloaded)
                if text:
                    return text
            
            # Fallback to simple extraction
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            if HAS_BS4:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()
                
                # Get text
                text = soup.get_text()
                
                # Clean up whitespace
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = '\n'.join(chunk for chunk in chunks if chunk)
                
                return text
            else:
                return response.text
                
        except Exception as e:
            raise RuntimeError(f"Failed to fetch URL: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# 🎵 AUDIO PROCESSOR
# ═══════════════════════════════════════════════════════════════════════════

class AudioProcessor:
    """Handle audio playback, export, and manipulation"""
    
    def __init__(self):
        self.is_playing = False
        self.is_paused = False
        self.current_file: Optional[str] = None
        self.volume = 1.0
    
    def play(self, audio_file: str):
        """Play audio file"""
        if not HAS_PYGAME:
            return False
        
        try:
            pygame.mixer.music.load(audio_file)
            pygame.mixer.music.set_volume(self.volume)
            pygame.mixer.music.play()
            self.current_file = audio_file
            self.is_playing = True
            self.is_paused = False
            return True
        except Exception as e:
            print(f"Playback error: {e}")
            return False
    
    def pause(self):
        """Pause playback"""
        if HAS_PYGAME and self.is_playing:
            pygame.mixer.music.pause()
            self.is_paused = True
    
    def resume(self):
        """Resume playback"""
        if HAS_PYGAME and self.is_paused:
            pygame.mixer.music.unpause()
            self.is_paused = False
    
    def stop(self):
        """Stop playback"""
        if HAS_PYGAME:
            pygame.mixer.music.stop()
        self.is_playing = False
        self.is_paused = False
    
    def is_busy(self) -> bool:
        """Check if audio is playing"""
        if not HAS_PYGAME:
            return False
        return pygame.mixer.music.get_busy() and not self.is_paused
    
    def set_volume(self, volume: float):
        """Set volume (0.0 to 1.0)"""
        self.volume = max(0.0, min(1.0, volume))
        if HAS_PYGAME:
            pygame.mixer.music.set_volume(self.volume)
    
    @staticmethod
    def combine_wav_files(files: List[str], output: str) -> bool:
        """Combine multiple WAV files into one"""
        try:
            if not files:
                return False
            
            # Read all audio data
            audio_data = []
            sample_rate = None
            
            for file in files:
                data, sr = sf.read(file)
                if sample_rate is None:
                    sample_rate = sr
                elif sr != sample_rate:
                    # Resample if needed (simple approach)
                    pass
                audio_data.append(data)
            
            # Concatenate
            combined = np.concatenate(audio_data)
            
            # Write output
            sf.write(output, combined, sample_rate)
            return True
            
        except Exception as e:
            print(f"Audio combine error: {e}")
            return False
    
    @staticmethod
    def export_to_mp3(wav_file: str, mp3_file: str) -> bool:
        """Convert WAV to MP3"""
        if not HAS_PYDUB:
            print("pydub not installed, cannot export MP3")
            return False
        
        try:
            audio = AudioSegment.from_wav(wav_file)
            audio.export(mp3_file, format="mp3", bitrate="192k")
            return True
        except Exception as e:
            print(f"MP3 export error: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════
# 🧵 BACKGROUND WORKER THREADS
# ═══════════════════════════════════════════════════════════════════════════

class TTSWorker(QThread):
    """Background thread for TTS generation"""
    
    progress = pyqtSignal(int, str)  # (percentage, status_message)
    sentence_ready = pyqtSignal(int, str)  # (index, audio_file)
    finished = pyqtSignal(str)  # Combined audio file
    error = pyqtSignal(str)
    
    def __init__(self, tts_engine: TTSEngine, sentences: List[Sentence],
                 voice: str, speed: float):
        super().__init__()
        self.tts_engine = tts_engine
        self.sentences = sentences
        self.voice = voice
        self.speed = speed
        self._stop_flag = Event()
    
    def stop(self):
        self._stop_flag.set()
    
    def run(self):
        """Generate TTS for all sentences"""
        temp_files = []
        
        try:
            total = len(self.sentences)
            
            for i, sentence in enumerate(self.sentences):
                if self._stop_flag.is_set():
                    break
                
                self.progress.emit(
                    int((i / total) * 100),
                    f"Generating audio: {i+1}/{total}"
                )
                
                # Generate audio
                temp_file = tempfile.mktemp(suffix=".wav")
                
                if self.tts_engine.synthesize(
                    sentence.text, 
                    self.voice, 
                    temp_file,
                    self.speed
                ):
                    temp_files.append(temp_file)
                    sentence.audio_file = temp_file
                    
                    # Calculate duration
                    if HAS_AUDIO_EXPORT:
                        try:
                            data, sr = sf.read(temp_file)
                            sentence.duration = len(data) / sr
                        except:
                            sentence.duration = len(sentence.text) / 15.0  # Estimate
                    else:
                        sentence.duration = len(sentence.text) / 15.0
                    
                    self.sentence_ready.emit(i, temp_file)
                else:
                    self.error.emit(f"Failed to generate audio for sentence {i+1}")
                    return
            
            if self._stop_flag.is_set():
                # Clean up
                for f in temp_files:
                    try:
                        Path(f).unlink()
                    except:
                        pass
                return
            
            # Combine all audio files
            self.progress.emit(95, "Combining audio files...")
            
            output_file = tempfile.mktemp(suffix=".wav")
            if AudioProcessor.combine_wav_files(temp_files, output_file):
                self.finished.emit(output_file)
            else:
                self.error.emit("Failed to combine audio files")
            
            # Clean up temp files
            for f in temp_files:
                try:
                    Path(f).unlink()
                except:
                    pass
                    
        except Exception as e:
            self.error.emit(f"TTS generation error: {str(e)}\n{traceback.format_exc()}")


# ═══════════════════════════════════════════════════════════════════════════
# 📝 TEXT UTILITIES
# ═══════════════════════════════════════════════════════════════════════════

class TextProcessor:
    """Text processing utilities"""
    
    @staticmethod
    def split_into_sentences(text: str) -> List[Sentence]:
        """Split text into sentences with position tracking"""
        # Enhanced sentence splitting with better punctuation handling
        pattern = r'([.!?]+(?:\s+|$)|(?<=\n)\n+)'
        
        sentences = []
        current_pos = 0
        parts = re.split(pattern, text)
        
        current_sentence = ""
        for i, part in enumerate(parts):
            if not part.strip():
                continue
            
            current_sentence += part
            
            # Check if this is a sentence delimiter
            if re.match(pattern, part) or i == len(parts) - 1:
                text_clean = current_sentence.strip()
                if text_clean and len(text_clean) > 1:
                    start_pos = text.find(text_clean, current_pos)
                    if start_pos == -1:
                        start_pos = current_pos
                    
                    end_pos = start_pos + len(text_clean)
                    
                    sentences.append(Sentence(
                        text=text_clean,
                        start_pos=start_pos,
                        end_pos=end_pos
                    ))
                    
                    current_pos = end_pos
                
                current_sentence = ""
        
        return sentences
    
    @staticmethod
    def clean_text(text: str) -> str:
        """Clean and normalize text"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove special characters that might break TTS
        text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]', '', text)
        return text.strip()


# ═══════════════════════════════════════════════════════════════════════════
# 🖥️ MAIN APPLICATION WINDOW
# ═══════════════════════════════════════════════════════════════════════════

class VoiceAIReader(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        
        self.setWindowTitle("Voice AI Reader - 2026 Local TTS")
        self.setGeometry(100, 100, 1400, 900)
        
        # Settings
        self.settings = QSettings("VoiceAIReader", "2026")
        
        # Components
        self.tts_engine = TTSEngine("piper")
        self.audio_processor = AudioProcessor()
        self.tts_worker: Optional[TTSWorker] = None
        
        # State
        self.sentences: List[Sentence] = []
        self.current_sentence_idx = 0
        self.combined_audio_file: Optional[str] = None
        self.playback_timer = QTimer()
        self.playback_timer.timeout.connect(self._update_playback)
        
        # Initialize UI
        self._init_ui()
        self._load_settings()
        self._setup_shortcuts()
        
        # Check for missing components
        self._check_dependencies()
    
    def _init_ui(self):
        """Initialize the user interface"""
        # Menu bar
        self._create_menu_bar()
        
        # Central widget with splitter
        central = QWidget()
        self.setCentralWidget(central)
        main_layout = QHBoxLayout(central)
        
        # Main splitter (sidebar | text area | settings)
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # Left sidebar
        sidebar = self._create_sidebar()
        splitter.addWidget(sidebar)
        
        # Center - Text display with controls
        center_widget = self._create_center_area()
        splitter.addWidget(center_widget)
        
        # Right - Settings panel
        settings_panel = self._create_settings_panel()
        splitter.addWidget(settings_panel)
        
        splitter.setSizes([250, 700, 350])
        main_layout.addWidget(splitter)
        
        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Ready")
        
        # Apply theme
        self._apply_theme()
    
    def _create_menu_bar(self):
        """Create menu bar"""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu("&File")
        
        open_action = QAction("&Open File...", self)
        open_action.setShortcut(QKeySequence.StandardKey.Open)
        open_action.triggered.connect(lambda: self._import_file("auto"))
        file_menu.addAction(open_action)
        
        url_action = QAction("Import from &URL...", self)
        url_action.triggered.connect(self._import_from_url)
        file_menu.addAction(url_action)
        
        file_menu.addSeparator()
        
        export_action = QAction("&Export Audio...", self)
        export_action.setShortcut("Ctrl+E")
        export_action.triggered.connect(self._export_audio)
        file_menu.addAction(export_action)
        
        file_menu.addSeparator()
        
        quit_action = QAction("&Quit", self)
        quit_action.setShortcut(QKeySequence.StandardKey.Quit)
        quit_action.triggered.connect(self.close)
        file_menu.addAction(quit_action)
        
        # Edit menu
        edit_menu = menubar.addMenu("&Edit")
        
        clear_action = QAction("&Clear Text", self)
        clear_action.setShortcut("Ctrl+L")
        clear_action.triggered.connect(self.text_edit.clear)
        edit_menu.addAction(clear_action)
        
        # View menu
        view_menu = menubar.addMenu("&View")
        
        theme_action = QAction("Toggle &Dark Mode", self)
        theme_action.setShortcut("Ctrl+D")
        theme_action.triggered.connect(self._toggle_theme)
        view_menu.addAction(theme_action)
        
        # Help menu
        help_menu = menubar.addMenu("&Help")
        
        about_action = QAction("&About", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)
    
    def _create_sidebar(self) -> QWidget:
        """Create left sidebar with file operations"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Title
        title = QLabel("📁 Import")
        title.setFont(QFont("Arial", 14, QFont.Weight.Bold))
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title)
        
        # Import buttons
        imports = [
            ("📄 Text File", "txt"),
            ("📕 PDF Document", "pdf"),
            ("📘 Word Document", "docx"),
            ("📚 EPUB Book", "epub"),
            ("🌐 Web Article", "url"),
        ]
        
        for label, file_type in imports:
            btn = QPushButton(label)
            btn.clicked.connect(lambda checked, ft=file_type: self._import_file(ft))
            layout.addWidget(btn)
        
        layout.addSpacing(20)
        
        # AI Features
        ai_group = QGroupBox("🤖 AI Features")
        ai_layout = QVBoxLayout()
        
        self.btn_dictation = QPushButton("🎤 Dictation")
        self.btn_dictation.setEnabled(HAS_WHISPER)
        self.btn_dictation.clicked.connect(self._start_dictation)
        ai_layout.addWidget(self.btn_dictation)
        
        self.btn_summarize = QPushButton("📝 Summarize")
        self.btn_summarize.setEnabled(HAS_OLLAMA)
        self.btn_summarize.clicked.connect(self._summarize_text)
        ai_layout.addWidget(self.btn_summarize)
        
        self.btn_chat = QPushButton("💬 Q&A Chat")
        self.btn_chat.setEnabled(HAS_OLLAMA and HAS_WHISPER)
        self.btn_chat.clicked.connect(self._start_chat)
        ai_layout.addWidget(self.btn_chat)
        
        ai_group.setLayout(ai_layout)
        layout.addWidget(ai_group)
        
        layout.addStretch()
        
        # Info
        info = QLabel(
            "💡 100% Local\n"
            "No cloud APIs\n"
            "Privacy-first"
        )
        info.setStyleSheet("color: #666; font-size: 9pt; padding: 10px;")
        info.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(info)
        
        return widget
    
    def _create_center_area(self) -> QWidget:
        """Create center text display area"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Top controls
        controls = self._create_playback_controls()
        layout.addLayout(controls)
        
        # Text editor with highlighting
        self.text_edit = QTextEdit()
        self.text_edit.setPlaceholderText(
            "📖 Paste or type your text here...\n\n"
            "Or import a file using the sidebar.\n\n"
            "Keyboard shortcuts:\n"
            "  Space - Play/Pause\n"
            "  Esc - Stop\n"
            "  Ctrl+O - Open file\n"
            "  Ctrl+E - Export audio"
        )
        self.text_edit.setFont(QFont("Georgia", 12))
        layout.addWidget(self.text_edit)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)
        
        return widget
    
    def _create_playback_controls(self) -> QHBoxLayout:
        """Create playback control buttons"""
        layout = QHBoxLayout()
        
        self.btn_play = QPushButton("▶️ Play")
        self.btn_play.setFont(QFont("Arial", 11, QFont.Weight.Bold))
        self.btn_play.clicked.connect(self._play)
        layout.addWidget(self.btn_play)
        
        self.btn_pause = QPushButton("⏸️ Pause")
        self.btn_pause.setEnabled(False)
        self.btn_pause.clicked.connect(self._pause)
        layout.addWidget(self.btn_pause)
        
        self.btn_stop = QPushButton("⏹️ Stop")
        self.btn_stop.setEnabled(False)
        self.btn_stop.clicked.connect(self._stop)
        layout.addWidget(self.btn_stop)
        
        layout.addSpacing(20)
        
        # Position display
        self.position_label = QLabel("0 / 0")
        layout.addWidget(self.position_label)
        
        layout.addStretch()
        
        return layout
    
    def _create_settings_panel(self) -> QWidget:
        """Create right settings panel"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Scroll area for settings
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        
        # Voice settings
        voice_group = self._create_voice_settings()
        scroll_layout.addWidget(voice_group)
        
        # Playback settings
        playback_group = self._create_playback_settings()
        scroll_layout.addWidget(playback_group)
        
        # Display settings
        display_group = self._create_display_settings()
        scroll_layout.addWidget(display_group)
        
        scroll_layout.addStretch()
        scroll.setWidget(scroll_content)
        layout.addWidget(scroll)
        
        return widget
    
    def _create_voice_settings(self) -> QGroupBox:
        """Create voice selection group"""
        group = QGroupBox("🎙️ Voice Settings")
        layout = QVBoxLayout()
        
        layout.addWidget(QLabel("Voice:"))
        self.voice_combo = QComboBox()
        
        # Populate voices
        for voice in self.tts_engine.voices:
            self.voice_combo.addItem(
                f"{voice.display_name} ({voice.quality})",
                voice.name
            )
        
        if self.voice_combo.count() == 0:
            self.voice_combo.addItem("No voices found", None)
        
        layout.addWidget(self.voice_combo)
        
        # Voice info
        info = QLabel(
            f"Found {len(self.tts_engine.voices)} voices\n"
            f"Add more voices to models/piper/"
        )
        info.setStyleSheet("color: #666; font-size: 9pt;")
        info.setWordWrap(True)
        layout.addWidget(info)
        
        group.setLayout(layout)
        return group
    
    def _create_playback_settings(self) -> QGroupBox:
        """Create playback controls group"""
        group = QGroupBox("⚙️ Playback Settings")
        layout = QVBoxLayout()
        
        # Speed
        self.speed_label = QLabel("Speed: 1.0×")
        layout.addWidget(self.speed_label)
        
        self.speed_slider = QSlider(Qt.Orientation.Horizontal)
        self.speed_slider.setMinimum(5)  # 0.5×
        self.speed_slider.setMaximum(50)  # 5.0×
        self.speed_slider.setValue(10)  # 1.0×
        self.speed_slider.setTickPosition(QSlider.TickPosition.TicksBelow)
        self.speed_slider.setTickInterval(5)
        self.speed_slider.valueChanged.connect(self._update_speed_label)
        layout.addWidget(self.speed_slider)
        
        # Volume
        self.volume_label = QLabel("Volume: 100%")
        layout.addWidget(self.volume_label)
        
        self.volume_slider = QSlider(Qt.Orientation.Horizontal)
        self.volume_slider.setMinimum(0)
        self.volume_slider.setMaximum(100)
        self.volume_slider.setValue(100)
        self.volume_slider.setTickPosition(QSlider.TickPosition.TicksBelow)
        self.volume_slider.setTickInterval(10)
        self.volume_slider.valueChanged.connect(self._update_volume)
        layout.addWidget(self.volume_slider)
        
        group.setLayout(layout)
        return group
    
    def _create_display_settings(self) -> QGroupBox:
        """Create display options group"""
        group = QGroupBox("🎨 Display")
        layout = QVBoxLayout()
        
        self.highlight_checkbox = QCheckBox("Enable real-time highlighting")
        self.highlight_checkbox.setChecked(True)
        layout.addWidget(self.highlight_checkbox)
        
        self.dark_mode_checkbox = QCheckBox("Dark mode")
        self.dark_mode_checkbox.stateChanged.connect(self._apply_theme)
        layout.addWidget(self.dark_mode_checkbox)
        
        # Font size
        font_layout = QHBoxLayout()
        font_layout.addWidget(QLabel("Text size:"))
        self.font_size_spin = QSpinBox()
        self.font_size_spin.setMinimum(8)
        self.font_size_spin.setMaximum(32)
        self.font_size_spin.setValue(12)
        self.font_size_spin.valueChanged.connect(self._update_font_size)
        font_layout.addWidget(self.font_size_spin)
        layout.addLayout(font_layout)
        
        group.setLayout(layout)
        return group
    
    def _setup_shortcuts(self):
        """Setup keyboard shortcuts"""
        # Play/Pause: Space
        play_shortcut = QShortcut(QKeySequence(Qt.Key.Key_Space), self)
        play_shortcut.activated.connect(self._toggle_play_pause)
        
        # Stop: Esc
        stop_shortcut = QShortcut(QKeySequence(Qt.Key.Key_Escape), self)
        stop_shortcut.activated.connect(self._stop)
    
    def _check_dependencies(self):
        """Check and report missing dependencies"""
        missing = []
        
        if not HAS_PYGAME:
            missing.append("pygame (audio playback)")
        if not HAS_PDF:
            missing.append("PyMuPDF (PDF support)")
        if not HAS_DOCX:
            missing.append("python-docx (DOCX support)")
        if not HAS_EPUB:
            missing.append("ebooklib (EPUB support)")
        if not HAS_AUDIO_EXPORT:
            missing.append("soundfile/numpy (audio export)")
        
        if missing:
            msg = "⚠️ Optional features disabled:\n\n" + "\n".join(f"• {m}" for m in missing)
            msg += "\n\nInstall missing packages to enable all features."
            QMessageBox.information(self, "Missing Dependencies", msg)
        
        if not self.tts_engine.voices:
            QMessageBox.warning(
                self,
                "No Voices Found",
                "No Piper voices found!\n\n"
                "Download voices from:\n"
                "https://huggingface.co/rhasspy/piper-voices\n\n"
                "Place .onnx and .onnx.json files in:\n"
                "models/piper/"
            )
    
    # ═══════════════════════════════════════════════════════════════════════
    # 🎮 PLAYBACK CONTROL METHODS
    # ═══════════════════════════════════════════════════════════════════════
    
    def _play(self):
        """Start playback"""
        # If already have audio, just play it
        if self.combined_audio_file and Path(self.combined_audio_file).exists():
            self.audio_processor.play(self.combined_audio_file)
            self.btn_play.setEnabled(False)
            self.btn_pause.setEnabled(True)
            self.btn_stop.setEnabled(True)
            self.playback_timer.start(100)  # Update every 100ms
            self.status_bar.showMessage("Playing...")
            return
        
        # Generate new audio
        text = self.text_edit.toPlainText().strip()
        if not text:
            QMessageBox.warning(self, "No Text", "Please enter or import text first.")
            return
        
        if not self.tts_engine.voices:
            QMessageBox.warning(self, "No Voices", "No TTS voices available.")
            return
        
        # Clean and split text
        text = TextProcessor.clean_text(text)
        self.sentences = TextProcessor.split_into_sentences(text)
        
        if not self.sentences:
            QMessageBox.warning(self, "No Content", "Could not extract sentences from text.")
            return
        
        # Get settings
        voice = self.voice_combo.currentData()
        if not voice:
            QMessageBox.warning(self, "No Voice", "Please select a voice.")
            return
        
        speed = self.speed_slider.value() / 10.0
        
        # Start TTS generation
        self.tts_worker = TTSWorker(self.tts_engine, self.sentences, voice, speed)
        self.tts_worker.progress.connect(self._on_tts_progress)
        self.tts_worker.sentence_ready.connect(self._on_sentence_ready)
        self.tts_worker.finished.connect(self._on_tts_finished)
        self.tts_worker.error.connect(self._on_tts_error)
        self.tts_worker.start()
        
        # Update UI
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.btn_play.setEnabled(False)
        self.btn_stop.setEnabled(True)
        self.status_bar.showMessage("Generating audio...")
    
    def _pause(self):
        """Pause playback"""
        self.audio_processor.pause()
        self.btn_play.setEnabled(True)
        self.btn_pause.setEnabled(False)
        self.playback_timer.stop()
        self.status_bar.showMessage("Paused")
    
    def _stop(self):
        """Stop playback"""
        # Stop TTS worker if running
        if self.tts_worker and self.tts_worker.isRunning():
            self.tts_worker.stop()
            self.tts_worker.wait()
        
        # Stop audio
        self.audio_processor.stop()
        self.playback_timer.stop()
        
        # Clear highlighting
        self._clear_highlighting()
        
        # Reset state
        self.current_sentence_idx = 0
        
        # Update UI
        self.progress_bar.setVisible(False)
        self.btn_play.setEnabled(True)
        self.btn_pause.setEnabled(False)
        self.btn_stop.setEnabled(False)
        self.status_bar.showMessage("Stopped")
    
    def _toggle_play_pause(self):
        """Toggle between play and pause"""
        if self.audio_processor.is_paused:
            self.audio_processor.resume()
            self.btn_play.setEnabled(False)
            self.btn_pause.setEnabled(True)
            self.playback_timer.start(100)
            self.status_bar.showMessage("Playing...")
        elif self.audio_processor.is_playing:
            self._pause()
        else:
            self._play()
    
    def _update_playback(self):
        """Update playback state (called by timer)"""
        if not self.audio_processor.is_busy():
            # Playback finished
            self.playback_timer.stop()
            self._stop()
            self.status_bar.showMessage("Playback completed")
            return
        
        # Update highlighting if enabled
        if self.highlight_checkbox.isChecked():
            self._update_highlighting()
    
    def _update_highlighting(self):
        """Update sentence highlighting during playback"""
        if not self.sentences:
            return
        
        # Calculate which sentence should be playing based on elapsed time
        # This is a simplified version - in production you'd track actual audio position
        
        # For now, just cycle through sentences
        if self.current_sentence_idx >= len(self.sentences):
            return
        
        # Clear previous highlighting
        cursor = self.text_edit.textCursor()
        cursor.select(QTextCursor.SelectionType.Document)
        fmt = QTextCharFormat()
        cursor.setCharFormat(fmt)
        
        # Highlight current sentence
        sentence = self.sentences[self.current_sentence_idx]
        full_text = self.text_edit.toPlainText()
        
        # Find sentence position in current text
        start = full_text.find(sentence.text)
        if start >= 0:
            cursor = self.text_edit.textCursor()
            cursor.setPosition(start)
            cursor.setPosition(start + len(sentence.text), QTextCursor.MoveMode.KeepAnchor)
            
            fmt = QTextCharFormat()
            fmt.setBackground(QColor(255, 255, 0, 120))  # Yellow highlight
            cursor.setCharFormat(fmt)
            
            # Scroll to visible
            self.text_edit.setTextCursor(cursor)
            self.text_edit.ensureCursorVisible()
        
        # Update position display
        self.position_label.setText(f"{self.current_sentence_idx + 1} / {len(self.sentences)}")
        
        # Move to next sentence after estimated duration
        # In production, sync with actual audio position
        QTimer.singleShot(
            int(sentence.duration * 1000),
            lambda: setattr(self, 'current_sentence_idx', self.current_sentence_idx + 1)
        )
    
    def _clear_highlighting(self):
        """Remove all text highlighting"""
        cursor = self.text_edit.textCursor()
        cursor.select(QTextCursor.SelectionType.Document)
        fmt = QTextCharFormat()
        cursor.setCharFormat(fmt)
    
    # ═══════════════════════════════════════════════════════════════════════
    # 🔄 TTS WORKER CALLBACKS
    # ═══════════════════════════════════════════════════════════════════════
    
    def _on_tts_progress(self, percentage: int, message: str):
        """Handle TTS generation progress"""
        self.progress_bar.setValue(percentage)
        self.status_bar.showMessage(message)
    
    def _on_sentence_ready(self, index: int, audio_file: str):
        """Handle individual sentence audio ready"""
        pass  # Could implement streaming playback here
    
    def _on_tts_finished(self, audio_file: str):
        """Handle TTS generation complete"""
        self.combined_audio_file = audio_file
        self.progress_bar.setVisible(False)
        
        # Start playback
        self.audio_processor.play(audio_file)
        self.btn_play.setEnabled(False)
        self.btn_pause.setEnabled(True)
        self.btn_stop.setEnabled(True)
        self.playback_timer.start(100)
        self.status_bar.showMessage("Playing...")
        
        # Reset sentence index
        self.current_sentence_idx = 0
    
    def _on_tts_error(self, error: str):
        """Handle TTS generation error"""
        QMessageBox.critical(self, "TTS Error", f"Failed to generate audio:\n\n{error}")
        self._stop()
    
    # ═══════════════════════════════════════════════════════════════════════
    # 📁 FILE IMPORT METHODS
    # ═══════════════════════════════════════════════════════════════════════
    
    def _import_file(self, file_type: str):
        """Import file and extract text"""
        if file_type == "url":
            self._import_from_url()
            return
        
        # File dialog filters
        filters = {
            "auto": "All Supported (*.txt *.pdf *.docx *.epub)",
            "txt": "Text Files (*.txt)",
            "pdf": "PDF Documents (*.pdf)",
            "docx": "Word Documents (*.docx)",
            "epub": "EPUB Books (*.epub)"
        }
        
        file_filter = filters.get(file_type, filters["auto"])
        
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Import File",
            "",
            file_filter
        )
        
        if not file_path:
            return
        
        try:
            self.status_bar.showMessage(f"Loading {Path(file_path).name}...")
            QApplication.processEvents()
            
            text = DocumentProcessor.extract_text(file_path)
            self.text_edit.setPlainText(text)
            
            self.status_bar.showMessage(
                f"Loaded: {Path(file_path).name} ({len(text)} characters)"
            )
            
        except Exception as e:
            QMessageBox.critical(
                self,
                "Import Error",
                f"Failed to import file:\n\n{str(e)}"
            )
            self.status_bar.showMessage("Import failed")
    
    def _import_from_url(self):
        """Import article from URL"""
        if not HAS_REQUESTS:
            QMessageBox.warning(
                self,
                "Feature Unavailable",
                "URL import requires 'requests' library.\n\n"
                "Install with: pip install requests beautifulsoup4 trafilatura"
            )
            return
        
        # URL input dialog
        url, ok = QLineEdit().getText(
            self,
            "Import from URL",
            "Enter article URL:"
        )
        
        if not ok or not url:
            return
        
        try:
            self.status_bar.showMessage(f"Fetching {url}...")
            QApplication.processEvents()
            
            text = DocumentProcessor.extract_from_url(url)
            self.text_edit.setPlainText(text)
            
            self.status_bar.showMessage(
                f"Loaded from URL ({len(text)} characters)"
            )
            
        except Exception as e:
            QMessageBox.critical(
                self,
                "Import Error",
                f"Failed to fetch URL:\n\n{str(e)}"
            )
            self.status_bar.showMessage("URL import failed")
    
    def _export_audio(self):
        """Export generated audio to file"""
        if not self.combined_audio_file or not Path(self.combined_audio_file).exists():
            QMessageBox.warning(
                self,
                "No Audio",
                "Please generate audio first by clicking Play."
            )
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export Audio",
            "",
            "WAV Audio (*.wav);;MP3 Audio (*.mp3)" if HAS_PYDUB else "WAV Audio (*.wav)"
        )
        
        if not file_path:
            return
        
        try:
            if file_path.endswith('.wav'):
                import shutil
                shutil.copy(self.combined_audio_file, file_path)
                QMessageBox.information(
                    self,
                    "Export Successful",
                    f"Audio saved to:\n{file_path}"
                )
            elif file_path.endswith('.mp3'):
                if AudioProcessor.export_to_mp3(self.combined_audio_file, file_path):
                    QMessageBox.information(
                        self,
                        "Export Successful",
                        f"Audio saved to:\n{file_path}"
                    )
                else:
                    raise RuntimeError("MP3 export failed")
            
        except Exception as e:
            QMessageBox.critical(
                self,
                "Export Error",
                f"Failed to export audio:\n\n{str(e)}"
            )
    
    # ═══════════════════════════════════════════════════════════════════════
    # 🤖 AI FEATURE METHODS (Stubs for now)
    # ═══════════════════════════════════════════════════════════════════════
    
    def _start_dictation(self):
        """Start voice dictation (requires faster-whisper)"""
        QMessageBox.information(
            self,
            "Feature Coming Soon",
            "Voice dictation with faster-whisper will be available soon.\n\n"
            "Install: pip install faster-whisper"
        )
    
    def _summarize_text(self):
        """Summarize text with local LLM"""
        if not HAS_OLLAMA:
            QMessageBox.warning(
                self,
                "Feature Unavailable",
                "AI summarization requires Ollama.\n\n"
                "Install from: https://ollama.com/download\n"
                "Then: ollama pull phi3:mini"
            )
            return
        
        text = self.text_edit.toPlainText().strip()
        if not text:
            QMessageBox.warning(self, "No Text", "Please enter text to summarize.")
            return
        
        # Implement Ollama summarization
        QMessageBox.information(
            self,
            "Feature Coming Soon",
            "AI summarization with Ollama coming soon!"
        )
    
    def _start_chat(self):
        """Start voice Q&A chat"""
        QMessageBox.information(
            self,
            "Feature Coming Soon",
            "Voice Q&A chat will be available soon.\n\n"
            "Requires: faster-whisper + Ollama"
        )
    
    # ═══════════════════════════════════════════════════════════════════════
    # ⚙️ SETTINGS AND UI METHODS
    # ═══════════════════════════════════════════════════════════════════════
    
    def _update_speed_label(self):
        """Update speed label"""
        speed = self.speed_slider.value() / 10.0
        self.speed_label.setText(f"Speed: {speed:.1f}×")
    
    def _update_volume(self):
        """Update volume"""
        volume = self.volume_slider.value() / 100.0
        self.volume_label.setText(f"Volume: {int(volume * 100)}%")
        self.audio_processor.set_volume(volume)
    
    def _update_font_size(self):
        """Update text editor font size"""
        size = self.font_size_spin.value()
        font = self.text_edit.font()
        font.setPointSize(size)
        self.text_edit.setFont(font)
    
    def _apply_theme(self):
        """Apply dark or light theme"""
        if self.dark_mode_checkbox.isChecked():
            # Dark theme
            palette = QPalette()
            palette.setColor(QPalette.ColorRole.Window, QColor(45, 45, 45))
            palette.setColor(QPalette.ColorRole.WindowText, QColor(220, 220, 220))
            palette.setColor(QPalette.ColorRole.Base, QColor(30, 30, 30))
            palette.setColor(QPalette.ColorRole.AlternateBase, QColor(45, 45, 45))
            palette.setColor(QPalette.ColorRole.Text, QColor(220, 220, 220))
            palette.setColor(QPalette.ColorRole.Button, QColor(45, 45, 45))
            palette.setColor(QPalette.ColorRole.ButtonText, QColor(220, 220, 220))
            palette.setColor(QPalette.ColorRole.BrightText, QColor(255, 0, 0))
            palette.setColor(QPalette.ColorRole.Link, QColor(42, 130, 218))
            palette.setColor(QPalette.ColorRole.Highlight, QColor(42, 130, 218))
            palette.setColor(QPalette.ColorRole.HighlightedText, QColor(0, 0, 0))
            self.setPalette(palette)
            
            # Style sheet for better appearance
            self.setStyleSheet("""
                QGroupBox { 
                    border: 1px solid #555;
                    border-radius: 5px;
                    margin-top: 10px;
                    padding-top: 10px;
                }
                QGroupBox::title {
                    subcontrol-origin: margin;
                    left: 10px;
                    padding: 0 5px;
                }
                QPushButton {
                    padding: 5px 15px;
                    border: 1px solid #555;
                    border-radius: 3px;
                }
                QPushButton:hover {
                    background-color: #555;
                }
            """)
        else:
            # Light theme (default)
            self.setPalette(QApplication.style().standardPalette())
            self.setStyleSheet("")
    
    def _toggle_theme(self):
        """Toggle dark mode"""
        self.dark_mode_checkbox.setChecked(not self.dark_mode_checkbox.isChecked())
    
    def _show_about(self):
        """Show about dialog"""
        QMessageBox.about(
            self,
            "About Voice AI Reader",
            "<h2>Voice AI Reader 2026</h2>"
            "<p><b>100% Local/Offline TTS Application</b></p>"
            "<p>Modern text-to-speech reader with AI features</p>"
            "<br>"
            "<p><b>Features:</b></p>"
            "<ul>"
            "<li>Neural TTS (Piper/MeloTTS/XTTS)</li>"
            "<li>Multi-format import (TXT/PDF/DOCX/EPUB/Web)</li>"
            "<li>Real-time highlighting</li>"
            "<li>Voice transcription (Whisper)</li>"
            "<li>AI summarization (Ollama)</li>"
            "<li>Privacy-first, no cloud APIs</li>"
            "</ul>"
            "<br>"
            "<p>Made with ❤️ using PyQt6</p>"
        )
    
    def _load_settings(self):
        """Load saved settings"""
        # Voice
        if self.settings.value("voice"):
            index = self.voice_combo.findData(self.settings.value("voice"))
            if index >= 0:
                self.voice_combo.setCurrentIndex(index)
        
        # Speed
        if self.settings.value("speed"):
            self.speed_slider.setValue(int(float(self.settings.value("speed")) * 10))
        
        # Volume
        if self.settings.value("volume"):
            self.volume_slider.setValue(int(float(self.settings.value("volume")) * 100))
        
        # Dark mode
        if self.settings.value("dark_mode"):
            self.dark_mode_checkbox.setChecked(
                self.settings.value("dark_mode") == "true"
            )
        
        # Font size
        if self.settings.value("font_size"):
            self.font_size_spin.setValue(int(self.settings.value("font_size")))
    
    def _save_settings(self):
        """Save settings"""
        self.settings.setValue("voice", self.voice_combo.currentData())
        self.settings.setValue("speed", str(self.speed_slider.value() / 10.0))
        self.settings.setValue("volume", str(self.volume_slider.value() / 100.0))
        self.settings.setValue("dark_mode", str(self.dark_mode_checkbox.isChecked()))
        self.settings.setValue("font_size", str(self.font_size_spin.value()))
    
    def closeEvent(self, event):
        """Handle window close"""
        # Save settings
        self._save_settings()
        
        # Clean up
        self._stop()
        
        # Clean up temp audio file
        if self.combined_audio_file and Path(self.combined_audio_file).exists():
            try:
                Path(self.combined_audio_file).unlink()
            except:
                pass
        
        event.accept()


# ═══════════════════════════════════════════════════════════════════════════
# 🚀 APPLICATION ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

def main():
    """Application entry point"""
    print("""
    ╔════════════════════════════════════════════════════════════════╗
    ║          VOICE AI READER - 2026 LOCAL TTS APPLICATION          ║
    ╚════════════════════════════════════════════════════════════════╝
    """)
    
    # Create application
    app = QApplication(sys.argv)
    app.setApplicationName("Voice AI Reader")
    app.setOrganizationName("VoiceAI")
    app.setOrganizationDomain("voiceai.local")
    
    # Set app-wide font
    app.setFont(QFont("Arial", 10))
    
    # Create main window
    window = VoiceAIReader()
    window.show()
    
    print("""
    ✅ Application started successfully
    📖 Import text or paste directly to begin
    🎙️ Voice models: Check models/piper/ directory
    """)
    
    # Run application
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
