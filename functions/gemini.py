import requests
import os

def text_to_speech(api_key, text, voice="echo-alloy"):
    """
    Generates audio from text using the Gemini API.
    """
    API_URL = "https://api.gemini.com/v1/audio/speech"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "tts-1",
        "input": text,
        "voice": voice,
    }

    response = requests.post(API_URL, headers=headers, json=payload)

    if response.status_code == 200:
        return response.content
    else:
        # Handle errors, e.g., log the error message
        print(f"Error from Gemini API: {response.status_code} {response.text}")
        return None

def list_voices():
    """
    Returns a static list of available Gemini voices.
    """
    # As of now, the Gemini API has a fixed set of voices and no API endpoint to list them.
    return [
        {"id": "alloy", "name": "Alloy"},
        {"id": "echo", "name": "Echo"},
        {"id": "fable", "name": "Fable"},
        {"id": "onyx", "name": "Onyx"},
        {"id": "nova", "name": "Nova"},
        {"id": "shimmer", "name": "Shimmer"},
    ]