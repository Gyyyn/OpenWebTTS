document.addEventListener('DOMContentLoaded', () => {
    const engineSelect = document.getElementById('engine');
    const voiceSelect = document.getElementById('voice');
    const generateBtn = document.getElementById('generate-btn');
    const textInput = document.getElementById('text');
    const textDisplay = document.getElementById('text-display');
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

    let pdfDoc = null;
    let currentPageNum = 1;
    let books = JSON.parse(localStorage.getItem('books')) || {};
    let activeBookId = localStorage.getItem('activeBookId') || null;

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
            titleSpan.textContent = book.title;
            titleSpan.addEventListener('click', () => {
                setActiveBook(bookId);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'X';
            deleteBtn.className = 'text-red-500 hover:text-red-700';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteBook(bookId);
            });

            li.appendChild(titleSpan);
            li.appendChild(deleteBtn);
            bookList.appendChild(li);
        }
    }

    function deleteBook(bookId) {
        if (confirm('Are you sure you want to delete this book?')) {
            delete books[bookId];
            saveBooks();
            if (activeBookId === bookId) {
                activeBookId = null;
                localStorage.removeItem('activeBookId');
                textDisplay.innerHTML = '';
            }
            renderBooks();
        }
    }

    function loadBookContent(bookId) {
        if (books[bookId]) {
            textDisplay.innerHTML = books[bookId].text;
        }
    }

    function createNewBook() {
        const bookId = `book-${Date.now()}`;
        const bookTitle = prompt('Enter book title:');
        if (bookTitle) {
            books[bookId] = { title: bookTitle, text: '', autoRead: false };
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
            books[activeBookId].text = textDisplay.innerHTML;
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

    async function generateSpeech() {
        const engine = engineSelect.value;
        const voice = voiceSelect.value;
        const text = textDisplay.textContent.trim();

        if (!text) {
            alert('Please enter some text.');
            return;
        }
        if (!voice) {
            alert('Please select a voice.');
            return;
        }

        loadingDiv.classList.remove('hidden');
        audioOutput.classList.add('hidden');
        generateBtn.disabled = true;

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
            audioPlayer.src = data.audio_url;
            downloadLink.href = data.audio_url;
            audioOutput.classList.remove('hidden');
            
            audioPlayer.addEventListener('play', () => {
                highlightWords(text, audioPlayer.duration);
            });

            audioPlayer.play();

            audioPlayer.onended = () => {
                if (autoReadCheckbox.checked && currentPageNum < pdfDoc.numPages) {
                    renderPage(currentPageNum + 1).then(() => {
                        setTimeout(generateSpeech, 500);
                    });
                }
            };

        } catch (error) {
            console.error('Error generating speech:', error);
            alert(`An error occurred: ${error.message}`);
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
        }
    }

    function highlightWords(text, duration) {
        const words = text.split(/\s+/);
        const wordElements = textDisplay.querySelectorAll('span');
        const totalWords = words.length;
        const delay = (duration * 1000) / totalWords;

        let i = 0;
        const interval = setInterval(() => {
            if (i > 0) {
                wordElements[i - 1].classList.remove('highlight');
            }
            if (i < totalWords) {
                wordElements[i].classList.add('highlight');
            }
            i++;
            if (i > totalWords) {
                clearInterval(interval);
                if (wordElements.length > 0) {
                   wordElements[totalWords - 1].classList.remove('highlight');
                }
            }
        }, delay);
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

    pdfFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            const fileUrl = URL.createObjectURL(file);
            pdfDoc = await pdfjsLib.getDocument(fileUrl).promise;
            const lastPage = parseInt(localStorage.getItem(pdfDoc.fingerprint)) || 1;
            renderPage(lastPage);

            if (!activeBookId) {
                const bookId = `book-${Date.now()}`;
                books[bookId] = { title: file.name, text: '', autoRead: false };
                saveBooks();
                setActiveBook(bookId);
            }
        } else if (file) {
            alert('Please select a valid PDF file.');
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
    generateBtn.addEventListener('click', generateSpeech);

    // Initial load
    renderBooks();
    if (activeBookId) {
        loadBookContent(activeBookId);
        updateAutoReadCheckbox();
    }
    updateVoices();
});