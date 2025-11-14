/*
 * -- config.js
 * --
 * -- This file contains the UI for the config page.
 * -- It's structed "top to bottom", mirroring the HTML of config.html.
 *
 */

/*
 * Imports.
 */

import { setBodyFont, handlePrefs } from "./helpers.js";

const clearCacheButton = document.getElementById('clear-cache');

document.addEventListener('DOMContentLoaded', () => {
    const accessibleFontCheckbox = document.getElementById('use-accessible-font-checkbox');
    const accessibleFontUICheckbox = document.getElementById('accessible-font-ui-checkbox');
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

    let prefs = handlePrefs();

    googleVoiceInput.value = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) ?? null;

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

    // Populate saved values
    function populatePrefsInputs() {
        
        if (prefs.chunkSize) {
            chunkSizeSlider.value = parseInt(prefs.chunkSize);
            chunkSizeDisplay.textContent = prefs.chunkSize;
        }

        prefs.accessibleFontEnabled = accessibleFontCheckbox.checked || false;
        prefs.accessibleFontUIEnabled = accessibleFontUICheckbox.checked || false;

        if (prefs.accessibleFontStyle) {
            document.querySelectorAll('input[name="accessible-font-style"]').forEach((input) => {
                if (input.value == prefs.accessibleFontStyle) {
                    input.checked = true;
                }
            });
        }

        if (prefs.highlightColor) {
            document.querySelectorAll(`#highlight-customization > div`).forEach(block => {
                block.classList.remove('shadow-xl');
            });

            document.querySelector(`#highlight-customization > div.${prefs.highlightColor}`).classList.add('shadow-xl');
        }

        if (prefs.useBlackBG) {
            document.querySelector('#pureblack-bg-toggle').checked = true;
        }
    }

    clearCacheButton.addEventListener('click', async () => {
        
        const response = await fetch('/api/clear_cache');

        if (!response.ok) {
            throw new Error('Failed to clear cache.');
        }

        getCacheSize(); // Refresh cache size after clearing

    });

    downloadBtnPiper.addEventListener('click', downloadPiperVoice);
    downloadBtnKokoro.addEventListener('click', downloadKokoroVoice);

    chunkSizeSlider.addEventListener('input', async () => {
        
        chunkSizeDisplay.textContent = chunkSizeSlider.value;

        prefs.chunkSize = parseInt(chunkSizeSlider.value);
        handlePrefs(prefs);

    });

    const apiKeyContainer = document.getElementById('explanation-container');
    apiKeyContainer.style.display = 'none';

    document.getElementById('toggle-explanation-container').addEventListener('click', function() {
        apiKeyContainer.style.display = apiKeyContainer.style.display === 'none' ? 'block' : 'none';
    });

    accessibleFontCheckbox.addEventListener('change', () => {

        prefs.accessibleFontEnabled = accessibleFontCheckbox.checked;
        handlePrefs(prefs);
        setBodyFont(prefs);
        populatePrefsInputs();

    });

    accessibleFontUICheckbox.addEventListener('change', () => {

        prefs.accessibleFontUIEnabled = accessibleFontUICheckbox.checked;
        handlePrefs(prefs);
        setBodyFont(prefs);
        populatePrefsInputs();

    });

    document.querySelectorAll('input[name="accessible-font-style"]').forEach(radio => {
        radio.addEventListener('change', () => {

            accessibleFontCheckbox.checked = true;
            prefs.accessibleFontEnabled = true;
            prefs.accessibleFontStyle = document.querySelector('input[name="accessible-font-style"]:checked')?.value || 'default'; 
            
            handlePrefs(prefs);
            setBodyFont(prefs);

        });
    });

    // -- Coqui Voice Cloning -- //
    const recordBtn = document.getElementById('record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const audioFileInput = document.getElementById('audio-file-input');
    const uploadFileBtn = document.getElementById('upload-file-btn');

    let mediaRecorder;
    let audioChunks = [];

    async function handleAudioFile(file) {
        console.debug("Audio file ready: ", file);
        downloadStatus.textContent = 'Uploading...';

        const formData = new FormData();
        // If the file is a Blob from recording, it needs a filename.
        const fileName = file.name || 'user.wav';
        formData.append("file", file, fileName);

        try {
            const response = await fetch('/api/voice_cloning', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to upload voice sample.');
            }

            const data = await response.json();
            downloadStatus.textContent = data.message;
        } catch (error) {
            console.error('Error uploading voice sample:', error);
            downloadStatus.textContent = `An error occurred: ${error.message}`;
        }
    }

    recordBtn.addEventListener('click', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();

        recordBtn.classList.add('hidden');
        stopRecordBtn.classList.remove('hidden');
        recordingIndicator.classList.remove('hidden');

        mediaRecorder.addEventListener("dataavailable", event => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            handleAudioFile(audioBlob);
            audioChunks = [];
        });
    });

    stopRecordBtn.addEventListener('click', () => {
        mediaRecorder.stop();
        recordBtn.classList.remove('hidden');
        stopRecordBtn.classList.add('hidden');
        recordingIndicator.classList.add('hidden');
    });

    uploadFileBtn.addEventListener('click', () => {
        audioFileInput.click();
    });

    audioFileInput.addEventListener('change', () => {
        const file = audioFileInput.files[0];
        if (file) {
            handleAudioFile(file);
        }
    });

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    const pureblackBgToggle = document.getElementById('pureblack-bg-toggle');
    
    pureblackBgToggle.addEventListener('change', (e) => {
        prefs.useBlackBG = e.target.checked;
        handlePrefs(prefs);
    });

    // Add events to highlight buttons
    document.querySelectorAll("#highlight-customization button").forEach((item) => {
        item.addEventListener('click', () => {
            prefs.highlightColor = item.dataset.value;
            handlePrefs(prefs);
            populatePrefsInputs();
        });
    });

    // Call init functions
    getPiperVoices();
    getCacheSize();
    populatePrefsInputs();
    setBodyFont();
});