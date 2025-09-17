const backButton = document.getElementById('back');
const clearCacheButton = document.getElementById('clear-cache');

backButton.addEventListener('click', () => {
    window.history.back();
});

document.addEventListener('DOMContentLoaded', () => {
    const piperVoiceSelect = document.getElementById('piper-voice');
    const kokoroVoiceSelect = document.getElementById('kokoro-voice');
    const downloadBtnPiper = document.getElementById('download-btn-piper');
    const downloadBtnKokoro = document.getElementById('download-btn-kokoro');
    const cacheSizeDisplay = document.getElementById('cache-size-display');
    const chunkSizeSlider = document.getElementById('chunk-size-slider');
    const chunkSizeDisplay = document.getElementById('chunk-size-display');

    const downloadStatus = document.getElementById('download-status');
    const googleVoiceInput = document.getElementById('google-voice');
    const GEMINI_API_KEY_STORAGE_KEY = 'geminiApiKey';

    // Load saved API key on page load
    if (localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY)) {
        googleVoiceInput.value = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
    }

    // Save API key on input change
    googleVoiceInput.addEventListener('input', () => {
        localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, googleVoiceInput.value);
    });

    async function getPiperVoices() {
        try {
            const response = await fetch('/api/piper_voices');
            if (!response.ok) {
                throw new Error('Failed to fetch Piper voices.');
            }
            const voices = await response.json();
            piperVoiceSelect.innerHTML = '';
            for (const key in voices) {
                const voice = voices[key];
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `${voice.name} (${voice.language.name_native}) - ${voice.quality}`;
                piperVoiceSelect.appendChild(option);
            }
        } catch (error) {
            console.error('Error fetching Piper voices:', error);
            piperVoiceSelect.innerHTML = '<option value="">-- Error loading voices --</option>';
        }
    }

    async function downloadPiperVoice() {
        const voiceKey = piperVoiceSelect.value;
        if (!voiceKey) {
            alert('Please select a voice to download.');
            return;
        }        

        downloadBtnPiper.disabled = true;
        downloadStatus.textContent = 'Downloading...';

        // Build URL to send.

        const voiceKeySplit = voiceKey.split("-");

        const voiceDetails = {
            langCode: voiceKeySplit[0].split("_")[0],
            langCodeFull: voiceKeySplit[0],
            voiceName: voiceKeySplit[1],
            voiceQuality: voiceKeySplit[2]
        }

        // Example URL
        // https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/amy/medium
        const voiceDownloadURL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/" +
            voiceDetails.langCode + "/" + voiceDetails.langCodeFull + "/" +
            voiceDetails.voiceName + "/" + voiceDetails.voiceQuality + "/" +
            voiceKey + '.onnx';

        try {
            const response = await fetch('/api/download_piper_voice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ URL: voiceDownloadURL, key: voiceKey }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to download voice.');
            }

            const data = await response.json();
            downloadStatus.textContent = data.message;
        } catch (error) {
            console.error('Error downloading voice:', error);
            downloadStatus.textContent = `An error occurred: ${error.message}`;
        } finally {
            downloadBtnPiper.disabled = false;
        }
    }

    async function downloadKokoroVoice() {

        // Example URL: https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/voices/af_heart.pt
        const voiceDownloadURL = kokoroVoiceSelect.value;
        const voiceKey = voiceDownloadURL.split('voices/')[1];
        if (!voiceDownloadURL) {
            alert('Please select a voice to download.');
            return;
        }        

        downloadBtnKokoro.disabled = true;
        downloadStatus.textContent = 'Downloading...';

        try {
            const response = await fetch('/api/download_kokoro_voice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ URL: voiceDownloadURL, key: voiceKey }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to download voice.');
            }

            const data = await response.json();
            downloadStatus.textContent = data.message;
        } catch (error) {
            console.error('Error downloading voice:', error);
            downloadStatus.textContent = `An error occurred: ${error.message}`;
        } finally {
            downloadBtnKokoro.disabled = false;
        }
    }

    async function getCacheSize() {
        try {
            const response = await fetch('/api/cache_size');
            if (!response.ok) {
                throw new Error('Failed to fetch cache size.');
            }
            const data = await response.json();
            cacheSizeDisplay.textContent = data.cache_size_mb;
        } catch (error) {
            console.error('Error fetching cache size:', error);
            cacheSizeDisplay.textContent = 'Error loading size.';
        }
    }

    clearCacheButton.addEventListener('click', async () => {
        
        const response = await fetch('/api/clear_cache');

        if (!response.ok) {
            throw new Error('Failed to clear cache.');
        }

        alert('Cache cleared.');
        getCacheSize(); // Refresh cache size after clearing

    });

    downloadBtnPiper.addEventListener('click', downloadPiperVoice);
    downloadBtnKokoro.addEventListener('click', downloadKokoroVoice);

    let prefs = JSON.parse(localStorage.getItem('prefs') || '{}');

    if (prefs.chunkSize) {
        chunkSizeSlider.value = parseInt(prefs.chunkSize);
        chunkSizeDisplay.textContent = prefs.chunkSize;
    }

    chunkSizeSlider.addEventListener('input', async () => {
        
        chunkSizeDisplay.textContent = chunkSizeSlider.value;

        // Save chunk size to local storage
        prefs.chunkSize = parseInt(chunkSizeSlider.value);
        localStorage.setItem('prefs', JSON.stringify(prefs));

    });

    // Initial load
    getPiperVoices();
    getCacheSize(); // Call getCacheSize on initial load
});
