"""
Speechify Desktop Clone - 100% Local/Offline TTS Reader
Modern cross-platform desktop application using PyQt6 and Piper TTS
"""

import sys
import json
import threading
import wave
from pathlib import Path
from typing import Optional, List, Dict
import re

from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTextEdit, QPushButton, QComboBox, QSlider, QLabel, QFileDialog,
    QProgressBar, QTabWidget, QSpinBox, QCheckBox, QGroupBox, QMessageBox,
    QSplitter, QStatusBar
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer, QSettings
from PyQt6.QtGui import QFont, QTextCursor, QTextCharFormat, QColor, QPalette, QIcon

# Document readers
import fitz  # PyMuPDF
from docx import Document
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup

# TTS Engine
import subprocess
import tempfile
import os

# Audio playback
try:
    import pygame
    pygame.mixer.init()
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False
    print("Warning: pygame not available. Install with: pip install pygame")


class PiperTTS:
    """Local Piper TTS engine wrapper"""
    
    def __init__(self, models_dir: str = "models/piper"):
        self.models_dir = Path(models_dir)
        self.voices: Dict[str, Path] = {}
        self.discover_voices()
        
    def discover_voices(self):
        """Scan for available Piper voice models"""
        if not self.models_dir.exists():
            print(f"Models directory not found: {self.models_dir}")
            return
            
        for onnx_file in self.models_dir.glob("*.onnx"):
            json_file = onnx_file.with_suffix(".onnx.json")
            if json_file.exists():
                voice_name = onnx_file.stem
                self.voices[voice_name] = onnx_file
                
        print(f"Found {len(self.voices)} Piper voices: {list(self.voices.keys())}")
    
    def synthesize(self, text: str, voice: str, output_path: str, speed: float = 1.0) -> bool:
        """Generate speech using Piper"""
        if voice not in self.voices:
            print(f"Voice {voice} not found")
            return False
            
        model_path = self.voices[voice]
        
        try:
            # Check for piper executable
            piper_exe = self._find_piper_executable()
            if not piper_exe:
                print("Piper executable not found. Please install Piper.")
                return False
            
            # Piper command: echo "text" | piper -m model.onnx -f output.wav
            cmd = [
                str(piper_exe),
                "--model", str(model_path),
                "--output_file", output_path
            ]
            
            # Add speed control if supported
            if speed != 1.0:
                cmd.extend(["--length_scale", str(1.0 / speed)])
            
            # Run Piper
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            stdout, stderr = process.communicate(input=text)
            
            if process.returncode == 0 and Path(output_path).exists():
                return True
            else:
                print(f"Piper error: {stderr}")
                return False
                
        except Exception as e:
            print(f"TTS synthesis error: {e}")
            return False
    
    def _find_piper_executable(self) -> Optional[Path]:
        """Find Piper executable in common locations"""
        # Check current directory
        if Path("piper.exe").exists():
            return Path("piper.exe")
        if Path("piper").exists():
            return Path("piper")
            
        # Check system PATH
        import shutil
        piper_path = shutil.which("piper")
        if piper_path:
            return Path(piper_path)
            
        return None


