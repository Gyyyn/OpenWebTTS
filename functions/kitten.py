from kittentts import KittenTTS
import soundfile as sf
from functions.audio import normalize_audio
from config import DEVICE

# Kitten has "mini" and "nano" variants.
def kitten_process_audio(voice, lang, text, output):
    m = KittenTTS("KittenML/kitten-tts-nano-0.2")
    audio = m.generate(text, voice)

    # Save the audio
    sf.write(output, audio, 24000)
    # Normalize the audio
    normalize_audio(output)
