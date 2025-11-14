import subprocess
from functions.audio import normalize_audio
from config import DEVICE

def piper_process_audio(voice, lang, text, output):
    
    command = [
        "piper",
        "--model", voice,
        "--output_file", output
    ]

    if DEVICE == 'cuda':
        command.append('--cuda')

    subprocess.run(command, input=text, text=True, check=True, encoding='utf-8')

    # Normalize the audio
    normalize_audio(output)