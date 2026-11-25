import shutil
from pydub import AudioSegment, effects

if not shutil.which("ffmpeg"):
    try:
        import imageio_ffmpeg
        AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass


def normalize_audio(path):
    rawsound = AudioSegment.from_file(f'{path}', "wav")
    normalizedsound = effects.compress_dynamic_range(rawsound)
    normalizedsound = effects.normalize(normalizedsound)
    normalizedsound.export(f'{path}', format="wav")