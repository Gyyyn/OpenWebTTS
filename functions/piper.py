import subprocess
from functions.audio import normalize_audio

def piper_process_audio(voice, lang, text, output):
    
    command = [
        "piper",
        "--model", voice,
        "--output_file", output,
    ]
    subprocess.run(command, input=text, text=True, check=True, encoding='utf-8')

    # Normalize the audio
    normalize_audio(output)