# -*- coding: utf-8 -*-

"""
This script provides a simple function to convert text to speech using
the Google Cloud Text-to-Speech API. It's configured to use a
high-quality, formal-sounding WaveNet voice, ideal for reading articles and books.
"""

import os
import traceback
from google.cloud import texttospeech

def gemini_process_audio(text: str, output_filename: str, voice: str = "en-US-Wavenet-D", lang: str = "en-US", credentials_json_path: str = None):
    """
    Synthesizes speech from the input string of text.

    This function uses the Google Cloud Text-to-Speech API to convert the provided
    text into an audio file. Authentication can be handled in two ways:
    1. By passing the path to a service account JSON file via `credentials_json_path`.
    2. By setting the GOOGLE_APPLICATION_CREDENTIALS environment variable (ADC).

    Args:
        text (str): The text to be synthesized.
        output_filename (str): The desired name for the output audio file.
                               Defaults to "output.mp3".
        credentials_json_path (str, optional): Path to the Google Cloud service
                                               account JSON file. Defaults to None.

    Returns:
        bool: True if synthesis was successful, False otherwise.
    """
    try:
        # Instantiates a client
        if credentials_json_path:
            # Explicitly use the provided JSON key file
            from google.oauth2 import service_account
            credentials = service_account.Credentials.from_service_account_file(credentials_json_path)
            client = texttospeech.TextToSpeechClient(credentials=credentials)
        else:
            # Use Application Default Credentials (e.g., environment variable)
            client = texttospeech.TextToSpeechClient()

        # Set the text input to be synthesized
        synthesis_input = texttospeech.SynthesisInput(text=text)

        # "en-US-Wavenet-D" is a formal and clear male voice suitable for narration.
        voice_params = texttospeech.VoiceSelectionParams(
            language_code=lang, name=voice
        )
        
        # Detect if a premium voice model is needed.
        # Voices containing "Studio", "News", or "Polyglot" often require this.
        model_name = None
        if "Studio" in voice or "News" in voice or "Polyglot" in voice:
            model_name = "gemini-1.0-pro"
            print(f"Detected a premium voice ('{voice}'). Using model: '{model_name}'")
            
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                model=model_name
            )
        else:
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3
            )

        # Perform the text-to-speech request on the text input with the selected
        # voice parameters and audio file type
        response = client.synthesize_speech(
            input=synthesis_input, voice=voice_params, audio_config=audio_config
        )

        # The response's audio_content is binary.
        with open(output_filename, "wb") as out:
            # Write the response to the output file.
            out.write(response.audio_content)
        
        return True

    except Exception as e:
        print(f"An error occurred during audio synthesis: {e}")
        traceback.print_exc()
        print("Please ensure your Google Cloud credentials are set up correctly.")
        return False

def gemini_list_voices(credentials_json_path: str = None):
    """
    Lists the available voices from the Google Cloud TTS API.

    Authentication is handled similarly to the synthesis function.

    Args:
        credentials_json_path (str, optional): Path to the Google Cloud service
                                               account JSON file. Defaults to None.

    Returns:
        list: A list of voice objects. Returns an empty list on failure.
    """
    try:
        # Instantiates a client
        if credentials_json_path:
            from google.oauth2 import service_account
            credentials = service_account.Credentials.from_service_account_file(credentials_json_path)
            client = texttospeech.TextToSpeechClient(credentials=credentials)
        else:
            client = texttospeech.TextToSpeechClient()

        # Performs the list voices request
        response = client.list_voices()
        return response.voices

    except Exception as e:
        print(f"An error occurred while listing voices: {e}")
        traceback.print_exc()
        print("This error usually means authentication failed. Check credentials and API permissions.")
        return []

