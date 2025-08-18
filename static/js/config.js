document.addEventListener('DOMContentLoaded', () => {
    const piperVoiceSelect = document.getElementById('piper-voice');
    const downloadBtn = document.getElementById('download-btn');
    const downloadStatus = document.getElementById('download-status');

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

        downloadBtn.disabled = true;
        downloadStatus.textContent = 'Downloading...';

        try {
            const response = await fetch('/api/download_piper_voice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ key: voiceKey }),
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
            downloadBtn.disabled = false;
        }
    }

    downloadBtn.addEventListener('click', downloadPiperVoice);

    // Initial load
    getPiperVoices();
});
