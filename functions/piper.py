import subprocess
from functions.audio import normalize_audio
from config import DEVICE

def piper_process_audio(voice, lang, text, output):
    try:
        command = [
            "piper",
            "--model", voice,
            "--output_file", output
        ]

        if DEVICE == 'cuda':
            command.append('--cuda')

        result = subprocess.run(
            command, 
            input=text, 
            text=True, 
            check=True, 
            encoding='utf-8',
            capture_output=True
        )
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or str(e)
        if 'espeakbridge' in error_msg or 'espeak' in error_msg.lower():
            raise RuntimeError(
                "Piper TTS requires espeak-ng to be installed. "
                "Please install espeak-ng or try using Kokoro engine instead. "
                f"Original error: {error_msg}"
            )
        raise RuntimeError(f"Piper TTS failed: {error_msg}")
    except Exception as e:
        raise RuntimeError(f"Piper TTS error: {str(e)}")

    # Normalize the audio
    normalize_audio(output)