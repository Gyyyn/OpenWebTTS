from kittentts import KittenTTS
import soundfile as sf

def kitten_process_audio(voice, lang, text, output):
    m = KittenTTS("KittenML/kitten-tts-nano-0.2")
    audio = m.generate(text, voice)

    # Save the audio
    sf.write(output, audio, 24000)
