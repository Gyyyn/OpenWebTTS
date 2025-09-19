export async function generateSpeech(text, engine, voice) {

    if (!text) {
        return;
    }
    if (!voice) {
        alert('Please select a voice.');
        return;
    }

    let apiKey = null;
    if (engine === 'gemini') {
        apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) {
            alert('Please set your Gemini API Key in the Config page.');
            return; // Stop execution if API key is missing
        }
    }

    try {
        
        const requestBody = { engine, voice, text: text.text };
        if (apiKey) { // Only add apiKey if it's present (i.e., for Gemini engine)
            requestBody.api_key = apiKey;
        }

        const response = await fetch('/api/synthesize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to generate speech.');
        }

        const data = await response.json();

        if (data.status === 'generating') {
            // Poll the audio URL until it's ready
            return new Promise((resolve, reject) => {
                const poll = setInterval(async () => {
                    try {
                        const headResponse = await fetch(data.audio_url, { method: 'HEAD' });
                        // We need exactly 200, otherwise we get 206 partial content and skip over text.
                        if (headResponse.status == 200) {
                            clearInterval(poll);
                            resolve(data.audio_url);
                        }
                    } catch (error) {
                        // Network error, keep polling, but log it for debugging
                        console.warn('Polling for audio file, network error:', error);
                    }
                }, 500); // Polling rate
            });
        } else {
            return data.audio_url;
        }

    } catch (error) {
        console.error('Error generating speech:', error);
        alert(`An error occurred: ${error.message}`);
        return null; // Ensure we return null on failure
    }
}