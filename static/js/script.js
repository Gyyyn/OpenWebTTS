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
    const downloadLink = document.getElementById('download-link');
    const pdfFileInput = document.getElementById('pdf-file');
    const pdfViewer = document.getElementById('pdf-viewer');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumSpan = document.getElementById('page-num');
    const bookList = document.getElementById('book-list');
    const newBookBtn = document.getElementById('new-book-btn');
    const autoReadCheckbox = document.getElementById('auto-read-checkbox');
    const autoDeleteChunksCheckbox = document.getElementById('auto-delete-chunks-checkbox');

    // Modal Elements
    const bookModal = document.getElementById('book-modal');
    const modalTitle = document.getElementById('modal-title');
    const bookTitleInput = document.getElementById('book-title-input');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalActionBtn = document.getElementById('modal-action-btn');
    const playbackSpeed = document.getElementById('playback-speed');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');

    let pdfDoc = null;
    let currentPageNum = 1;
    let books = JSON.parse(localStorage.getItem('books')) || {};
    let activeBookId = localStorage.getItem('activeBookId') || null;
    let audioQueue = [];
    let isPlaying = false;
    let isPaused = false;
    let allTextChunks = [];
    let currentChunkIndex = 0;

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
        updateAutoReadCheckbox();
        updateAutoDeleteChunksCheckbox();
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

    function showBookModal(title, actionText, currentTitle = '', actionCallback) {
        modalTitle.textContent = title;
        bookTitleInput.value = currentTitle;
        modalActionBtn.textContent = actionText;
        modalActionBtn.onclick = actionCallback;
        bookTitleInput.style.display = 'block'; // Ensure input is visible by default
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
            '',
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
                    pdfViewer.innerHTML = ''; // Clear PDF viewer
                    pageNumSpan.textContent = ''; // Clear page number
                    prevPageBtn.disabled = true;
                    nextPageBtn.disabled = true;
                }
                renderBooks();
                hideBookModal();
            }
        );
        // Hide the input field for delete confirmation
        bookTitleInput.style.display = 'none';
    }

    function renameBook(bookId) {
        const book = books[bookId];
        if (!book) return;

        showBookModal(
            'Rename Book',
            'Rename',
            book.title,
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
            }
        );
    }

    function wrapWordsInSpans(chunks) {
        let html = '';
        chunks.forEach(chunk => {
            const words = chunk.text.split(/(\s+)/); // Split by spaces, keeping spaces
            words.forEach(word => {
                if (word.trim() !== '') { // Only wrap actual words
                    html += `<span data-chunk-id="${chunk.id}">${word}</span>`;
                } else {
                    html += word; // Keep spaces as they are
                }
            });
        });
        return html;
    }

    async function loadBookContent(bookId) {
        if (books[bookId]) {
            bookPageTitle.innerHTML = books[bookId].title;
            allTextChunks = splitTextIntoChunks(books[bookId].text);
            textDisplay.innerHTML = wrapWordsInSpans(allTextChunks);
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
            '',
            () => {
                const bookTitle = bookTitleInput.value;
                if (bookTitle) {
                    const bookId = `book-${Date.now()}`;
                    books[bookId] = { title: bookTitle, text: '', autoRead: false, autoDeleteChunks: false, pdfId: null };
                    saveBooks();
                    setActiveBook(bookId);
                }
                hideBookModal();
            }
        );
    }

    function updateAutoReadCheckbox() {
        if (activeBookId && books[activeBookId]) {
            autoReadCheckbox.checked = books[activeBookId].autoRead;
        }
    }

    function updateAutoDeleteChunksCheckbox() {
        if (activeBookId && books[activeBookId]) {
            autoDeleteChunksCheckbox.checked = books[activeBookId].autoDeleteChunks;
        }
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
            textDisplay.innerHTML = wrapWordsInSpans(allTextChunks); // Update display with new spans
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
        console.log('generateSpeech called with text:', text);
        const engine = engineSelect.value;
        const voice = voiceSelect.value;

        if (!text) {
            return;
        }
        if (!voice) {
            alert('Please select a voice.');
            return;
        }

        try {
            const response = await fetch('/api/synthesize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ engine, voice, text: text.text }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to generate speech.');
            }

            const data = await response.json();
            console.log('generateSpeech returning audio_url:', data.audio_url);
            return data.audio_url;
        } catch (error) {
            console.error('Error generating speech:', error);
            alert(`An error occurred: ${error.message}`);
        }
    }

    async function playAudioQueue() {
        if (isPaused) {
            return;
        }

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
        const currentAudio = audioQueue.shift();
        audioPlayer.src = currentAudio.url;
        audioPlayer.playbackRate = playbackSpeed.value;

        const onLoadedMetadata = () => {
            highlightWords(currentAudio.text, audioPlayer.duration);
            audioPlayer.removeEventListener('loadedmetadata', onLoadedMetadata);
        };
        audioPlayer.addEventListener('loadedmetadata', onLoadedMetadata);

        audioPlayer.play();
        console.log('Audio playback started.');

        audioPlayer.onended = async () => {
            console.log('Audio ended event fired.');
            const playedChunkId = currentAudio.text.id; // Define playedChunkId here
            if (activeBookId && books[activeBookId].autoDeleteChunks) {
                const spansToRemove = textDisplay.querySelectorAll(`span[data-chunk-id="${playedChunkId}"]`);
                spansToRemove.forEach(span => span.remove());
                console.log(`Removed spans for chunk: ${playedChunkId}`);

                // Update the stored text to reflect the deletion
                const remainingText = allTextChunks.filter(chunk => chunk.id !== playedChunkId).map(chunk => chunk.text).join(' ');
                books[activeBookId].text = remainingText;
                saveBooks();
            }
            console.log('Before incrementing currentChunkIndex.');
            currentChunkIndex++;
            if (currentChunkIndex < allTextChunks.length) {
                // Generate and add the next chunk to the queue
                await processNextChunk();
                // Then, play the next item in the queue
                playAudioQueue();
            } else {
                isPlaying = false;
                disableAudioControls();
                clearAllHighlights();
                if (autoReadCheckbox.checked && currentPageNum < pdfDoc.numPages) {
                    renderPage(currentPageNum + 1).then(() => {
                        startSpeechGeneration();
                    });
                }
            }
        };
    }

    async function startSpeechGeneration() {
        const text = textDisplay.textContent.trim();
        allTextChunks = splitTextIntoChunks(text);
        currentChunkIndex = 0;

        if (allTextChunks.length === 0) {
            return;
        }

        loadingDiv.classList.remove('hidden');
        generateBtn.disabled = true;
        audioQueue = []; // Clear previous queue
        isPlaying = false;
        isPaused = false;

        await processNextChunk();
        playAudioQueue(); // Start playback of the first chunk

        loadingDiv.classList.add('hidden');
        audioOutput.classList.remove('hidden');
    }

    async function processNextChunk() {
        console.log('Processing next chunk.');
        if (currentChunkIndex >= allTextChunks.length) {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
            return;
        }

        const chunk = allTextChunks[currentChunkIndex];
        console.log('Calling generateSpeech for chunk:', chunk);
        const audioUrl = await generateSpeech(chunk);
        console.log('generateSpeech returned audioUrl:', audioUrl);

        if (audioUrl) {
            console.log('Pushing audio to queue.');
            audioQueue.push({ url: audioUrl, text: chunk });
        } else {
            // If audio generation fails, we should still try to process the next chunk
            // or handle the error appropriately. For now, just log.
            console.error('Failed to generate audio for chunk:', chunk);
        }
    }

    function highlightWords(chunkObject, duration) {
        clearAllHighlights(); // Ensure all previous highlights are cleared

        const currentChunkId = chunkObject.id;
        const currentChunkSpans = textDisplay.querySelectorAll(`span[data-chunk-id="${currentChunkId}"]`);
        currentChunkSpans.forEach(span => span.classList.add('highlight'));

        // No need for timeupdate listener for this simple chunk highlighting
        audioPlayer.removeEventListener('loadedmetadata', window.highlightTimeUpdateListener);
        window.highlightTimeUpdateListener = null;
    }

    function clearAllHighlights() {
        const allWordElements = textDisplay.querySelectorAll('span.highlight');
        allWordElements.forEach(span => span.classList.remove('highlight'));
        // Remove the timeupdate listener when clearing highlights
        if (window.highlightTimeUpdateListener) {
            audioPlayer.removeEventListener('loadedmetadata', window.highlightTimeUpdateListener);
            window.highlightTimeUpdateListener = null; // Clear the reference
        }
        // Also clear any setInterval if it was still active (from previous implementation)
        if (window.highlightInterval) {
            clearInterval(window.highlightInterval);
            window.highlightInterval = null;
        }
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
        textDisplay.innerHTML = wrapWordsInSpans(allTextChunks);
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
        pauseBtn.innerHTML = '<ion-icon name="pause-outline"></ion-icon>'; // Reset pause button icon
        disableAudioControls(); // Disable controls on stop
        clearAllHighlights(); // Clear highlights on stop
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
                textDisplay.innerHTML = wrapWordsInSpans(allTextChunks);
                currentChunkIndex = 0; // Reset chunk index

                // Clear PDF specific elements
                pdfViewer.innerHTML = '';
                pageNumSpan.textContent = '';
                prevPageBtn.disabled = true;
                nextPageBtn.disabled = true;
                pdfDoc = null; // Clear PDF document reference

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

    // Initial load
    renderBooks();
    if (activeBookId) {
        loadBookContent(activeBookId);
        updateAutoReadCheckbox();
    }
    updateVoices();
    disableAudioControls(); // Disable controls on initial load
});