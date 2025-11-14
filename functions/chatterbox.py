import torch
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
from functions.audio import normalize_audio
from config import DEVICE

def chatterbox_process_audio(voice, lang, text, output):

    # Clear CUDA cache
    torch.cuda.empty_cache()

    model = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE)
    wav = model.generate(text, language_id=lang, audio_prompt_path=voice)

    ta.save(output, wav, model.sr)

    # Save the audio
    sf.write(output, audio, 24000)
    # Normalize the audio
    normalize_audio(output)