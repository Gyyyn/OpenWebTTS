import wave
from piper import PiperVoice
from functions.audio import normalize_audio
import config


def piper_process_audio(voice, lang, text, output):
    """Synthesize speech with Piper's Python API and normalize the output WAV."""
    piper_voice = PiperVoice.load(voice, use_cuda=(config.DEVICE == 'cuda'))
    with wave.open(output, "wb") as wav_file:
        piper_voice.synthesize_wav(text, wav_file)

    # Normalize the audio
    normalize_audio(output)