import os
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


def transcode_wav_to_mp3(wav_path: str, mp3_path: str, bitrate: str = "96k") -> float:
    """Transcode a WAV file to MP3 using pydub/ffmpeg and return duration in seconds."""
    sound = AudioSegment.from_file(wav_path, format="wav")
    duration_sec = round(len(sound) / 1000.0, 2)
    os.makedirs(os.path.dirname(mp3_path), exist_ok=True)
    tmp_mp3 = f"{mp3_path}.tmp.mp3"
    try:
        sound.export(tmp_mp3, format="mp3", bitrate=bitrate)
        os.replace(tmp_mp3, mp3_path)
        return duration_sec
    except Exception:
        if os.path.exists(tmp_mp3):
            try:
                os.unlink(tmp_mp3)
            except OSError:
                pass
        raise