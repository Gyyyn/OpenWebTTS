from kokoro import KPipeline
import soundfile as sf
import torch

def kokoro_process_audio(voice, lang, text, output):

    # If we don't have a set lang, the first letter of the voice name will tell us.
    if lang == False:
        lang = voice[0]
    
    pipeline = KPipeline(lang)
    generator = pipeline(text, voice)

    for i, (gs, ps, audio) in enumerate(generator):
        sf.write(f'{output}', audio, 24000)
