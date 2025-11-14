/**
 * Call the API to generate a chunk of text using a selected TTS engine and voice.
 * It is recommended to be careful with this function and audio chunking, as it is
 * async, and it's easy to mess up the audio queue.
 * @param {string} textChunk Text to generate.
 * @param {string} [lang] ISO language code.
 * @param {string} engine Available engines: gemini, piper, kokoro, kitten, coqui.
 * @param {string} voice This must be previously adquired from the API.
 * @returns 
 */
export async function generateSpeech(textChunk, lang='en', engine, voice) {

    if (!textChunk) return false;
    if (!voice) return false;

    let apiKey = null;
    if (engine === 'gemini') {
        apiKey = localStorage.getItem('geminiApiKey');
        if (!apiKey) return false
    }

    try {
        const requestBody = { engine, lang, voice, text: textChunk };

        console.debug('Generating request: ', requestBody);        

        if (apiKey) requestBody.api_key = apiKey;

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
                }, 2000); // Polling rate
            });
        } else {
            return data.audio_url;
        }

    } catch (error) {
        console.error('Error generating speech:', error);
        return false;
    }
}