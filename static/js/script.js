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
    const pdfViewerWrapper = document.getElementById('pdf-viewer-wrapper');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumSpan = document.getElementById('page-num');
    const localBookList = document.getElementById('local-book-list');
    const onlineBookList = document.getElementById('online-book-list');
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

    // Login Modal Elements
    const loginModal = document.getElementById('login-modal');
    const addAccountBtn = document.getElementById('add-account-btn');
    const loginModalCancelBtn = document.getElementById('login-modal-cancel-btn');
    const loginUsernameInput = document.getElementById('login-username-input');
    const loginPasswordInput = document.getElementById('login-password-input');
    const loginActionBtn = document.getElementById('login-modal-action-btn');
    const createAccountBtn = document.getElementById('create-account-btn');
    const currentUserDisplay = document.getElementById('current-user');
    const saveBookBtn = document.getElementById('save-book-btn');
    const logoutBtn = document.getElementById('logout-btn');
    
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
    let localBooks = JSON.parse(localStorage.getItem('books')) || {};
    let onlineBooks = [];
    let activeBook = null;
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
    let currentUser = null;

    // Set workerSrc for PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

    function saveLocalBooks() {
        localStorage.setItem('books', JSON.stringify(localBooks));
    }

    function setActiveBook(book) {
        activeBook = book;
        renderLocalBooks();
        renderOnlineBooks();
        loadBookContent(book);
        if (book && book.source === 'local') {
            updateCheckbox(autoReadCheckbox, 'autoRead');
            updateCheckbox(autoDeleteChunksCheckbox, 'autoDeleteChunks');
        }
    }

    function renderOnlineBooks() {
        onlineBookList.innerHTML = '';
        onlineBooks.forEach(book => {
            const li = createBookListItem(book, 'online');
            onlineBookList.appendChild(li);
        });
    }

    function renderLocalBooks() {
        localBookList.innerHTML = '';
        for (const bookId in localBooks) {
            const book = { ...localBooks[bookId], id: bookId };
            const li = createBookListItem(book, 'local');
            localBookList.appendChild(li);
        }
    }

    function createBookListItem(book, source) {
        const li = document.createElement('li');
        const isActive = activeBook && activeBook.id === book.id && activeBook.source === source;
        li.className = `flex text-sm justify-between items-center cursor-pointer p-2 rounded-lg ${isActive ? 'bg-indigo-100' : 'hover:bg-gray-200'}`;

        const titleSpan = document.createElement('span');
        titleSpan.className = `overflow-hidden`;
        titleSpan.textContent = book.title;
        li.addEventListener('click', () => {
            setActiveBook({ ...book, source });
        });

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex items-center space-x-2';

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<ion-icon name="trash-outline"></ion-icon>';
        deleteBtn.className = 'hover:text-gray-500';

        const renameBtn = document.createElement('button');
        renameBtn.innerHTML = '<ion-icon name="create-outline"></ion-icon>';
        renameBtn.className = 'hover:text-gray-500';

        if (source === 'local') {
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                renameBook(book.id);
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteBook(book.id);
            });
        } else { // Online book
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                renameOnlineBook(book);
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteOnlineBook(book.id);
            });
        }

        actionsDiv.appendChild(renameBtn);
        actionsDiv.appendChild(deleteBtn);
        li.appendChild(titleSpan);
        li.appendChild(actionsDiv);
        return li;
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
        const book = localBooks[bookId];
        if (!book) return;

        showBookModal(
            `Delete Book: ${book.title}?`,
            'Delete',
            () => {

                if (localBooks[bookId].pdfId) {
                    deletePdf(localBooks[bookId].pdfId);
                }

                delete localBooks[bookId];
                saveLocalBooks();

                if (activeBook && activeBook.id === bookId) {
                    activeBook = null;
                    textDisplay.innerHTML = '';
                    resetPdfView();
                }

                hideBookModal();
                renderLocalBooks();
                resetBookView();
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
        const book = localBooks[bookId];
        if (!book) return;

        showBookModal(
            'Rename Book',
            'Rename',
            () => {
                const newTitle = bookTitleInput.value;
                if (newTitle !== null && newTitle.trim() !== '' && newTitle !== book.title) {
                    book.title = newTitle.trim();
                    saveLocalBooks();
                    renderLocalBooks();
                    if (activeBook && activeBook.id === bookId) {
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

    async function loadBookContent(book) {
        if (book) {
            bookPageTitle.innerHTML = book.title;
            const content = book.source === 'online' ? book.content : localBooks[book.id].text;
            allTextChunks = splitTextIntoChunks(content);

            textDisplay.textContent = content;
            bookView.classList.remove('hidden');

            currentChunkIndex = 0; // Reset chunk index

            if (book.source === 'local' && localBooks[book.id].pdfId) {
                pdfViewerWrapper.classList.remove('hidden');
                const pdfData = await loadPdf(localBooks[book.id].pdfId);
                if (pdfData) {
                    pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
                    const lastPage = parseInt(localStorage.getItem(pdfDoc.fingerprint)) || 1;
                    renderPage(lastPage);
                } else {
                    resetPdfView();
                }
            } else {
                resetPdfView();
            }
        }
    }

    function createNewBook() {
        showBookModal(
            'New Temporary Book',
            'Create',
            () => {
                const bookTitle = bookTitleInput.value;
                if (bookTitle) {
                    const bookId = `book-${Date.now()}`;
                    localBooks[bookId] = { title: bookTitle, text: '', autoRead: false, autoDeleteChunks: false, pdfId: null };
                    saveLocalBooks();
                    setActiveBook({ ...localBooks[bookId], id: bookId, source: 'local' });
                }
                hideBookModal();
            },
            { showInput: true, inputValue: '' }
        );
    }

    function updateCheckbox(checkboxElement, bookProperty) {
        if (activeBook && activeBook.source === 'local') {
            checkboxElement.checked = localBooks[activeBook.id][bookProperty];
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
        if (activeBook && activeBook.source === 'local') {
            localBooks[activeBook.id].autoRead = autoReadCheckbox.checked;
            saveLocalBooks();
        }
    });

    autoDeleteChunksCheckbox.addEventListener('change', () => {
        if (activeBook && activeBook.source === 'local') {
            localBooks[activeBook.id].autoDeleteChunks = autoDeleteChunksCheckbox.checked;
            saveLocalBooks();
        }
    });

    newBookBtn.addEventListener('click', createNewBook);

    textDisplay.addEventListener('input', () => {
        if (activeBook) {
            const plainText = textDisplay.textContent;
            if (activeBook.source === 'local') {
                localBooks[activeBook.id].text = plainText;
                saveLocalBooks();
            } else { // Online book
                // For online books, just enable the save button to indicate changes
                saveBookBtn.classList.remove('hidden');
                saveBookBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600'); // Indicate unsaved changes
            }
            allTextChunks = splitTextIntoChunks(plainText);
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
            if (activeBook && activeBook.source === 'local' && localBooks[activeBook.id].autoDeleteChunks) {
                const spansToRemove = textDisplay.querySelectorAll(`span[data-chunk-id="${playedChunkId}"]`);
                spansToRemove.forEach(span => span.remove());

                // Update the stored text to reflect the deletion
                const remainingText = allTextChunks.filter(chunk => chunk.id !== playedChunkId).map(chunk => chunk.text).join(' ');
                localBooks[activeBook.id].text = remainingText;
                saveLocalBooks();
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

        if (activeBook && activeBook.source === 'local') {
            localBooks[activeBook.id].text = pageText;
            saveLocalBooks();
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

        if (!activeBook) {
            alert('Please create or select a book first.');
            return;
        }

        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        // Update the title of the active book to match the file name
        if (activeBook.source === 'local') {
            localBooks[activeBook.id].title = fileName.replace(`.${fileExtension}`, '');
            bookPageTitle.innerHTML = localBooks[activeBook.id].title; // Update displayed title
        }

        if (fileExtension === 'pdf') {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target.result;

                if (activeBook.source === 'local') {
                    // Clear previous PDF data if any
                    if (localBooks[activeBook.id].pdfId) {
                        await deletePdf(localBooks[activeBook.id].pdfId);
                    }

                    localBooks[activeBook.id].pdfId = activeBook.id; // Use activeBook.id as pdfId
                    localBooks[activeBook.id].text = ''; // Clear text for PDF books
                    saveLocalBooks();
                    allTextChunks = []; // Reset chunks
                    currentChunkIndex = 0; // Reset chunk index
                    
                    await savePdf(activeBook.id, arrayBuffer);

                    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    const lastPage = parseInt(localStorage.getItem(pdfDoc.fingerprint)) || 1;
                    renderPage(lastPage);
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (fileExtension === 'epub') {
            if (activeBook.source === 'local') {
                // Clear previous PDF data if any
                if (localBooks[activeBook.id].pdfId) {
                    await deletePdf(localBooks[activeBook.id].pdfId);
                }
                localBooks[activeBook.id].pdfId = null; // No pdfId for epub
                saveLocalBooks();
            }

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
                if (activeBook.source === 'local') {
                    localBooks[activeBook.id].text = data.text;
                    saveLocalBooks();
                }
                allTextChunks = splitTextIntoChunks(data.text);
                textDisplay.textContent = data.text;
                currentChunkIndex = 0; // Reset chunk index

                // Clear PDF specific elements
                resetPdfView();

            } catch (error) {
                console.error('Error reading EPUB:', error);
                alert(`An error occurred: ${error.message}`);
                if (activeBook.source === 'local') {
                    // Revert changes if error
                    localBooks[activeBook.id].text = ''; 
                    localBooks[activeBook.id].pdfId = null;
                    saveLocalBooks();
                }
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
                if (activeBook && activeBook.source === 'local') {
                    localBooks[activeBook.id].text = newText;
                    saveLocalBooks();
                    
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
                if (activeBook && activeBook.source === 'local') {
                    localBooks[activeBook.id].text = newText;
                    saveLocalBooks();
                    
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

    function showLoginModal() {
        loginModal.classList.remove('hidden');
    }

    function hideLoginModal() {
        loginModal.classList.add('hidden');
    }

    addAccountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginModal();
    });

    loginModalCancelBtn.addEventListener('click', hideLoginModal);

    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            hideLoginModal();
        }
    });

    // Initial load
    renderLocalBooks();
    updateVoices();
    disableAudioControls(); // Disable controls on initial load

    // User Management
    function updateCurrentUserUI(username) {
        currentUserDisplay.textContent = username;
        const userDetails = document.querySelector('#current-user + span');
        if (username === 'Anonymous') {
            userDetails.textContent = 'Not signed in';
            logoutBtn.classList.add('hidden');
        } else {
            userDetails.textContent = 'Signed in';
            logoutBtn.classList.remove('hidden');
        }
    }

    async function fetchAndRenderOnlineBooks() {
        if (!currentUser) return;
        try {
            const response = await fetch(`/api/users/${currentUser}/books`);
            if (!response.ok) {
                throw new Error('Failed to fetch online books.');
            }
            const data = await response.json();
            onlineBooks = data.books || [];
            renderOnlineBooks();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    async function handleLogin() {
        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value.trim();
        if (!username || !password) {
            showNotification('Username and password cannot be empty.', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Login failed.');
            }

            const data = await response.json();
            currentUser = data.username;
            sessionStorage.setItem('currentUser', currentUser);
            updateCurrentUserUI(currentUser);
            hideLoginModal();
            showNotification('Login successful!', 'success');
            fetchAndRenderOnlineBooks();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    function handleLogout() {
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        onlineBooks = [];
        renderOnlineBooks();
        updateCurrentUserUI('Anonymous');
        showNotification('You have been logged out.', 'info');
    }

    async function handleCreateAccount() {
        const username = loginUsernameInput.value.trim();
        const password = loginPasswordInput.value.trim();
        if (!username || !password) {
            showNotification('Username and password cannot be empty.', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/users/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to create account.');
            }

            const data = await response.json();
            showNotification(data.message, 'success');
            handleLogin();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    async function handleSaveBook() {
        if (!currentUser) {
            showNotification('You must be logged in to save a book.', 'warning');
            return;
        }

        if (!activeBook) {
            showNotification('No active book to save.', 'warning');
            return;
        }

        let bookData = {};
        let isUpdatingOnlineBook = activeBook.source === 'online';

        if (isUpdatingOnlineBook) {
            bookData.content = textDisplay.textContent;
        } else { // Saving a local book to online
            bookData.title = activeBook.title;
            bookData.content = localBooks[activeBook.id].text;
        }

        try {
            const url = isUpdatingOnlineBook 
                ? `/api/users/${currentUser}/books/${activeBook.id}`
                : `/api/users/${currentUser}/books`;

            const method = isUpdatingOnlineBook ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save the book.');
            }

            const data = await response.json();
            showNotification(data.message, 'success');
            
            // Update UI
            saveBookBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
            fetchAndRenderOnlineBooks();

            if (!isUpdatingOnlineBook) {
                // If a local book was saved, remove it from local list
                delete localBooks[activeBook.id];
                saveLocalBooks();
                renderLocalBooks();
                activeBook = null;
            }

        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    async function deleteOnlineBook(bookId) {
        showBookModal(
            `Delete Book?`,
            'Delete',
            async () => {
                try {
                    const response = await fetch(`/api/users/${currentUser}/books/${bookId}`, {
                        method: 'DELETE',
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || 'Failed to delete the book.');
                    }

                    const data = await response.json();
                    showNotification(data.message, 'success');

                    // Remove from UI
                    onlineBooks = onlineBooks.filter(book => book.id !== bookId);
                    renderOnlineBooks();

                    if (activeBook && activeBook.id === bookId) {
                        activeBook = null;
                        resetBookView();
                    }

                } catch (error) {
                    showNotification(error.message, 'error');
                }
                hideBookModal();
            },
            { showInput: false }
        );
    }

    function renameOnlineBook(book) {
        showBookModal(
            'Rename Book',
            'Rename',
            async () => {
                const newTitle = bookTitleInput.value;
                if (newTitle && newTitle.trim() !== '' && newTitle !== book.title) {
                    try {
                        const response = await fetch(`/api/users/${currentUser}/books/${book.id}`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ title: newTitle.trim() }),
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.detail || 'Failed to rename the book.');
                        }

                        const data = await response.json();
                        showNotification(data.message, 'success');

                        // Update UI
                        const bookToUpdate = onlineBooks.find(b => b.id === book.id);
                        if (bookToUpdate) {
                            bookToUpdate.title = newTitle.trim();
                            renderOnlineBooks();
                            if (activeBook && activeBook.id === book.id) {
                                bookPageTitle.innerHTML = newTitle.trim();
                            }
                        }

                    } catch (error) {
                        showNotification(error.message, 'error');
                    }
                }
                hideBookModal();
            },
            { showInput: true, inputValue: book.title }
        );
    }

    // Check for logged in user on page load
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        updateCurrentUserUI(currentUser);
        fetchAndRenderOnlineBooks();
    }

    loginActionBtn.addEventListener('click', handleLogin);
    createAccountBtn.addEventListener('click', handleCreateAccount);
    logoutBtn.addEventListener('click', handleLogout);
    saveBookBtn.addEventListener('click', handleSaveBook);

    // Show save book button when text is loaded
    const originalLoadBookContent = loadBookContent;
    loadBookContent = async (book) => {
        await originalLoadBookContent(book);
        if (currentUser) {
            saveBookBtn.classList.remove('hidden');
        }
    };

    pdfFileInput.addEventListener('change', async (e) => {
        if (currentUser) {
            saveBookBtn.classList.remove('hidden');
        }
    });
});