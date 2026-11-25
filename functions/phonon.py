import ptts
from functions.audio import normalize_audio
import config

def phonon_process_audio(voice, lang, text, output):
    tts = ptts.TTS("hf://gradium/phonon-40m-multilingual", lang=lang, quant="q8")
    tts.save(output, text, voice=voice)

    # Normalize the audio
    normalize_audio(output)