import warnings
import os
# Suppress torch warnings
warnings.filterwarnings('ignore', category=UserWarning, module='torch.nn.modules.rnn')
warnings.filterwarnings('ignore', category=FutureWarning, module='torch.nn.utils.weight_norm')
# Suppress HuggingFace Hub warnings
warnings.filterwarnings('ignore', message='.*HF_TOKEN.*')

# Set HF_HUB_DISABLE_TELEMETRY to suppress additional warnings
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
# Set a dummy token or use offline mode to suppress authentication warnings
if not os.environ.get('HF_TOKEN'):
    os.environ['HF_HUB_OFFLINE'] = '1'

from kokoro import KPipeline
import soundfile as sf
import torch
from functions.audio import normalize_audio
from config import DEVICE

def kokoro_process_audio(voice, lang, text, output):

    # If we don't have a set lang, the first letter of the voice name will tell us.
    if lang == False:
        lang = voice[0]
    
    # Explicitly pass repo_id to suppress warning
    pipeline = KPipeline(lang, device=DEVICE, repo_id='hexgrad/Kokoro-82M')
    generator = pipeline(text, voice)

    for i, (gs, ps, audio) in enumerate(generator):
        sf.write(f'{output}', audio, 24000)

    # Normalize the audio
    normalize_audio(output)