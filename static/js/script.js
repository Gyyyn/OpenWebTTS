// Import IndexedDB functions
import { savePdf, loadPdf, deletePdf } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    const engineSelect = document.getElementById('engine');
    const voiceSelect = document.getElementById('voice');
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text');
    const textDisplay = document.getElementById('text-display');
    const bookPageTitle = document.getElementById('book-title');
    const loadingDiv = document.getElementById('loading');
    const audioOutput = document.getElementById('audio-output');
    const audioPlayer = document.getElementById('audio-player');
    const pdfFileInput = document.getElementById('pdf-file');
    const pdfViewer = document.getElementById('pdf-viewer');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumSpan = document.getElementById('page-num');
    const bookList = document.getElementById('book-list');
    const newBookBtn = document.getElementById('new-book-btn');
    const autoReadCheckbox = document.getElementById('auto-read-checkbox');
    const autoDeleteChunksCheckbox = document.getElementById('auto-delete-chunks-checkbox');
    const currentChunk = document.getElementById('current-chunk');
    const closeCurrentChunkButton = document.getElementById('close-current-chunk');
    const bookView = document.getElementById('book-view');

    // Modal Elements
    const bookModal = document.getElementById('book-modal');
    const modalTitle = document.getElementById('modal-title');
    const bookTitleInput = document.getElementById('book-title-input');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalActionBtn = document.getElementById('modal-action-btn');
    const playbackSpeed = document.getElementById('playback-speed');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    // File Picker Modal Elements
    const filePickerModal = document.getElementById('file-picker-modal');
    const openFilePickerBtn = document.getElementById('open-file-picker-modal');
    const closeFilePickerBtn = document.getElementById('close-file-picker-modal');

    // Speech to Text Elements
    const recordBtn = document.getElementById('record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const audioFileInput = document.getElementById('audio-file-input');
    const transcribeFileBtn = document.getElementById('transcribe-file-btn');

    let pdfDoc = null;
    let currentPageNum = 1;
    let books = JSON.parse(localStorage.getItem('books')) || {};
    let activeBookId = localStorage.getItem('activeBookId') || null;
    let audioQueue = [];
    let isPlaying = false;
    let isPaused = false;
    let allTextChunks = [];
    let currentChunkIndex = 0;
    let lastChunkProcessed = -1;
    
    // Speech to Text variables
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // Set workerSrc for PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

    function saveBooks() {
        localStorage.setItem('books', JSON.stringify(books));
    }

    function setActiveBook(bookId) {
        activeBookId = bookId;
        localStorage.setItem('activeBookId', bookId);
        renderBooks();
        loadBookContent(bookId);
        updateCheckbox(autoReadCheckbox, 'autoRead');
        updateCheckbox(autoDeleteChunksCheckbox, 'autoDeleteChunks');
    }

    function renderBooks() {
        bookList.innerHTML = '';
        for (const bookId in books) {
            const book = books[bookId];
            const li = document.createElement('li');
            li.className = `flex text-sm justify-between items-center cursor-pointer p-2 rounded-lg ${bookId === activeBookId ? 'bg-indigo-100' : 'hover:bg-gray-200'}`;
            
            const titleSpan = document.createElement('span');
            titleSpan.className = `overflow-hidden`
            titleSpan.textContent = book.title;
            li.addEventListener('click', () => {
                setActiveBook(bookId);
            });

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex items-center space-x-2';

            const renameBtn = document.createElement('button');
            renameBtn.innerHTML = '<ion-icon name="create-outline"></ion-icon>';
            renameBtn.className = 'hover:text-gray-500';
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                renameBook(bookId);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<ion-icon name="trash-outline"></ion-icon>';
            deleteBtn.className = 'hover:text-gray-500';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteBook(bookId);
            });

            li.appendChild(titleSpan);
            actionsDiv.appendChild(renameBtn);
            actionsDiv.appendChild(deleteBtn);
            li.appendChild(actionsDiv);
            bookList.appendChild(li);
        }
    }

    function showBookModal(title, actionText, actionCallback, options = {}) {
        const { showInput = true, inputValue = '' } = options;

        modalTitle.textContent = title;
        modalActionBtn.textContent = actionText;
        modalActionBtn.onclick = actionCallback;

        if (showInput) {
            bookTitleInput.value = inputValue;
            bookTitleInput.style.display = 'block';
        } else {
            bookTitleInput.style.display = 'none';
        }

        bookModal.classList.remove('hidden');
    }

    function hideBookModal() {
        bookModal.classList.add('hidden');
        bookTitleInput.value = ''; // Clear input on hide
    }

    function deleteBook(bookId) {
        const book = books[bookId];
        if (!book) return;

        showBookModal(
            `Delete Book: ${book.title}?`,
            'Delete',
            () => {
                if (books[bookId].pdfId) {
                    deletePdf(books[bookId].pdfId);
                }
                delete books[bookId];
                saveBooks();
                if (activeBookId === bookId) {
                    activeBookId = null;
                    localStorage.removeItem('activeBookId');
                    textDisplay.innerHTML = '';
                    resetPdfView();
                }
                renderBooks();
                resetBookView();
                hideBookModal();
            },
            { showInput: false }
        );
    }

    function showFileModal() {
        filePickerModal.classList.remove('hidden');
        // Reset file input
        pdfFileInput.value = '';
    }

    function hideFileModal() {
        filePickerModal.classList.add('hidden');
        // Reset file input
        pdfFileInput.value = '';
    }

    function renameBook(bookId) {
        const book = books[bookId];
        if (!book) return;

        showBookModal(
            'Rename Book',
            'Rename',
            () => {
                const newTitle = bookTitleInput.value;
                if (newTitle !== null && newTitle.trim() !== '' && newTitle !== book.title) {
                    book.title = newTitle.trim();
                    saveBooks();
                    renderBooks();
                    if (activeBookId === bookId) {
                        bookPageTitle.innerHTML = newTitle.trim();
                    }
                }
                hideBookModal();
            },
            { showInput: true, inputValue: book.title }
        );
    }

    function highlightChunk(chunkObject) {
        const fullText = textDisplay.textContent;
        const chunkText = chunkObject.text;
        const startIndex = fullText.indexOf(chunkText);

        if (startIndex === -1) {
            console.error("Could not find chunk text to highlight:", chunkObject);
            return;
        }

        // Create the HTML for the highlighted chunk (with spans for each word)
        const words = chunkText.split(/(\s+)/); // Keep spaces
        let highlightedHtml = '';
        words.forEach(word => {
            if (word.trim() !== '') {
                // Use the same data-chunk-id for easy removal later
                highlightedHtml += `<span class="highlight" data-chunk-id="${chunkObject.id}">${word}</span>`;
            } else {
                highlightedHtml += word;
            }
        });

        // Replace the plain text of the chunk with our new highlighted HTML
        textDisplay.innerHTML = fullText.substring(0, startIndex) +
                            highlightedHtml +
                            fullText.substring(startIndex + chunkText.length);
    }

    function unhighlightChunk(chunkObject) {
        // Find all the spans for the chunk we just played
        const spans = textDisplay.querySelectorAll(`span[data-chunk-id="${chunkObject.id}"]`);
        if (spans.length === 0) return;

        // We can simply replace the entire innerHTML with the plain text again.
        // This is efficient because the highlight/unhighlight is the only change.
        textDisplay.textContent = allTextChunks.map(chunk => chunk.text).join(' ');
    }

    async function loadBookContent(bookId) {
        if (books[bookId]) {
            bookPageTitle.innerHTML = books[bookId].title;
            allTextChunks = splitTextIntoChunks(books[bookId].text);

            textDisplay.textContent = books[bookId].text;
            bookView.classList.remove('hidden');

            currentChunkIndex = 0; // Reset chunk index

            if (books[bookId].pdfId) {
                const pdfData = await loadPdf(books[bookId].pdfId);
                if (pdfData) {
                    pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
                    const lastPage = parseInt(localStorage.getItem(pdfDoc.fingerprint)) || 1;
                    renderPage(lastPage);
                } else {
                    pdfViewer.innerHTML = '';
                    pageNumSpan.textContent = '';
                    prevPageBtn.disabled = true;
                    nextPageBtn.disabled = true;
                }
            } else {
                pdfViewer.innerHTML = '';
                pageNumSpan.textContent = '';
                prevPageBtn.disabled = true;
                nextPageBtn.disabled = true;
            }
        }
    }

    function createNewBook() {
        showBookModal(
            'New Book',
            'Create',
            () => {
                const bookTitle = bookTitleInput.value;
                if (bookTitle) {
                    const bookId = `book-${Date.now()}`;
                    books[bookId] = { title: bookTitle, text: '', autoRead: false, autoDeleteChunks: false, pdfId: null };
                    saveBooks();
                    setActiveBook(bookId);
                }
                hideBookModal();
            },
            { showInput: true, inputValue: '' }
        );
    }

    function updateCheckbox(checkboxElement, bookProperty) {
        if (activeBookId && books[activeBookId]) {
            checkboxElement.checked = books[activeBookId][bookProperty];
        }
    }

    function resetPdfView() {
        pdfViewer.innerHTML = '';
        pageNumSpan.textContent = '';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        pdfDoc = null;
    }

    function resetBookView() {
        textDisplay.textContent = '';
        currentChunk.childNodes[1].childNodes[1].textContent = '';
        currentChunk.classList.add('hidden');
        bookPageTitletextContent = 'New Book';
        bookView.classList.add('hidden');
    }

    autoReadCheckbox.addEventListener('change', () => {
        if (activeBookId && books[activeBookId]) {
            books[activeBookId].autoRead = autoReadCheckbox.checked;
            saveBooks();
        }
    });

    autoDeleteChunksCheckbox.addEventListener('change', () => {
        if (activeBookId && books[activeBookId]) {
            books[activeBookId].autoDeleteChunks = autoDeleteChunksCheckbox.checked;
            saveBooks();
        }
    });

    newBookBtn.addEventListener('click', createNewBook);

    textDisplay.addEventListener('input', () => {
        if (activeBookId && books[activeBookId]) {
            const plainText = textDisplay.textContent; // Get plain text from contenteditable
            books[activeBookId].text = plainText; // Save plain text
            allTextChunks = splitTextIntoChunks(plainText); // Re-chunk the text
            saveBooks();
        }
    });

    async function updateVoices() {
        const engine = engineSelect.value;
        voiceSelect.innerHTML = '<option value="">Loading voices...</option>';

        try {
            const response = await fetch(`/api/voices?engine=${engine}`);
            if (!response.ok) {
                throw new Error('Failed to fetch voices.');
            }
            const voices = await response.json();

            voiceSelect.innerHTML = '';
            if (voices.length === 0) {
                voiceSelect.innerHTML = '<option value="">-- No voices found --</option>';
            } else {
                voices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.id;
                    option.textContent = voice.name;
                    voiceSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error fetching voices:', error);
            voiceSelect.innerHTML = '<option value="">-- Error loading voices --</option>';
        }
    }

    function enableAudioControls() {
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        playbackSpeed.disabled = false;
    }

    function disableAudioControls() {
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        playbackSpeed.disabled = true;
    }

    function splitTextIntoChunks(text, chunkSize = 50) {
        const words = text.split(/\s+/);
        const chunks = [];
        let currentTextIndex = 0;
        for (let i = 0; i < words.length; i += chunkSize) {
            const chunkWords = words.slice(i, i + chunkSize);
            const chunkText = chunkWords.join(' ');
            chunks.push({
                id: `chunk-${i}`,
                text: chunkText,
                startIndex: currentTextIndex,
                endIndex: currentTextIndex + chunkText.length
            });
            currentTextIndex += chunkText.length + (chunkWords.length > 0 ? chunkWords.length - 1 : 0); // Add spaces between words
        }
        return chunks;
    }

    async function generateSpeech(text) {
        const engine = engineSelect.value;
        const voice = voiceSelect.value;

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
                            if (headResponse.ok) {
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

    async function playAudioQueue() {

        if (isPaused)
        return;

        if (audioQueue.length === 0) {
            isPlaying = false;
            disableAudioControls(); // Disable controls when queue is empty
            clearAllHighlights(); // Clear highlights when playback finishes
            if (autoReadCheckbox.checked && currentPageNum < pdfDoc.numPages) {
                renderPage(currentPageNum + 1).then(() => {
                    startSpeechGeneration();
                });
            }
            return;
        }

        isPlaying = true;
        enableAudioControls(); // Enable controls when audio starts playing
        
        // Shift current audio from queue and preemptively process next chunk.
        const currentAudio = audioQueue.shift();

        highlightChunk(currentAudio.text);
        currentChunk.childNodes[1].childNodes[1].textContent = currentAudio.text.text;
        currentChunk.classList.remove('hidden');

        audioPlayer.src = currentAudio.url;
        audioPlayer.playbackRate = playbackSpeed.value;

        /* const onLoadedMetadata = () => {
            highlightWords(currentAudio.text, audioPlayer.duration);
            audioPlayer.removeEventListener('loadedmetadata', onLoadedMetadata);
        };

        audioPlayer.addEventListener('loadedmetadata', onLoadedMetadata); */
        audioPlayer.play();

        audioPlayer.onended = async () => {

            unhighlightChunk(currentAudio.text);
            currentChunk.classList.add('hidden');
            
            const playedChunkId = currentAudio.text.id; // Define playedChunkId here
            if (activeBookId && books[activeBookId].autoDeleteChunks) {
                const spansToRemove = textDisplay.querySelectorAll(`span[data-chunk-id="${playedChunkId}"]`);
                spansToRemove.forEach(span => span.remove());

                // Update the stored text to reflect the deletion
                const remainingText = allTextChunks.filter(chunk => chunk.id !== playedChunkId).map(chunk => chunk.text).join(' ');
                books[activeBookId].text = remainingText;
                saveBooks();
            }

            currentChunkIndex++;

            const nextChunkToFetch = currentChunkIndex + 2; // +2 because buffer size is 3
            processAndQueueChunk(nextChunkToFetch);

            if (audioQueue.length > 0) {
                // If there's more audio ready, play it immediately.
                playAudioQueue();
            } else {
                // If the queue is empty, it means the network is slow.
                // We just wait. Playback will resume when processAndQueueChunk adds the next item.
                console.log("Buffer empty, waiting for network...");
                isPlaying = false;
                disableAudioControls();
            }
            
        };
    }

    async function startSpeechGeneration() {

        const text = textDisplay.textContent.trim();
        allTextChunks = splitTextIntoChunks(text);
        
        // Reset trackers
        currentChunkIndex = 0;
        lastChunkProcessed = -1; 

        if (allTextChunks.length === 0) {
            return;
        }

        loadingDiv.classList.remove('hidden');
        generateBtn.disabled = true;
        audioQueue = []; // Clear previous queue
        isPlaying = false;
        isPaused = false;

        const initialBufferSize = Math.min(3, allTextChunks.length);
        for (let i = 0; i < initialBufferSize; i++) {
            processAndQueueChunk(i);
        }

        loadingDiv.classList.add('hidden');
        audioOutput.classList.remove('hidden');
    }

    // This function FIRES the request but does not wait for it.
    function processAndQueueChunk(chunkIndex) {
        // Make sure we don't go out of bounds
        if (chunkIndex >= allTextChunks.length) {
            return;
        }

        const chunk = allTextChunks[chunkIndex];
        
        // generateSpeech returns a Promise. We use .then() to handle the result
        // when it arrives, instead of stopping everything with await.
        generateSpeech(chunk).then(audioUrl => {
            if (audioUrl) {
                console.log(`✅ Audio received for chunk index: ${chunkIndex}`);
                audioQueue.push({ url: audioUrl, text: chunk });

                // IMPORTANT: If we just received the VERY FIRST chunk, start playback now.
                if (!isPlaying && audioQueue.length > 0) {
                    playAudioQueue();
                }
            } else {
                console.error(`❌ Failed to get audio for chunk index: ${chunkIndex}`);
            }
        });
    }

    function clearAllHighlights() {
        const allWordElements = textDisplay.querySelectorAll('span.highlight');
        allWordElements.forEach(span => span.classList.remove('highlight'));
    }

    async function renderPage(num) {
        currentPageNum = num;
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        pdfViewer.innerHTML = '';
        pdfViewer.appendChild(canvas);

        const renderContext = {
            canvasContext: context,
            viewport: viewport,
        };
        await page.render(renderContext).promise;

        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        
        allTextChunks = splitTextIntoChunks(pageText);

        textDisplay.textContent = pageText;
        
        currentChunkIndex = 0; // Reset chunk index

        pageNumSpan.textContent = `Page ${num} of ${pdfDoc.numPages}`;
        localStorage.setItem(pdfDoc.fingerprint, num);

        prevPageBtn.disabled = num <= 1;
        nextPageBtn.disabled = num >= pdfDoc.numPages;

        if (activeBookId && books[activeBookId]) {
            books[activeBookId].text = pageText;
            saveBooks();
        }
    }

    playbackSpeed.addEventListener('input', () => {
        audioPlayer.playbackRate = playbackSpeed.value;
    });

    pauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            if (isPaused) {
                isPaused = false;
                pauseBtn.innerHTML = '<ion-icon name="pause-outline"></ion-icon>';
                audioPlayer.play();
            } else {
                isPaused = true;
                pauseBtn.innerHTML = '<ion-icon name="play-outline"></ion-icon>';
                audioPlayer.pause();
            }
        }
    });

    stopBtn.addEventListener('click', () => {
        isPlaying = false;
        isPaused = false;
        audioQueue = [];
        audioPlayer.pause();
        audioPlayer.src = '';
        generateBtn.disabled = false;
        pauseBtn.innerHTML = '<ion-icon name="pause-outline"></ion-icon>'; // Reset pause button icon
        disableAudioControls(); // Disable controls on stop
        textDisplay.textContent = allTextChunks.map(chunk => chunk.text).join(' '); // Revert to plain text
    });

    pdfFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!activeBookId) {
            alert('Please create or select a book first.');
            return;
        }

        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        // Update the title of the active book to match the file name
        books[activeBookId].title = fileName.replace(`.${fileExtension}`, '');
        bookPageTitle.innerHTML = books[activeBookId].title; // Update displayed title

        if (fileExtension === 'pdf') {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target.result;

                // Clear previous PDF data if any
                if (books[activeBookId].pdfId) {
                    await deletePdf(books[activeBookId].pdfId);
                }

                books[activeBookId].pdfId = activeBookId; // Use activeBookId as pdfId
                books[activeBookId].text = ''; // Clear text for PDF books
                saveBooks();
                allTextChunks = []; // Reset chunks
                currentChunkIndex = 0; // Reset chunk index
                
                await savePdf(activeBookId, arrayBuffer);

                pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const lastPage = parseInt(localStorage.getItem(pdfDoc.fingerprint)) || 1;
                renderPage(lastPage);
            };
            reader.readAsArrayBuffer(file);
        } else if (fileExtension === 'epub') {
            // Clear previous PDF data if any
            if (books[activeBookId].pdfId) {
                await deletePdf(books[activeBookId].pdfId);
            }
            books[activeBookId].pdfId = null; // No pdfId for epub
            saveBooks();

            loadingDiv.classList.remove('hidden');
            generateBtn.disabled = true;

            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/read_epub', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to read EPUB.');
                }

                const data = await response.json();
                books[activeBookId].text = data.text;
                saveBooks();
                allTextChunks = splitTextIntoChunks(data.text);
                textDisplay.textContent = data.text;
                currentChunkIndex = 0; // Reset chunk index

                // Clear PDF specific elements
                resetPdfView();

            } catch (error) {
                console.error('Error reading EPUB:', error);
                alert(`An error occurred: ${error.message}`);
                // Revert changes if error
                books[activeBookId].text = ''; 
                books[activeBookId].pdfId = null;
                saveBooks();
                textDisplay.innerHTML = '';
            } finally {
                loadingDiv.classList.add('hidden');
                generateBtn.disabled = false;
            }
        } else {
            alert('Please select a valid PDF or EPUB file.');
        }
        
        // Hide the modal after file processing
        hideFileModal();
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPageNum <= 1) return;
        renderPage(currentPageNum - 1);
    });

    nextPageBtn.addEventListener('click', () => {
        if (currentPageNum >= pdfDoc.numPages) return;
        renderPage(currentPageNum + 1);
    });

    engineSelect.addEventListener('change', updateVoices);
    generateBtn.addEventListener('click', startSpeechGeneration);

    modalCancelBtn.addEventListener('click', hideBookModal);

    // File Picker Modal Event Listeners
    openFilePickerBtn.addEventListener('click', showFileModal);
    closeFilePickerBtn.addEventListener('click', hideFileModal);
    
    // Close modal when clicking outside of it
    filePickerModal.addEventListener('click', (e) => {
        if (e.target === filePickerModal) {
            hideFileModal();
        }
    });

    closeCurrentChunkButton.addEventListener('click', () => {
        currentChunk.textContent = '';
        currentChunk.classList.add('hidden');
    });

    // Speech to Text Functions
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Try to use WebM format first, fallback to other formats
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'audio/mp4';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = 'audio/wav';
                    }
                }
            }
            
            mediaRecorder = new MediaRecorder(stream, { mimeType });
            
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                await transcribeAudio(audioBlob);
                
                // Stop all tracks to release the microphone
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            
            // Update UI
            recordBtn.classList.add('hidden');
            stopRecordBtn.classList.remove('hidden');
            recordingIndicator.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Failed to start recording. Please make sure you have granted microphone permissions.');
        }
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            isRecording = false;
            
            // Update UI
            recordBtn.classList.remove('hidden');
            stopRecordBtn.classList.add('hidden');
            recordingIndicator.classList.add('hidden');
        }
    }

    async function transcribeAudio(audioBlob) {
        try {
            // Show loading state
            recordBtn.disabled = true;
            recordBtn.innerHTML = '<ion-icon class="animate-spin" name="refresh-outline"></ion-icon> Processing...';
            
            const formData = new FormData();
            // Determine file extension based on MIME type
            let fileExtension = 'webm';
            if (audioBlob.type.includes('mp4')) fileExtension = 'mp4';
            else if (audioBlob.type.includes('wav')) fileExtension = 'wav';
            formData.append('file', audioBlob, `recording.${fileExtension}`);
            
            const response = await fetch('/api/speech_to_text', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to transcribe audio.');
            }
            
            const data = await response.json();
            
            // Insert the transcribed text into the text display
            if (data.text && data.text.trim()) {
                const currentText = textDisplay.textContent || '';
                const newText = currentText + (currentText ? '\n\n' : '') + data.text;
                textDisplay.textContent = newText;
                
                // Update the book's text content
                if (activeBookId && books[activeBookId]) {
                    books[activeBookId].text = newText;
                    saveBooks();
                    
                    // Update text chunks for the new content
                    allTextChunks = splitTextIntoChunks(newText);
                    currentChunkIndex = 0;
                }
                
                // Show success message
                showNotification(`Transcription completed! Detected language: ${data.language || 'Unknown'}`, 'success');
            } else {
                showNotification('No speech detected in the audio.', 'warning');
            }
            
        } catch (error) {
            console.error('Error transcribing audio:', error);
            showNotification(`Transcription failed: ${error.message}`, 'error');
        } finally {
            // Reset button state
            recordBtn.disabled = false;
            recordBtn.innerHTML = '<span class="me-2">Record Audio</span><ion-icon name="mic-outline"></ion-icon>';
        }
    }

    async function transcribeAudioFile(audioFile) {
        try {
            // Show loading state
            transcribeFileBtn.disabled = true;
            transcribeFileBtn.innerHTML = '<ion-icon class="animate-spin" name="refresh-outline"></ion-icon> Processing...';
            
            const formData = new FormData();
            formData.append('file', audioFile);
            
            const response = await fetch('/api/speech_to_text', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to transcribe audio file.');
            }
            
            const data = await response.json();
            
            // Insert the transcribed text into the text display
            if (data.text && data.text.trim()) {
                const currentText = textDisplay.textContent || '';
                const newText = currentText + (currentText ? '\n\n' : '') + data.text;
                textDisplay.textContent = newText;
                
                // Update the book's text content
                if (activeBookId && books[activeBookId]) {
                    books[activeBookId].text = newText;
                    saveBooks();
                    
                    // Update text chunks for the new content
                    allTextChunks = splitTextIntoChunks(newText);
                    currentChunkIndex = 0;
                }
                
                // Show success message
                showNotification(`File transcription completed! Detected language: ${data.language || 'Unknown'}`, 'success');
            } else {
                showNotification('No speech detected in the audio file.', 'warning');
            }
            
        } catch (error) {
            console.error('Error transcribing audio file:', error);
            showNotification(`File transcription failed: ${error.message}`, 'error');
        } finally {
            // Reset button state
            transcribeFileBtn.disabled = false;
            transcribeFileBtn.innerHTML = '<span class="me-2">Transcribe File</span><ion-icon name="document-text-outline"></ion-icon>';
        }
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Speech to Text Event Listeners
    recordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    
    // Audio File Transcription Event Listeners
    transcribeFileBtn.addEventListener('click', () => {
        audioFileInput.click();
    });
    
    audioFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        await transcribeAudioFile(file);
        // Reset the input
        audioFileInput.value = '';
    });

    // Initial load
    renderBooks();
    if (activeBookId) {
        loadBookContent(activeBookId);
        updateCheckbox(autoReadCheckbox, 'autoRead');
        updateCheckbox(autoDeleteChunksCheckbox, 'autoDeleteChunks');
    }
    updateVoices();
    disableAudioControls(); // Disable controls on initial load
});