class TTSWorker(QThread):
    """Background thread for TTS generation"""
    
    progress = pyqtSignal(int)  # Progress percentage
    finished = pyqtSignal(str)  # Output file path
    error = pyqtSignal(str)  # Error message
    sentence_started = pyqtSignal(int)  # Sentence index
    
    def __init__(self, tts_engine: PiperTTS, text: str, voice: str, speed: float):
        super().__init__()
        self.tts_engine = tts_engine
        self.text = text
        self.voice = voice
        self.speed = speed
        self.sentences = self._split_sentences(text)
        self._stop_requested = False
        
    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        # Simple sentence splitter
        sentences = re.split(r'([.!?]+\s+)', text)
        result = []
        current = ""
        
        for i, part in enumerate(sentences):
            current += part
            if i % 2 == 1:  # Every other part is a delimiter
                if current.strip():
                    result.append(current.strip())
                current = ""
        
        if current.strip():
            result.append(current.strip())
            
        return result if result else [text]
    
    def stop(self):
        self._stop_requested = True
        
    def run(self):
        """Generate TTS for all sentences"""
        temp_files = []
        
        try:
            for i, sentence in enumerate(self.sentences):
                if self._stop_requested:
                    break
                    
                self.sentence_started.emit(i)
                
                # Generate audio for this sentence
                temp_file = tempfile.mktemp(suffix=".wav")
                if self.tts_engine.synthesize(sentence, self.voice, temp_file, self.speed):
                    temp_files.append(temp_file)
                else:
                    self.error.emit(f"Failed to synthesize sentence {i}")
                    return
                
                # Update progress
                progress = int((i + 1) / len(self.sentences) * 100)
                self.progress.emit(progress)
            
            if self._stop_requested:
                # Clean up temp files
                for f in temp_files:
                    try:
                        os.unlink(f)
                    except:
                        pass
                return
            
            # Combine all audio files
            output_path = tempfile.mktemp(suffix=".wav")
            if self._combine_wav_files(temp_files, output_path):
                self.finished.emit(output_path)
            else:
                self.error.emit("Failed to combine audio files")
            
            # Clean up temp files
            for f in temp_files:
                try:
                    os.unlink(f)
                except:
                    pass
                    
        except Exception as e:
            self.error.emit(str(e))
    
    def _combine_wav_files(self, input_files: List[str], output_path: str) -> bool:
        """Combine multiple WAV files into one"""
        try:
            if not input_files:
                return False
                
            # Read first file to get parameters
            with wave.open(input_files[0], 'rb') as first:
                params = first.getparams()
                
            # Write combined file
            with wave.open(output_path, 'wb') as output:
                output.setparams(params)
                
                for input_file in input_files:
                    with wave.open(input_file, 'rb') as infile:
                        output.writeframes(infile.readframes(infile.getnframes()))
            
            return True
            
        except Exception as e:
            print(f"Error combining WAV files: {e}")
            return False


