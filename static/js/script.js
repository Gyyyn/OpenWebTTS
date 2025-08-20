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
    }

    function renderBooks() {
        bookList.innerHTML = '';
        for (const bookId in books) {
            const book = books[bookId];
            const li = document.createElement('li');
            li.className = `flex justify-between items-center cursor-pointer p-2 rounded ${bookId === activeBookId ? 'bg-blue-600' : 'hover:bg-gray-700'}`;
            
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
            renameBtn.className = 'hover:text-gray-300';
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                renameBook(bookId);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<ion-icon name="trash-outline"></ion-icon>';
            deleteBtn.className = 'hover:text-gray-300';
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

    function deleteBook(bookId) {
        if (confirm('Are you sure you want to delete this book?')) {
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
        }
    }

    function renameBook(bookId) {
        const book = books[bookId];
        if (!book) return;

        const newTitle = prompt('Enter new title for "' + book.title + '":', book.title);
        if (newTitle !== null && newTitle.trim() !== '' && newTitle !== book.title) {
            book.title = newTitle.trim();
            saveBooks();
            renderBooks();
            if (activeBookId === bookId) {
                bookPageTitle.innerHTML = newTitle.trim();
            }
        }
    }

    function wrapWordsInSpans(text) {
        const words = text.trim().split(/\s+/);
        return words.map(word => `<span>${word} </span>`).join('');
    }

    async function loadBookContent(bookId) {
        if (books[bookId]) {
            bookPageTitle.innerHTML = books[bookId].title;
            textDisplay.innerHTML = wrapWordsInSpans(books[bookId].text);

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
        const bookId = `book-${Date.now()}`;
        const bookTitle = prompt('Enter book title:');
        if (bookTitle) {
            books[bookId] = { title: bookTitle, text: '', autoRead: false, pdfId: null };
            saveBooks();
            setActiveBook(bookId);
        }
    }

    function updateAutoReadCheckbox() {
        if (activeBookId && books[activeBookId]) {
            autoReadCheckbox.checked = books[activeBookId].autoRead;
        }
    }

    autoReadCheckbox.addEventListener('change', () => {
        if (activeBookId && books[activeBookId]) {
            books[activeBookId].autoRead = autoReadCheckbox.checked;
            saveBooks();
        }
    });

    newBookBtn.addEventListener('click', createNewBook);

    textDisplay.addEventListener('input', () => {
        if (activeBookId && books[activeBookId]) {
            books[activeBookId].text = textDisplay.textContent; // Save plain text
            textDisplay.innerHTML = wrapWordsInSpans(textDisplay.textContent); // Update display with spans
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
        for (let i = 0; i < words.length; i += chunkSize) {
            chunks.push(words.slice(i, i + chunkSize).join(' '));
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

        try {
            const response = await fetch('/api/synthesize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ engine, voice, text }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to generate speech.');
            }

            const data = await response.json();
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

        audioPlayer.onended = () => {
            playAudioQueue();
        };
    }

    async function startSpeechGeneration() {
        const text = textDisplay.textContent.trim();
        const chunks = splitTextIntoChunks(text);

        if (chunks.length === 0) {
            return;
        }

        loadingDiv.classList.remove('hidden'); // Spinner shows
        generateBtn.disabled = true;

        for (const chunk of chunks) {
            const audioUrl = await generateSpeech(chunk);
            if (audioUrl) {
                audioQueue.push({ url: audioUrl, text: chunk });
                if (!isPlaying && audioQueue.length === 1) {
                    playAudioQueue();
                    loadingDiv.classList.add('hidden'); // Hide spinner
                    audioOutput.classList.remove('hidden'); // Show controls
                }
            }
        }

        generateBtn.disabled = false;
    }

    function highlightWords(text, duration) {
        clearAllHighlights(); // Ensure all previous highlights are cleared

        const allWordElements = textDisplay.querySelectorAll('span');
        allWordElements.forEach(span => span.classList.add('highlight'));

        // No need for timeupdate listener for this simple chunk highlighting
        audioPlayer.removeEventListener('timeupdate', window.highlightTimeUpdateListener);
        window.highlightTimeUpdateListener = null;
    }

    function clearAllHighlights() {
        const allWordElements = textDisplay.querySelectorAll('span');
        allWordElements.forEach(span => span.classList.remove('highlight'));
        // Remove the timeupdate listener when clearing highlights
        if (window.highlightTimeUpdateListener) {
            audioPlayer.removeEventListener('timeupdate', window.highlightTimeUpdateListener);
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
        
        textDisplay.innerHTML = '';
        const words = pageText.trim().split(/\s+/);
        words.forEach(word => {
            const span = document.createElement('span');
            span.textContent = word + ' ';
            textDisplay.appendChild(span);
        });

        pageNumSpan.textContent = `Page ${num} of ${pdfDoc.numPages}`;
        localStorage.setItem(pdfDoc.fingerprint, num);

        prevPageBtn.disabled = num <= 1;
        nextPageBtn.disabled = num >= pdfDoc.numPages;

        if (activeBookId && books[activeBookId]) {
            books[activeBookId].text = textDisplay.innerHTML;
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

        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        if (fileExtension === 'pdf') {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target.result;
                const bookId = `book-${Date.now()}`;
                const bookTitle = file.name.replace('.pdf', '');

                books[bookId] = { title: bookTitle, text: '', autoRead: false, pdfId: bookId };
                saveBooks();
                setActiveBook(bookId);

                await savePdf(bookId, arrayBuffer);

                pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const lastPage = parseInt(localStorage.getItem(pdfDoc.fingerprint)) || 1;
                renderPage(lastPage);
            };
            reader.readAsArrayBuffer(file);
        } else if (fileExtension === 'epub') {
            const bookId = `book-${Date.now()}`;
            const bookTitle = file.name.replace('.epub', '');

            books[bookId] = { title: bookTitle, text: '', autoRead: false, pdfId: null }; // No pdfId for epub
            saveBooks();
            setActiveBook(bookId);

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
                books[bookId].text = data.text;
                saveBooks();
                textDisplay.innerHTML = wrapWordsInSpans(data.text);

                // Clear PDF specific elements
                pdfViewer.innerHTML = '';
                pageNumSpan.textContent = '';
                prevPageBtn.disabled = true;
                nextPageBtn.disabled = true;
                pdfDoc = null; // Clear PDF document reference

            } catch (error) {
                console.error('Error reading EPUB:', error);
                alert(`An error occurred: ${error.message}`);
                delete books[bookId]; // Clean up if error
                saveBooks();
                if (activeBookId === bookId) {
                    activeBookId = null;
                    localStorage.removeItem('activeBookId');
                }
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

    // Initial load
    renderBooks();
    if (activeBookId) {
        loadBookContent(activeBookId);
        updateAutoReadCheckbox();
    }
    updateVoices();
    disableAudioControls(); // Disable controls on initial load
});