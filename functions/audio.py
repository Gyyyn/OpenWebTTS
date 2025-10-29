from pydub import AudioSegment, effects

def normalize_audio(path):
    rawsound = AudioSegment.from_file(f'{path}', "wav")
    normalizedsound = effects.compress_dynamic_range(rawsound)
    normalizedsound = effects.normalize(rawsound)
    normalizedsound.export(f'{path}', format="wav")