class SpeechifyDesktop(QMainWindow):
    """Main application window"""
    
    def __init__(self):
        super().__init__()
        
        self.setWindowTitle("Speechify Desktop Clone - Local TTS Reader")
        self.setGeometry(100, 100, 1200, 800)
        
        # Settings
        self.settings = QSettings("SpeechifyLocal", "Desktop")
        
        # TTS Engine
        self.tts_engine = PiperTTS()
        self.tts_worker: Optional[TTSWorker] = None
        self.current_audio_file: Optional[str] = None
        self.is_playing = False
        self.is_paused = False
        
        # Sentences for highlighting
        self.sentences: List[str] = []
        self.current_sentence_idx = 0
        
        # Init UI
        self._init_ui()
        self._load_settings()
        
        # Check for audio support
        if not AUDIO_AVAILABLE:
            QMessageBox.warning(
                self, 
                "Audio Not Available",
                "pygame not installed. Audio playback disabled.\nInstall with: pip install pygame"
            )
    
    def _init_ui(self):
        """Initialize the user interface"""
        # Central widget
        central = QWidget()
        self.setCentralWidget(central)
        layout = QVBoxLayout(central)
        
        # Top controls
        controls_layout = self._create_controls()
        layout.addLayout(controls_layout)
        
        # Main splitter (text area and settings)
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # Left: Text area
        text_widget = self._create_text_area()
        splitter.addWidget(text_widget)
        
        # Right: Settings panel
        settings_widget = self._create_settings_panel()
        splitter.addWidget(settings_widget)
        
        splitter.setSizes([800, 400])
        layout.addWidget(splitter)
        
        # Bottom: Progress and status
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)
        
        # Status bar
        self.statusBar().showMessage("Ready")
        
        # Apply theme
        self._apply_theme()
    
    def _create_controls(self) -> QHBoxLayout:
        """Create top control buttons"""
        layout = QHBoxLayout()
        
        # File import buttons
        self.btn_import_txt = QPushButton("📄 Import TXT")
        self.btn_import_txt.clicked.connect(lambda: self._import_file("txt"))
        layout.addWidget(self.btn_import_txt)
        
        self.btn_import_pdf = QPushButton("📕 Import PDF")
        self.btn_import_pdf.clicked.connect(lambda: self._import_file("pdf"))
        layout.addWidget(self.btn_import_pdf)
        
        self.btn_import_docx = QPushButton("📘 Import DOCX")
        self.btn_import_docx.clicked.connect(lambda: self._import_file("docx"))
        layout.addWidget(self.btn_import_docx)
        
        self.btn_import_epub = QPushButton("📚 Import EPUB")
        self.btn_import_epub.clicked.connect(lambda: self._import_file("epub"))
        layout.addWidget(self.btn_import_epub)
        
        layout.addStretch()
        
        # Playback controls
        self.btn_play = QPushButton("▶️ Play")
        self.btn_play.clicked.connect(self._play)
        layout.addWidget(self.btn_play)
        
        self.btn_pause = QPushButton("⏸️ Pause")
        self.btn_pause.clicked.connect(self._pause)
        self.btn_pause.setEnabled(False)
        layout.addWidget(self.btn_pause)
        
        self.btn_stop = QPushButton("⏹️ Stop")
        self.btn_stop.clicked.connect(self._stop)
        self.btn_stop.setEnabled(False)
        layout.addWidget(self.btn_stop)
        
        layout.addStretch()
        
        # Export button
        self.btn_export = QPushButton("💾 Export MP3/WAV")
        self.btn_export.clicked.connect(self._export_audio)
        layout.addWidget(self.btn_export)
        
        return layout
    
    def _create_text_area(self) -> QWidget:
        """Create main text editing area"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        label = QLabel("Text to Read:")
        label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        layout.addWidget(label)
        
        self.text_edit = QTextEdit()
        self.text_edit.setPlaceholderText(
            "Paste or type your text here...\n\n"
            "Or import a file using the buttons above.\n"
            "Supports: TXT, PDF, DOCX, EPUB"
        )
        self.text_edit.setFont(QFont("Arial", 11))
        layout.addWidget(self.text_edit)
        
        return widget
    
    def _create_settings_panel(self) -> QWidget:
        """Create settings panel"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Voice selection
        voice_group = QGroupBox("Voice Settings")
        voice_layout = QVBoxLayout()
        
        voice_layout.addWidget(QLabel("Voice:"))
        self.voice_combo = QComboBox()
        self.voice_combo.addItems(list(self.tts_engine.voices.keys()))
        if self.tts_engine.voices:
            self.voice_combo.setCurrentIndex(0)
        voice_layout.addWidget(self.voice_combo)
        
        voice_group.setLayout(voice_layout)
        layout.addWidget(voice_group)
        
        # Speed control
        speed_group = QGroupBox("Speed Control")
        speed_layout = QVBoxLayout()
        
        self.speed_label = QLabel("Speed: 1.0×")
        speed_layout.addWidget(self.speed_label)
        
        self.speed_slider = QSlider(Qt.Orientation.Horizontal)
        self.speed_slider.setMinimum(5)  # 0.5×
        self.speed_slider.setMaximum(40)  # 4.0×
        self.speed_slider.setValue(10)  # 1.0×
        self.speed_slider.setTickPosition(QSlider.TickPosition.TicksBelow)
        self.speed_slider.setTickInterval(5)
        self.speed_slider.valueChanged.connect(self._update_speed_label)
        speed_layout.addWidget(self.speed_slider)
        
        speed_group.setLayout(speed_layout)
        layout.addWidget(speed_group)
        
        # Highlighting options
        highlight_group = QGroupBox("Highlighting")
        highlight_layout = QVBoxLayout()
        
        self.highlight_checkbox = QCheckBox("Enable real-time highlighting")
        self.highlight_checkbox.setChecked(True)
        highlight_layout.addWidget(self.highlight_checkbox)
        
        highlight_group.setLayout(highlight_layout)
        layout.addWidget(highlight_group)
        
        # Theme
        theme_group = QGroupBox("Appearance")
        theme_layout = QVBoxLayout()
        
        self.dark_mode_checkbox = QCheckBox("Dark Mode")
        self.dark_mode_checkbox.setChecked(False)
        self.dark_mode_checkbox.stateChanged.connect(self._apply_theme)
        theme_layout.addWidget(self.dark_mode_checkbox)
        
        theme_group.setLayout(theme_layout)
        layout.addWidget(theme_group)
        
        layout.addStretch()
        
        # Info
        info_label = QLabel(
            "💡 100% Local/Offline\n"
            "Uses Piper TTS\n"
            "No cloud API calls"
        )
        info_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        info_label.setStyleSheet("color: #666; font-size: 10px;")
        layout.addWidget(info_label)
        
        return widget
    
    def _update_speed_label(self):
        """Update speed label when slider changes"""
        speed = self.speed_slider.value() / 10.0
        self.speed_label.setText(f"Speed: {speed:.1f}×")
    
    def _apply_theme(self):
        """Apply dark or light theme"""
        if self.dark_mode_checkbox.isChecked():
            # Dark theme
            palette = QPalette()
            palette.setColor(QPalette.ColorRole.Window, QColor(53, 53, 53))
            palette.setColor(QPalette.ColorRole.WindowText, Qt.GlobalColor.white)
            palette.setColor(QPalette.ColorRole.Base, QColor(25, 25, 25))
            palette.setColor(QPalette.ColorRole.AlternateBase, QColor(53, 53, 53))
            palette.setColor(QPalette.ColorRole.Text, Qt.GlobalColor.white)
            palette.setColor(QPalette.ColorRole.Button, QColor(53, 53, 53))
            palette.setColor(QPalette.ColorRole.ButtonText, Qt.GlobalColor.white)
            palette.setColor(QPalette.ColorRole.BrightText, Qt.GlobalColor.red)
            palette.setColor(QPalette.ColorRole.Link, QColor(42, 130, 218))
            palette.setColor(QPalette.ColorRole.Highlight, QColor(42, 130, 218))
            palette.setColor(QPalette.ColorRole.HighlightedText, Qt.GlobalColor.black)
            self.setPalette(palette)
        else:
            # Light theme (default)
            self.setPalette(QApplication.style().standardPalette())
    
    def _import_file(self, file_type: str):
        """Import file and extract text"""
        if file_type == "txt":
            file_path, _ = QFileDialog.getOpenFileName(
                self, "Import TXT File", "", "Text Files (*.txt)"
            )
            if file_path:
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
                self.text_edit.setPlainText(text)
                self.statusBar().showMessage(f"Loaded: {Path(file_path).name}")
        
        elif file_type == "pdf":
            file_path, _ = QFileDialog.getOpenFileName(
                self, "Import PDF File", "", "PDF Files (*.pdf)"
            )
            if file_path:
                text = self._extract_pdf_text(file_path)
                self.text_edit.setPlainText(text)
                self.statusBar().showMessage(f"Loaded: {Path(file_path).name}")
        
        elif file_type == "docx":
            file_path, _ = QFileDialog.getOpenFileName(
                self, "Import DOCX File", "", "Word Files (*.docx)"
            )
            if file_path:
                text = self._extract_docx_text(file_path)
                self.text_edit.setPlainText(text)
                self.statusBar().showMessage(f"Loaded: {Path(file_path).name}")
        
        elif file_type == "epub":
            file_path, _ = QFileDialog.getOpenFileName(
                self, "Import EPUB File", "", "EPUB Files (*.epub)"
            )
            if file_path:
                text = self._extract_epub_text(file_path)
                self.text_edit.setPlainText(text)
                self.statusBar().showMessage(f"Loaded: {Path(file_path).name}")
    
    def _extract_pdf_text(self, file_path: str) -> str:
        """Extract text from PDF"""
        try:
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to read PDF: {e}")
            return ""
    
    def _extract_docx_text(self, file_path: str) -> str:
        """Extract text from DOCX"""
        try:
            doc = Document(file_path)
            text = "\n".join([para.text for para in doc.paragraphs])
            return text
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to read DOCX: {e}")
            return ""
    
    def _extract_epub_text(self, file_path: str) -> str:
        """Extract text from EPUB"""
        try:
            book = epub.read_epub(file_path)
            text = ""
            
            for item in book.get_items():
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    soup = BeautifulSoup(item.get_content(), 'html.parser')
                    text += soup.get_text() + "\n\n"
            
            return text
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to read EPUB: {e}")
            return ""
    
    def _play(self):
        """Start or resume playback"""
        if self.is_paused:
            # Resume playback
            if AUDIO_AVAILABLE and pygame.mixer.music.get_busy() == 0:
                pygame.mixer.music.unpause()
            self.is_paused = False
            self.btn_play.setEnabled(False)
            self.btn_pause.setEnabled(True)
            self.btn_stop.setEnabled(True)
            self.statusBar().showMessage("Resumed")
            return
        
        # Start new playback
        text = self.text_edit.toPlainText().strip()
        if not text:
            QMessageBox.warning(self, "No Text", "Please enter or import text first.")
            return
        
        if not self.tts_engine.voices:
            QMessageBox.warning(self, "No Voices", "No Piper voices found. Please install voice models.")
            return
        
        # Get settings
        voice = self.voice_combo.currentText()
        speed = self.speed_slider.value() / 10.0
        
        # Split into sentences for highlighting
        self.sentences = self._split_text_into_sentences(text)
        self.current_sentence_idx = 0
        
        # Start TTS generation in background
        self.tts_worker = TTSWorker(self.tts_engine, text, voice, speed)
        self.tts_worker.progress.connect(self._on_tts_progress)
        self.tts_worker.finished.connect(self._on_tts_finished)
        self.tts_worker.error.connect(self._on_tts_error)
        self.tts_worker.sentence_started.connect(self._on_sentence_started)
        self.tts_worker.start()
        
        # Update UI
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.btn_play.setEnabled(False)
        self.btn_pause.setEnabled(False)
        self.btn_stop.setEnabled(True)
        self.statusBar().showMessage("Generating speech...")
        self.is_playing = True
    
    def _pause(self):
        """Pause playback"""
        if AUDIO_AVAILABLE:
            pygame.mixer.music.pause()
        self.is_paused = True
        self.btn_play.setEnabled(True)
        self.btn_pause.setEnabled(False)
        self.statusBar().showMessage("Paused")
    
    def _stop(self):
        """Stop playback"""
        # Stop TTS worker if running
        if self.tts_worker and self.tts_worker.isRunning():
            self.tts_worker.stop()
            self.tts_worker.wait()
        
        # Stop audio playback
        if AUDIO_AVAILABLE:
            pygame.mixer.music.stop()
        
        # Clean up
        if self.current_audio_file and Path(self.current_audio_file).exists():
            try:
                os.unlink(self.current_audio_file)
            except:
                pass
        
        self.current_audio_file = None
        self.is_playing = False
        self.is_paused = False
        
        # Clear highlighting
        self._clear_highlighting()
        
        # Update UI
        self.progress_bar.setVisible(False)
        self.btn_play.setEnabled(True)
        self.btn_pause.setEnabled(False)
        self.btn_stop.setEnabled(False)
        self.statusBar().showMessage("Stopped")
    
    def _on_tts_progress(self, value: int):
        """Update progress bar"""
        self.progress_bar.setValue(value)
    
    def _on_tts_finished(self, audio_file: str):
        """TTS generation complete, start playback"""
        self.current_audio_file = audio_file
        self.progress_bar.setVisible(False)
        
        if AUDIO_AVAILABLE:
            try:
                pygame.mixer.music.load(audio_file)
                pygame.mixer.music.play()
                
                self.btn_pause.setEnabled(True)
                self.statusBar().showMessage("Playing...")
                
                # Start highlighting timer
                if self.highlight_checkbox.isChecked():
                    self._start_highlighting()
                
            except Exception as e:
                QMessageBox.critical(self, "Playback Error", f"Failed to play audio: {e}")
                self._stop()
        else:
            QMessageBox.information(
                self, 
                "Audio Generated", 
                f"Audio file generated: {audio_file}\n\nInstall pygame for playback."
            )
            self._stop()
    
    def _on_tts_error(self, error_msg: str):
        """Handle TTS error"""
        QMessageBox.critical(self, "TTS Error", f"Failed to generate speech:\n{error_msg}")
        self._stop()
    
    def _on_sentence_started(self, index: int):
        """Highlight sentence being generated"""
        self.current_sentence_idx = index
    
    def _split_text_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences"""
        sentences = re.split(r'([.!?]+\s+)', text)
        result = []
        current = ""
        
        for i, part in enumerate(sentences):
            current += part
            if i % 2 == 1:
                if current.strip():
                    result.append(current.strip())
                current = ""
        
        if current.strip():
            result.append(current.strip())
            
        return result if result else [text]
    
    def _start_highlighting(self):
        """Start real-time highlighting during playback"""
        # This is a simplified version - in production you'd sync with actual audio timing
        if not self.sentences:
            return
        
        self.current_sentence_idx = 0
        self._highlight_timer = QTimer()
        self._highlight_timer.timeout.connect(self._update_highlighting)
        
        # Calculate approximate time per sentence
        total_chars = sum(len(s) for s in self.sentences)
        speed = self.speed_slider.value() / 10.0
        # Rough estimate: 150 words per minute at 1× speed
        chars_per_minute = 750 * speed
        interval_ms = int((len(self.sentences[0]) / chars_per_minute) * 60000)
        
        self._highlight_timer.start(max(1000, interval_ms))
    
    def _update_highlighting(self):
        """Update which sentence is highlighted"""
        if not AUDIO_AVAILABLE or not pygame.mixer.music.get_busy():
            if self._highlight_timer:
                self._highlight_timer.stop()
            self._clear_highlighting()
            self._stop()
            return
        
        if self.current_sentence_idx >= len(self.sentences):
            if self._highlight_timer:
                self._highlight_timer.stop()
            return
        
        # Clear previous highlighting
        cursor = self.text_edit.textCursor()
        cursor.select(QTextCursor.SelectionType.Document)
        fmt = QTextCharFormat()
        cursor.setCharFormat(fmt)
        
        # Highlight current sentence
        text = self.text_edit.toPlainText()
        sentence = self.sentences[self.current_sentence_idx]
        start = text.find(sentence)
        
        if start >= 0:
            cursor = self.text_edit.textCursor()
            cursor.setPosition(start)
            cursor.setPosition(start + len(sentence), QTextCursor.MoveMode.KeepAnchor)
            
            fmt = QTextCharFormat()
            fmt.setBackground(QColor(255, 255, 0, 100))  # Yellow highlight
            cursor.setCharFormat(fmt)
            
            # Scroll to current sentence
            self.text_edit.setTextCursor(cursor)
            self.text_edit.ensureCursorVisible()
        
        self.current_sentence_idx += 1
    
    def _clear_highlighting(self):
        """Remove all highlighting"""
        cursor = self.text_edit.textCursor()
        cursor.select(QTextCursor.SelectionType.Document)
        fmt = QTextCharFormat()
        cursor.setCharFormat(fmt)
    
    def _export_audio(self):
        """Export generated audio to file"""
        if not self.current_audio_file or not Path(self.current_audio_file).exists():
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
            "WAV Audio (*.wav);;MP3 Audio (*.mp3)"
        )
        
        if file_path:
            try:
                import shutil
                if file_path.endswith('.wav'):
                    shutil.copy(self.current_audio_file, file_path)
                elif file_path.endswith('.mp3'):
                    # Convert WAV to MP3 (requires ffmpeg)
                    try:
                        subprocess.run([
                            'ffmpeg', '-i', self.current_audio_file,
                            '-codec:a', 'libmp3lame', '-qscale:a', '2',
                            file_path
                        ], check=True)
                    except:
                        QMessageBox.warning(
                            self,
                            "MP3 Conversion Failed",
                            "ffmpeg not found. Saving as WAV instead."
                        )
                        file_path = file_path.replace('.mp3', '.wav')
                        shutil.copy(self.current_audio_file, file_path)
                
                QMessageBox.information(
                    self,
                    "Export Successful",
                    f"Audio saved to:\n{file_path}"
                )
                
            except Exception as e:
                QMessageBox.critical(
                    self,
                    "Export Failed",
                    f"Failed to export audio:\n{e}"
                )
    
    def _load_settings(self):
        """Load saved settings"""
        if self.settings.value("voice"):
            index = self.voice_combo.findText(self.settings.value("voice"))
            if index >= 0:
                self.voice_combo.setCurrentIndex(index)
        
        if self.settings.value("speed"):
            self.speed_slider.setValue(int(float(self.settings.value("speed")) * 10))
        
        if self.settings.value("dark_mode"):
            self.dark_mode_checkbox.setChecked(
                self.settings.value("dark_mode") == "true"
            )
    
    def closeEvent(self, event):
        """Save settings on close"""
        self.settings.setValue("voice", self.voice_combo.currentText())
        self.settings.setValue("speed", str(self.speed_slider.value() / 10.0))
        self.settings.setValue("dark_mode", str(self.dark_mode_checkbox.isChecked()))
        
        # Clean up
        self._stop()
        
        event.accept()


def main():
    """Application entry point"""
    app = QApplication(sys.argv)
    app.setApplicationName("Speechify Desktop Clone")
    app.setOrganizationName("SpeechifyLocal")
    
    # Set app-wide font
    font = QFont("Arial", 10)
    app.setFont(font)
    
    window = SpeechifyDesktop()
    window.show()
    
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
