# OpenWebTTS: Local Text-to-Speech Web UI

![GitHub stars](https://img.shields.io/github/stars/Gyyyn/OpenWebTTS)
![GitHub forks](https://img.shields.io/github/forks/Gyyyn/OpenWebTTS)
![License](https://img.shields.io/github/license/Gyyyn/OpenWebTTS)

OpenWebTTS is the open-source, privacy-first alternative to Speechify and ElevenReader. Run it locally, use any TTS engine, and read PDFs, Epubs and other documents without subscriptions or tracking.

<img width="2373" height="1445" alt="image" src="https://github.com/user-attachments/assets/5bcdd59d-f30e-4b56-9b14-a58c1a29ab36" />

## Better than paid alternatives

- **Clean Interface**: Straight to the point and no ads, simple by design, powerful if needed.
- **Accessible Design**: TTS readers help with many disabilities such as dyslexia and ADHD. We welcome neurodivergence and include accessibility options everywhere possible.
- **Multiple Engine Support**: Options for any type of hardware, and even cloud options if wanted.
- **Voice cloning\***: With a simple 10 second `wav` file you can clone any voice to read for you!
- **Import anything**: Most document types are supported, and URLs too!
- **Automatically skip headers and footers\***: Premium feature no more!
- **Automatic OCR\***: If your PDF doesn't have text, we can make some for you.
- **Offline first\***: No connection neeeded.
- **Self-hostable**: Take control of your data, with no feature locked away.

Features marked with an `*` are *paid* on other platforms!

## Running

See `BUILD.md` for detailed instructions. If you know what you're doing: clone the repo, install Python dependencies with a venv and build with `npm`.

## Supported TTS models

| Model | Status | Setup |
| --- | --- | --- |
| **Piper** | Supported | **Recommended:** Use the integrated model downloader.<br>**Manual:** Download a voice model from the [official repository](https://huggingface.co/rhasspy/piper-voices/tree/main) and place the files in `models/piper/` (e.g., `models/piper/en_US-lessac-medium.onnx` and `models/piper/en_US-lessac-medium.onnx.json`). |
| **Kokoro** | Supported | Download a model from the [official repository](https://huggingface.co/hexgrad/Kokoro-82M/tree/main/voices) and place the file in `models/kokoro/` (e.g., `models/kokoro/af_heart.pt`). |
| **Coqui** | Supported | Downloads automatically with Python. Place voice-cloning audio files in `models/coqui/` (e.g., `models/coqui/my-voice.wav`). |
| **Kitten** | Supported | Downloads itself automatically; install it with `pip`. |
| **Google Cloud TTS** | Supported | Requires an authentication key. |
| **Chatterbox** | Planned (WIP) | WIP, sometimes works. |
| **Phonon** | Planned (WIP) | WIP, works with manual setup. |