// Import IndexedDB functions
import { savePdf, loadPdf, deletePdf } from './db.js';

// Import podcast generation
import { getPodcasts, generatePodcast, deletePodcast } from './podcast.js';

// Import Speech Generation functions
import { generateSpeech } from "./speechGen.js";

document.addEventListener('DOMContentLoaded', () => {
    const engineSelect = document.getElementById('engine');
    const voiceSelect = document.getElementById('voice');
    const generateBtn = document.getElementById('generate-btn');
    const generatePodcastBtn = document.getElementById('create-offline-podcast-btn');
    const generateBtnText = document.getElementById('generate-btn-text');
    const generateBtnIcon = document.getElementById('generate-btn-icon');
    const textInput = document.getElementById('text');
    const textDisplay = document.getElementById('text-display');
    const bookPageTitle = document.getElementById('book-title');
    const loadingDiv = document.getElementById('loading');
    const audioOutput = document.getElementById('audio-output');
    const audioPlayer = document.getElementById('audio-player');
    const pdfFileInput = document.getElementById('pdf-file');
    const pdfViewer = document.getElementById('pdf-viewer');
    const pdfViewerWrapper = document.getElementById('pdf-viewer-wrapper');
    const textboxViewerWrapper = document.getElementById('textbox-viewer-wrapper');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageNumSpan = document.getElementById('page-num');
    const toggleTwoPageBtn = document.getElementById('two-page-view-checkbox');
    const localBookList = document.getElementById('local-book-list');
    const onlineBookList = document.getElementById('online-book-list');
    const newBookBtn = document.getElementById('new-book-btn');
    const autoReadCheckbox = document.getElementById('auto-read-checkbox');
    const autoDeleteChunksCheckbox = document.getElementById('auto-delete-chunks-checkbox');
    const currentChunk = document.getElementById('current-chunk');
    const closeCurrentChunkButton = document.getElementById('close-current-chunk');
    const bookView = document.getElementById('book-view');
    const webPageLinkInput  = document.getElementById('web-page-url');
    const sidebar = document.getElementById('sidebar');
    const collapseSidebarButton = document.getElementById('collapse-sidebar-btn');
    const mainDiv = document.getElementById('main');

    // Modal Elements
    const bookModal = document.getElementById('book-modal');
    const modalTitle = document.getElementById('modal-title');
    const bookTitleInput = document.getElementById('book-title-input');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalActionBtn = document.getElementById('modal-action-btn');
    const playbackSpeed = document.getElementById('playback-speed');
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
    let onlinePodcasts = []; // New array to store online podcasts
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
    let isTwoPageView = true;
    let currentScale = 0.75; // Initial scale

    // Pagination
    let textCurrentPage = 1;
    const charsPerPage = 4000; // Characters per page for text content
    let totalTextPages = 1;
    let fullBookText = ''; // To store the entire text of a book
    let currentTextPageLength = 0; // To track text length for editing

    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');

    // Set workerSrc for PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

    // --- Functions

    function handleSidebarCollapse() {
        sidebar.classList.toggle('collapsed');
        collapseSidebarButton.classList.toggle('rotate-180');
        collapseSidebarButton.classList.toggle('cursor-[w-resize]');
        collapseSidebarButton.classList.toggle('cursor-[e-resize]')
        mainDiv.classList.toggle('ml-[260px]');
        mainDiv.classList.toggle('ml-[64px]');   
    }

    // Toolbar collapse, handled mainly by CSS
    collapseSidebarButton.addEventListener('click', function(e) {

        e.preventDefault();
        handleSidebarCollapse();

    });

    function saveLocalBooks() {
        localStorage.setItem('books', JSON.stringify(localBooks));
    }

    function setActiveBook(book) {
        // Make sure we stop playback and generation if we switch books.
        resetBookView();
        stopAudioQueue()
        activeBook = book;
        renderLocalBooks();
        renderOnlineBooks();
        loadBookContent(book);
        openFilePickerBtn.classList.add('hidden')
        if (book && book.source === 'local') {
            openFilePickerBtn.classList.remove('hidden')
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

    function renderOnlinePodcasts() {
        const podcastList = document.getElementById('podcast-list'); // Get the podcast list element
        podcastList.innerHTML = '';
        onlinePodcasts.forEach(podcast => {
            const li = document.createElement('li');
            li.className = 'relative p-2 rounded-lg hover:bg-gray-200'; // Added relative for absolute positioning of player
            li.title = `${podcast.title}`;

            const mainContentDiv = document.createElement('div');
            mainContentDiv.className = 'flex justify-between items-center whitespace-nowrap overflow-hidden text-ellipsis';
            mainContentDiv.addEventListener('click', () => {

                const playerDiv = li.querySelector(`#podcast-audio-player-${podcast.id}`);

                if (sidebar.classList.contains('collapsed')) {
                    handleSidebarCollapse();

                    // Wonky, but makes sure the audio player is always closed
                    if (!playerDiv.classList.contains('hidden')) {
                        playerDiv.classList.toggle('hidden');
                    }
                }

                if (playerDiv) {
                    playerDiv.classList.toggle('hidden');
                }
                setActiveBook(podcast);
            });

            const titleSpan = document.createElement('span');
            titleSpan.className = 'ms-2 text-xs hide-on-collapse';
            titleSpan.textContent = `${podcast.title} (${podcast.status})`;

            const containerSpan = document.createElement('span');
            containerSpan.classList = 'overflow-hidden cursor-pointer';

            const titleIcon = document.createElement('span');
            titleIcon.innerHTML = '<ion-icon name="mic-outline"></ion-icon>';

            containerSpan.prepend(titleIcon);
            containerSpan.append(titleSpan);

            mainContentDiv.appendChild(containerSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'ps-2 hide-on-collapse flex items-center space-x-2';

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<ion-icon name="trash-outline"></ion-icon>';
            deleteBtn.className = 'hover:text-gray-500';
            deleteBtn.title = 'Delete Podcast';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                showBookModal(
                    `Delete Podcast: ${podcast.title}?`,
                    'Delete',
                    async () => {
        
                        const result = await deletePodcast(currentUser, podcast.id);
                        if (result.success) {
                            showNotification(`Podcast '${podcast.title}' deleted.`, 'success');
                            fetchAndRenderPodcasts(); // Re-render the list
                        } else {
                            showNotification(`Failed to delete podcast: ${result.error}`, 'error');
                        }

                        hideBookModal();

                    },
                    { showInput: false }
                );
            });
            actionsDiv.appendChild(deleteBtn);
            mainContentDiv.appendChild(actionsDiv);
            li.appendChild(mainContentDiv);

            // Collapsible Audio Player
            const audioPlayerContainer = document.createElement('div');
            audioPlayerContainer.id = `podcast-audio-player-${podcast.id}`;
            audioPlayerContainer.className = 'mini-audio-player hidden mt-2 p-2 bg-gray-100 rounded-lg'; // Initially hidden

            if (podcast.status === 'ready' && podcast.audio_url) {
                const audioElem = document.createElement('audio');
                audioElem.src = podcast.audio_url;
                audioElem.preload = 'none'; // Only load metadata or nothing

                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'flex items-center space-x-2';

                const playPauseBtn = document.createElement('button');
                playPauseBtn.innerHTML = '<ion-icon name="play-outline"></ion-icon>';
                playPauseBtn.className = 'text-lg hover:text-gray-700';
                
                const progressSlider = document.createElement('input');
                progressSlider.type = 'range';
                progressSlider.min = '0';
                progressSlider.max = '100';
                progressSlider.value = '0';
                progressSlider.className = 'max-w-[50%] flex-grow h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-indigo-600';

                const timeDisplay = document.createElement('span');
                timeDisplay.className = 'text-xs text-gray-600 w-20 text-right';
                timeDisplay.textContent = '0:00 / 0:00';

                playPauseBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent li click from being triggered

                    // Ensure other players are paused
                    document.querySelectorAll('audio').forEach(otherAudio => {
                        if (otherAudio !== audioElem && !otherAudio.paused) {
                            otherAudio.pause();
                            const otherPlayerContainer = otherAudio.closest('[id^="podcast-audio-player-"]');
                            if (otherPlayerContainer) {
                                const otherPlayBtn = otherPlayerContainer.querySelector('button');
                                if (otherPlayBtn) {
                                    otherPlayBtn.innerHTML = '<ion-icon name="play-outline"></ion-icon>';
                                }
                            }
                        }
                    });

                    if (audioElem.paused) {
                        audioElem.play();
                        playPauseBtn.innerHTML = '<ion-icon name="pause-outline"></ion-icon>';
                        // Also ensure the player is visible if play is clicked
                        audioPlayerContainer.classList.remove('hidden');
                    } else {
                        audioElem.pause();
                        playPauseBtn.innerHTML = '<ion-icon name="play-outline"></ion-icon>';
                    }
                });

                audioElem.addEventListener('timeupdate', () => {
                    const progress = (audioElem.currentTime / audioElem.duration) * 100;
                    progressSlider.value = isNaN(progress) ? 0 : progress;
                    
                    const formatTime = (seconds) => {
                        const minutes = Math.floor(seconds / 60);
                        const secs = Math.floor(seconds % 60);
                        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
                    };
                    timeDisplay.textContent = `${formatTime(audioElem.currentTime)} / ${formatTime(audioElem.duration)}`;
                });

                audioElem.addEventListener('ended', () => {
                    playPauseBtn.innerHTML = '<ion-icon name="play-outline"></ion-icon>';
                    progressSlider.value = 0;
                    timeDisplay.textContent = '0:00 / 0:00';
                });

                audioElem.addEventListener('loadedmetadata', () => {
                    const formatTime = (seconds) => {
                        const minutes = Math.floor(seconds / 60);
                        const secs = Math.floor(seconds % 60);
                        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
                    };
                    timeDisplay.textContent = `0:00 / ${formatTime(audioElem.duration)}`;
                });

                progressSlider.addEventListener('input', () => {
                    const seekTime = (progressSlider.value / 100) * audioElem.duration;
                    audioElem.currentTime = seekTime;
                });

                controlsDiv.appendChild(playPauseBtn);
                controlsDiv.appendChild(progressSlider);
                controlsDiv.appendChild(timeDisplay);
                audioPlayerContainer.appendChild(controlsDiv);

                // Compress Button (TODO)
                const compressBtn = document.createElement('button');
                compressBtn.innerHTML = '<ion-icon name="contract-outline"></ion-icon>';
                compressBtn.className = 'hover:text-gray-500';
                compressBtn.title = 'Compress Podcast';

                actionsDiv.prepend(compressBtn);

            } else if (podcast.status === 'failed') {

                // Retry Button (TODO)
                const retryBtn = document.createElement('button');
                retryBtn.innerHTML = '<ion-icon name="reload-outline"></ion-icon>';
                retryBtn.className = 'hover:text-gray-500';
                retryBtn.title = 'Retry Podcast';

                actionsDiv.prepend(retryBtn);
                
            } else {
                audioPlayerContainer.innerHTML = '<span class="text-gray-500">Podcast audio not ready.</span>';
            }
            
            li.appendChild(audioPlayerContainer);
            podcastList.appendChild(li);
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
        li.className = `flex justify-between items-center cursor-pointer p-2 rounded-lg whitespace-nowrap overflow-hidden text-ellipsis ${isActive ? 'bg-indigo-100' : 'hover:bg-gray-200'}`;
        li.title = `${book.title}`;

        const titleSpan = document.createElement('span');
        titleSpan.className = `ms-2 text-xs hide-on-collapse`;
        titleSpan.textContent = book.title;
        li.addEventListener('click', () => {
            setActiveBook({ ...book, source });
        });

        const containerSpan = document.createElement('span');
        containerSpan.classList = 'overflow-hidden';

        const titleIcon = document.createElement('span');
        titleIcon.innerHTML = '<ion-icon name="chatbubbles-outline"></ion-icon>';

        containerSpan.prepend(titleIcon);
        containerSpan.append(titleSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'ps-2 flex items-center space-x-2 hide-on-collapse';

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
        li.appendChild(containerSpan);
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

    // Add event listener for keydown events on the document
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            // Trigger the modalActionBtn click event
            if (!bookModal.classList.contains('hidden')) {
                modalActionBtn.click();
            }
        } else if (event.key === 'Escape') {
            // Trigger the modalCancelBtn click event
            if (!bookModal.classList.contains('hidden')) {
                modalCancelBtn.click();
            }
        }
    });

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

    // Original loadBookContent function is renamed to handle specific loading logic
    let originalLoadBookContent = async (book) => {
        if (book) {
            bookPageTitle.innerHTML = book.title;
            const content = book.source === 'online' ? book.content : localBooks[book.id].text;
            
            // Text Pagination Logic
            fullBookText = content || '';
            totalTextPages = Math.max(1, Math.ceil(fullBookText.length / charsPerPage));
            textCurrentPage = 1;

            bookView.classList.remove('hidden');
            currentChunkIndex = 0; // Reset chunk index
            autoDeleteChunksCheckbox.disabled = false;
            toggleTwoPageBtn.disabled = true;

            if (book.source === 'local' && localBooks[book.id].pdfId) {
                const pdfData = await loadPdf(localBooks[book.id].pdfId);
                if (pdfData) {
                    pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
                    const lastPage = parseInt(localStorage.getItem(pdfDoc.fingerprint)) || 1;
                    renderPage(lastPage);
                    autoDeleteChunksCheckbox.disabled = true;
                    toggleTwoPageBtn.disabled = false;
                } else {
                    resetPdfView();
                    const lastTextPage = parseInt(localStorage.getItem(`text-page-${book.id}`)) || 1;
                    renderTextPage(lastTextPage);
                }
            } else {
                resetPdfView();
                const lastTextPage = parseInt(localStorage.getItem(`text-page-${book.id}`)) || 1;
                renderTextPage(lastTextPage);
            }
        }
    };
    
    // Wrapper for loadBookContent to add functionality
    let loadBookContent = async (book) => {

        if (isPlaying) {
            showNotification('Stop playback first!', 'warning');
            return;
        }

        await originalLoadBookContent(book);
        if (currentUser) {
            saveBookBtn.classList.remove('hidden');
        }
    };


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
        pdfViewerWrapper.classList.add('hidden');
        textboxViewerWrapper.classList.remove('hidden');
        pdfViewer.innerHTML = '';
        // pageNumSpan.textContent = ''; // Commented out to allow text pagination to control it
        // prevPageBtn.disabled = true; // These are now context-sensitive
        // nextPageBtn.disabled = true;
        pdfDoc = null;
        generateBtn.disabled = false;

        // When resetting PDF view, ensure PDF-specific controls are disabled
        toggleTwoPageBtn.disabled = true;
        zoomInBtn.disabled = true;
        zoomOutBtn.disabled = true;
    }

    function resetBookView() {
        generateBtn.disabled = false;
        textDisplay.textContent = '';
        currentChunk.childNodes[1].childNodes[1].textContent = '';
        currentChunk.classList.add('hidden');
        bookPageTitle.textContent = 'New Book';
        bookView.classList.add('hidden');
        textboxViewerWrapper.classList.remove('hidden');
        fullBookText = '';
        totalTextPages = 1;
        textCurrentPage = 1;
        pageNumSpan.textContent = '';
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
        if (activeBook && !pdfDoc) { // Only handle input for text-based content
            const newPageText = textDisplay.textContent;
            const start = (textCurrentPage - 1) * charsPerPage;

            // Reconstruct the full text by replacing the edited part
            fullBookText = fullBookText.substring(0, start) +
                           newPageText +
                           fullBookText.substring(start + currentTextPageLength);
            
            // Update the stored length for subsequent edits on the same page
            currentTextPageLength = newPageText.length;

            if (activeBook.source === 'local') {
                localBooks[activeBook.id].text = fullBookText;
                saveLocalBooks();
            } else { // Online book
                // For online books, just enable the save button to indicate changes
                saveBookBtn.classList.remove('hidden');
                saveBookBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
            }
            // Recalculate total pages and update display
            totalTextPages = Math.max(1, Math.ceil(fullBookText.length / charsPerPage));
            pageNumSpan.textContent = `Page ${textCurrentPage} of ${totalTextPages}`;
            nextPageBtn.disabled = textCurrentPage >= totalTextPages;

            // Update chunks for speech generation from the edited page text
            allTextChunks = splitTextIntoChunks(newPageText);
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
        stopBtn.disabled = false;
        playbackSpeed.disabled = false;
        generateBtn.disabled = false;
    }

    function disableAudioControls() {
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
            currentTextIndex += chunkText.length + 1; // Add 1 for the space
        }
        return chunks;
    }

    async function playAudioQueue() {
        if (isPaused) return;

        if (!audioQueue[currentChunkIndex]) {
            // This case can be hit if the buffer is empty. We just wait.
            // Playback will be triggered by processAndQueueChunk when the audio arrives.
            isPlaying = false;
            disableAudioControls();
            generateBtnText.textContent = 'Generate Speech';
            generateBtnIcon.name = 'volume-high-outline';
            return;
        }

        isPlaying = true;
        isPaused = false;
        enableAudioControls();

        generateBtnText.textContent = 'Pause';
        generateBtnIcon.name = 'pause-outline';
        generateBtnText.classList.remove('hidden');
        generateBtnIcon.classList.remove('hidden');
        loadingDiv.classList.add('hidden');
        generateBtn.disabled = false;

        const currentAudio = audioQueue[currentChunkIndex];
        highlightChunk(currentAudio.text);

        const shouldAutoDelete = (activeBook && activeBook.source === 'local') && localBooks[activeBook.id].autoDeleteChunks;
        if (!shouldAutoDelete && currentChunk && currentChunk.childNodes[1] && currentChunk.childNodes[1].childNodes[1]) {
            currentChunk.childNodes[1].childNodes[1].textContent = currentAudio.text.text;
            currentChunk.classList.remove('hidden');
        }

        audioPlayer.src = currentAudio.url;
        audioPlayer.playbackRate = playbackSpeed.value;
        audioPlayer.play();

        audioPlayer.onended = async () => {
            unhighlightChunk(currentAudio.text);
            currentChunk.classList.add('hidden');
            
            currentChunkIndex++;
            processAndQueueChunk(currentChunkIndex + 2); // Pre-fetch next-next chunk

            if (audioQueue[currentChunkIndex]) {
                playAudioQueue();
            } else {

                isPlaying = false;
                disableAudioControls();
                disableAudioControls();
                clearAllHighlights();

                // Auto-Read Next Page Logic
                if (autoReadCheckbox.checked && (currentChunkIndex >= allTextChunks.length)) {
                    
                    const isPdfTwoPageLimit = isTwoPageView ? pdfDoc.numPages - 1 : pdfDoc.numPages;
                    if (pdfDoc && currentPageNum < isPdfTwoPageLimit) {
                        const nextPage = currentPageNum + (isTwoPageView ? 2 : 1);
                        renderPage(nextPage).then(() => {
                            startSpeechGeneration();
                        });
                    } else if (!pdfDoc && textCurrentPage < totalTextPages) {
                        renderTextPage(textCurrentPage + 1);
                        setTimeout(startSpeechGeneration, 100); // Allow text to update
                    }
                    
                    return;

                }
                    
                console.log("Buffer empty, waiting for network...");
                generateBtnText.textContent = 'Generate Speech';
                generateBtnIcon.name = 'volume-high-outline';
            }
        };
    }

    async function stopAudioQueue() {
        // New Auto-Delete Logic on Stop ----
        const shouldAutoDelete = activeBook && activeBook.source === 'local' && localBooks[activeBook.id].autoDeleteChunks;
        if (shouldAutoDelete && currentChunkIndex > 0 && !pdfDoc) {
            const pageStartIndex = (textCurrentPage - 1) * charsPerPage;
            const firstRemainingChunk = allTextChunks[currentChunkIndex];
            const cutOffOnPage = firstRemainingChunk ? firstRemainingChunk.startIndex : textDisplay.textContent.length;
            const absoluteCutOff = pageStartIndex + cutOffOnPage;
    
            fullBookText = fullBookText.substring(absoluteCutOff);
            localBooks[activeBook.id].text = fullBookText;
            saveLocalBooks();
    
            isPlaying = false;
            isPaused = false;
            audioPlayer.pause();
            audioPlayer.src = '';
            audioQueue = [];
    
            // Reload the book content to reflect deletion
            loadBookContent({ ...activeBook }); // Pass a copy to ensure it re-triggers logic
            return; // Exit early as loadBookContent handles UI reset
        }
        // ---- END: New Auto-Delete Logic on Stop ----

        currentChunk.classList.add('hidden');
        isPlaying = false;
        isPaused = false;
        audioQueue = [];
        audioPlayer.pause();
        audioPlayer.src = '';
        generateBtn.disabled = false;
        generateBtnText.classList.remove('hidden');
        generateBtnIcon.classList.remove('hidden');
        loadingDiv.classList.add('hidden');
        generateBtnText.textContent = 'Generate Speech';
        generateBtnIcon.name = 'volume-high-outline';
        disableAudioControls();
        textDisplay.textContent = allTextChunks.map(c => c.text).join(' '); // Revert to plain text for the page
    }

    async function startSpeechGeneration() {
        const text = textDisplay.textContent.trim();
        allTextChunks = splitTextIntoChunks(text);
        
        currentChunkIndex = 0;
        lastChunkProcessed = -1;

        if (allTextChunks.length === 0) {
            return;
        }

        generateBtn.disabled = true;
        generateBtnText.classList.add('hidden');
        generateBtnIcon.classList.add('hidden');
        loadingDiv.classList.remove('hidden');

        audioQueue = [];
        isPlaying = false;
        isPaused = false;

        const initialBufferSize = Math.min(3, allTextChunks.length);
        for (let i = 0; i < initialBufferSize; i++) {
            processAndQueueChunk(i);
        }

        audioOutput.classList.remove('hidden');
    }

    function processAndQueueChunk(chunkIndex) {
        if (chunkIndex >= allTextChunks.length || chunkIndex < 0) {
            return;
        }

        const chunk = allTextChunks[chunkIndex];
        
        generateSpeech(chunk, engineSelect.value, voiceSelect.value).then(audioUrl => {
            if (audioUrl) {
                console.debug(`✅ Audio received for chunk index: ${chunkIndex}`);
                audioQueue[chunkIndex] = { url: audioUrl, text: chunk };

                // If playback isn't running and this is the chunk we're waiting for, start playing.
                if (!isPlaying && chunkIndex === currentChunkIndex) {
                    playAudioQueue();
                }
            } else {
                console.debug(`❌ Failed to get audio for chunk index: ${chunkIndex}`);
            }
        });
    }

    function clearAllHighlights() {
        const allWordElements = textDisplay.querySelectorAll('span.highlight');
        allWordElements.forEach(span => span.classList.remove('highlight'));
    }

    // ---- START: New function to render a page of text ----
    function renderTextPage(num) {
        textCurrentPage = num;
        const start = (num - 1) * charsPerPage;
        const end = start + charsPerPage;
        const pageText = fullBookText.substring(start, end);

        currentTextPageLength = pageText.length; // Store for editing
        textDisplay.textContent = pageText; // Display only the slice of text
        allTextChunks = splitTextIntoChunks(pageText); // Prepare chunks for speech
        currentChunkIndex = 0;

        // Update UI for text pagination
        pageNumSpan.textContent = `Page ${num} of ${totalTextPages}`;
        prevPageBtn.disabled = num <= 1;
        nextPageBtn.disabled = num >= totalTextPages;

        if (activeBook) {
            localStorage.setItem(`text-page-${activeBook.id}`, num);
        }

        // Ensure we are in text view mode
        pdfViewerWrapper.classList.add('hidden');
        textboxViewerWrapper.classList.remove('hidden');

        // Disable PDF-specific controls
        toggleTwoPageBtn.disabled = true;
        zoomInBtn.disabled = true;
        zoomOutBtn.disabled = true;
    }
    // ---- END: New function to render a page of text ----

    async function renderPage(num) {
        if (!pdfDoc) return;
        pdfViewerWrapper.classList.remove('hidden');
        textboxViewerWrapper.classList.add('hidden');

        // Enable PDF-specific controls
        toggleTwoPageBtn.disabled = false;
        zoomInBtn.disabled = false;
        zoomOutBtn.disabled = false;

        currentPageNum = num;
        pdfViewer.innerHTML = '';

        const renderSinglePage = async (pageNumber, container) => {
            const page = await pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: currentScale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            container.appendChild(canvas);

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            await page.render(renderContext).promise;

            const textContent = await page.getTextContent();
            return textContent.items.map(item => item.str).join(' ');
        };

        if (isTwoPageView) {
            const page1Text = await renderSinglePage(num, pdfViewer);
            let page2Text = '';

            if (num + 1 <= pdfDoc.numPages) {
                page2Text = await renderSinglePage(num + 1, pdfViewer);
            }

            const combinedText = page1Text + ' ' + page2Text;
            allTextChunks = splitTextIntoChunks(combinedText);
            textDisplay.textContent = combinedText;

            pageNumSpan.textContent = `Pages ${num}-${Math.min(num + 1, pdfDoc.numPages)} of ${pdfDoc.numPages}`;
            nextPageBtn.disabled = num >= pdfDoc.numPages - 1;

        } else {
            const pageText = await renderSinglePage(num, pdfViewer);
            allTextChunks = splitTextIntoChunks(pageText);
            textDisplay.textContent = pageText;

            pageNumSpan.textContent = `Page ${num} of ${pdfDoc.numPages}`;
            nextPageBtn.disabled = num >= pdfDoc.numPages;
        }

        currentChunkIndex = 0;
        localStorage.setItem(pdfDoc.fingerprint, num);
        prevPageBtn.disabled = num <= 1;

        if (activeBook && activeBook.source === 'local') {
            localBooks[activeBook.id].text = textDisplay.textContent;
            saveLocalBooks();
        }
    }

    playbackSpeed.addEventListener('input', () => {
        audioPlayer.playbackRate = playbackSpeed.value;
    });

    stopBtn.addEventListener('click', stopAudioQueue);

    webPageLinkInput.addEventListener('change', async (e) => {
        const url = webPageLinkInput.value;

        if (!url) return;

        webPageLinkInput.disabled = true;

        try {
            new URL(url);
        } catch (error) {
            alert('Please enter a valid URL.');
            return;
        }

        try {
            const response = await fetch('/api/read_website', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();

            textDisplay.value = data.text;
            
            if (activeBook.source === 'local') {
                localBooks[activeBook.id].text = data.text;
                saveLocalBooks();
            }
            
            // Make sure the page is updated.
            renderTextPage(1);

        } catch (error) {
            console.error('Error reading website:', error);
            alert(`Failed to read website: ${error.message}`);
        }

        webPageLinkInput.disabled = false;
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

        if (activeBook.source === 'local') {
            localBooks[activeBook.id].title = fileName.replace(`.${fileExtension}`, '');
            bookPageTitle.innerHTML = localBooks[activeBook.id].title;
        }

        if (fileExtension === 'pdf') {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target.result;
                if (activeBook.source === 'local') {
                    if (localBooks[activeBook.id].pdfId) {
                        await deletePdf(localBooks[activeBook.id].pdfId);
                    }
                    localBooks[activeBook.id].pdfId = activeBook.id;
                    localBooks[activeBook.id].text = '';
                    saveLocalBooks();
                    allTextChunks = [];
                    currentChunkIndex = 0;
                    
                    await savePdf(activeBook.id, arrayBuffer);
                    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    const lastPage = parseInt(localStorage.getItem(pdfDoc.fingerprint)) || 1;
                    renderPage(lastPage);
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (fileExtension === 'epub') {
            if (activeBook.source === 'local') {
                if (localBooks[activeBook.id].pdfId) {
                    await deletePdf(localBooks[activeBook.id].pdfId);
                }
                localBooks[activeBook.id].pdfId = null;
                saveLocalBooks();
            }

            loadingDiv.classList.remove('hidden');
            generateBtn.disabled = true;

            try {
                const formData = new FormData();
                formData.append('file', file);
                const response = await fetch('/api/read_epub', { method: 'POST', body: formData });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to read EPUB.');
                }
                const data = await response.json();
                
                // Load the full text and render the first page
                fullBookText = data.text;
                if (activeBook.source === 'local') {
                    localBooks[activeBook.id].text = fullBookText;
                    saveLocalBooks();
                }
                totalTextPages = Math.max(1, Math.ceil(fullBookText.length / charsPerPage));
                renderTextPage(1);

            } catch (error) {
                console.error('Error reading EPUB:', error);
                alert(`An error occurred: ${error.message}`);
                textDisplay.innerHTML = '';
            } finally {
                loadingDiv.classList.add('hidden');
                generateBtn.disabled = false;
            }
        } else {
            alert('Please select a valid PDF or EPUB file.');
        }
        
        hideFileModal();
    });

    // ---- START: Updated Pagination Button Listeners ----
    prevPageBtn.addEventListener('click', () => {
        if (pdfDoc) {
            if (currentPageNum <= 1) return;
            renderPage(currentPageNum - (isTwoPageView ? 2 : 1));
        } else {
            if (textCurrentPage <= 1) return;
            renderTextPage(textCurrentPage - 1);
        }
    });

    nextPageBtn.addEventListener('click', () => {
        if (pdfDoc) {
            const limit = isTwoPageView ? pdfDoc.numPages -1 : pdfDoc.numPages;
            if (currentPageNum >= limit) return;
            renderPage(currentPageNum + (isTwoPageView ? 2 : 1));
        } else {
            if (textCurrentPage >= totalTextPages) return;
            renderTextPage(textCurrentPage + 1);
        }
    });
    // ---- END: Updated Pagination Button Listeners ----

    toggleTwoPageBtn.addEventListener('click', () => {
        if (!pdfDoc) return;
        isTwoPageView = !isTwoPageView;
        renderPage(currentPageNum);
    });

    zoomInBtn.addEventListener('click', () => {
        if (!pdfDoc) return;
        currentScale += 0.25;
        renderPage(currentPageNum);
    });

    zoomOutBtn.addEventListener('click', () => {
        if (!pdfDoc) return;
        currentScale = Math.max(0.25, currentScale - 0.25);
        renderPage(currentPageNum);
    });

    engineSelect.addEventListener('change', updateVoices);
    generateBtn.addEventListener('click', () => {
        if (isPlaying) {
            if (isPaused) {
                isPaused = false;
                generateBtnText.textContent = 'Pause';
                generateBtnIcon.name = 'pause-outline';
                audioPlayer.play();
            } else {
                isPaused = true;
                generateBtnText.textContent = 'Play';
                generateBtnIcon.name = 'play-outline';
                audioPlayer.pause();
            }
        } else {
            startSpeechGeneration();
        }
    });

    modalCancelBtn.addEventListener('click', hideBookModal);

    openFilePickerBtn.addEventListener('click', showFileModal);
    closeFilePickerBtn.addEventListener('click', hideFileModal);
    
    filePickerModal.addEventListener('click', (e) => {
        if (e.target === filePickerModal) hideFileModal();
    });

    closeCurrentChunkButton.addEventListener('click', () => {
        currentChunk.textContent = '';
        currentChunk.classList.add('hidden');
    });

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/wav';
            
            mediaRecorder = new MediaRecorder(stream, { mimeType });
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                await transcribeAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            
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
            
            recordBtn.classList.remove('hidden');
            stopRecordBtn.classList.add('hidden');
            recordingIndicator.classList.add('hidden');
        }
    }

    async function transcribeAudio(audioBlob) {
        try {
            recordBtn.disabled = true;
            recordBtn.innerHTML = '<ion-icon class="animate-spin" name="refresh-outline"></ion-icon> Processing...';
            
            const formData = new FormData();
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
            
            if (data.text && data.text.trim()) {
                const currentText = textDisplay.textContent || '';
                const newText = currentText + (currentText ? '\n\n' : '') + data.text;
                textDisplay.textContent = newText;
                
                if (activeBook && activeBook.source === 'local') {
                    localBooks[activeBook.id].text = newText;
                    saveLocalBooks();
                    allTextChunks = splitTextIntoChunks(newText);
                    currentChunkIndex = 0;
                }
                
                showNotification(`Transcription completed! Detected language: ${data.language || 'Unknown'}`, 'success');
            } else {
                showNotification('No speech detected in the audio.', 'warning');
            }
            
        } catch (error) {
            console.error('Error transcribing audio:', error);
            showNotification(`Transcription failed: ${error.message}`, 'error');
        } finally {
            recordBtn.disabled = false;
            recordBtn.innerHTML = '<span class="me-2">Record Audio</span><ion-icon name="mic-outline"></ion-icon>';
        }
    }

    async function transcribeAudioFile(audioFile) {
        try {
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
            
            if (data.text && data.text.trim()) {
                const currentText = textDisplay.textContent || '';
                const newText = currentText + (currentText ? '\n\n' : '') + data.text;
                textDisplay.textContent = newText;
                
                if (activeBook && activeBook.source === 'local') {
                    localBooks[activeBook.id].text = newText;
                    saveLocalBooks();
                    allTextChunks = splitTextIntoChunks(newText);
                    currentChunkIndex = 0;
                }
                
                showNotification(`File transcription completed! Detected language: ${data.language || 'Unknown'}`, 'success');
            } else {
                showNotification('No speech detected in the audio file.', 'warning');
            }
            
        } catch (error) {
            console.error('Error transcribing audio file:', error);
            showNotification(`File transcription failed: ${error.message}`, 'error');
        } finally {
            transcribeFileBtn.disabled = false;
            transcribeFileBtn.innerHTML = '<span class="me-2">Transcribe File</span><ion-icon name="document-text-outline"></ion-icon>';
        }
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            type === 'warning' ? 'bg-yellow-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    recordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    
    transcribeFileBtn.addEventListener('click', () => audioFileInput.click());
    
    audioFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await transcribeAudioFile(file);
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
        if (e.target === loginModal) hideLoginModal();
    });

    const commandPaletteModal = document.getElementById('command-palette-modal');
    const commandPaletteInput = document.getElementById('command-palette-input');
    const commandList = document.getElementById('command-list');

    const commands = [
        { name: 'New Book', description: 'Create a new temporary book', action: () => { createNewBook(); hideCommandPalette(); } },
        { name: 'Import File', description: 'Import a PDF or EPUB file', action: () => { showFileModal(); hideCommandPalette(); } },
        { name: 'Generate Speech', description: 'Generate speech for the current text', action: () => { startSpeechGeneration(); hideCommandPalette(); } },
        { name: 'Stop Playback', description: 'Stop current audio playback', action: () => { stopAudioQueue(); hideCommandPalette(); } },
        { name: 'Record Audio', description: 'Start recording audio for transcription', action: () => { startRecording(); hideCommandPalette(); } },
        { name: 'Transcribe Audio File', description: 'Transcribe an audio file', action: () => { audioFileInput.click(); hideCommandPalette(); } },
        { name: 'Login/Create Account', description: 'Login or create a new user account', action: () => { showLoginModal(); hideCommandPalette(); } },
        { name: 'Save Book (Online)', description: 'Save the current book to your online account', action: () => { handleSaveBook(); hideCommandPalette(); } },
        { name: 'Toggle Two-Page View', description: 'Toggle between single and two-page PDF view', action: () => { toggleTwoPageBtn.click(); hideCommandPalette(); } },
        { name: 'Zoom In PDF', description: 'Increase zoom level of PDF', action: () => { zoomInBtn.click(); hideCommandPalette(); } },
        { name: 'Zoom Out PDF', description: 'Decrease zoom level of PDF', action: () => { zoomOutBtn.click(); hideCommandPalette(); } },
        { name: 'Previous PDF Page', description: 'Go to the previous page in PDF viewer', action: () => { prevPageBtn.click(); hideCommandPalette(); } },
        { name: 'Next PDF Page', description: 'Go to the next page in PDF viewer', action: () => { nextPageBtn.click(); hideCommandPalette(); } },
    ];

    let filteredCommands = [];
    let selectedCommandIndex = -1;

    function showCommandPalette() {
        commandPaletteModal.classList.remove('hidden');
        commandPaletteInput.value = '';
        filterCommands('');
        commandPaletteInput.focus();
        selectedCommandIndex = -1;
    }

    function hideCommandPalette() {
        commandPaletteModal.classList.add('hidden');
    }

    function filterCommands(query) {
        const lowerCaseQuery = query.toLowerCase();
        filteredCommands = commands.filter(command =>
            command.name.toLowerCase().includes(lowerCaseQuery) ||
            command.description.toLowerCase().includes(lowerCaseQuery)
        );
        renderCommands();
    }

    function renderCommands() {
        commandList.innerHTML = '';
        if (filteredCommands.length === 0) {
            const li = document.createElement('li');
            li.className = 'p-2 text-gray-500';
            li.textContent = 'No commands found.';
            commandList.appendChild(li);
            return;
        }

        filteredCommands.forEach((command, index) => {
            const li = document.createElement('li');
            li.className = `p-2 cursor-pointer hover:bg-indigo-100 rounded-lg ${index === selectedCommandIndex ? 'bg-indigo-200' : ''}`;
            li.innerHTML = `
                <div class="font-medium text-gray-800">${command.name}</div>
                <div class="text-sm text-gray-500">${command.description}</div>
            `;
            li.addEventListener('click', () => command.action());
            commandList.appendChild(li);
        });

        if (selectedCommandIndex >= 0 && selectedCommandIndex < filteredCommands.length) {
            const selectedItem = commandList.children[selectedCommandIndex];
            if (selectedItem) selectedItem.scrollIntoView({ block: 'nearest' });
        }
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (commandPaletteModal.classList.contains('hidden')) showCommandPalette();
            else hideCommandPalette();
        }

        if (!commandPaletteModal.classList.contains('hidden')) {
            if (e.key === 'Escape') hideCommandPalette();
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedCommandIndex = Math.max(0, selectedCommandIndex - 1);
                renderCommands();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedCommandIndex = Math.min(filteredCommands.length - 1, selectedCommandIndex + 1);
                renderCommands();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedCommandIndex !== -1) {
                    filteredCommands[selectedCommandIndex].action();
                } else if (filteredCommands.length > 0 && commandPaletteInput.value.trim() !== '') {
                    filteredCommands[0].action();
                }
            }
        }
    });

    commandPaletteInput.addEventListener('input', (e) => {
        filterCommands(e.target.value);
        selectedCommandIndex = -1;
    });

    commandPaletteModal.addEventListener('click', (e) => {
        if (e.target === commandPaletteModal) hideCommandPalette();
    });

    renderLocalBooks();
    updateVoices();
    disableAudioControls();

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
            if (!response.ok) throw new Error('Failed to fetch online books.');
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
                headers: { 'Content-Type': 'application/json' },
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
            fetchAndRenderPodcasts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    function handleLogout() {
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        onlineBooks = [];
        onlinePodcasts = [];
        renderOnlineBooks();
        renderOnlinePodcasts();
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
                headers: { 'Content-Type': 'application/json' },
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
            bookData.content = fullBookText; // Use full text
        } else {
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save the book.');
            }
            const data = await response.json();
            showNotification(data.message, 'success');
            
            saveBookBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
            fetchAndRenderOnlineBooks();

            if (!isUpdatingOnlineBook) {
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
                    const response = await fetch(`/api/users/${currentUser}/books/${bookId}`, { method: 'DELETE' });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || 'Failed to delete the book.');
                    }
                    const data = await response.json();
                    showNotification(data.message, 'success');

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
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: newTitle.trim() }),
                        });
                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.detail || 'Failed to rename the book.');
                        }
                        const data = await response.json();
                        showNotification(data.message, 'success');

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

    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        updateCurrentUserUI(currentUser);
        fetchAndRenderOnlineBooks();
        fetchAndRenderPodcasts();
    }

    loginActionBtn.addEventListener('click', handleLogin);
    createAccountBtn.addEventListener('click', handleCreateAccount);
    logoutBtn.addEventListener('click', handleLogout);
    saveBookBtn.addEventListener('click', handleSaveBook);

    generatePodcastBtn.addEventListener('click', () => {
        if (!currentUser) {
            showNotification('You must be logged in to generate a podcast.', 'warning');
            return;
        }
        const podcastText = fullBookText.trim(); // Use full text for podcast
        if (!podcastText) {
            showNotification('Please provide text for the podcast.', 'warning');
            return;
        }

        showBookModal(
            'Generate Podcast', 
            'Generate', 
            async () => {
                const podcastTitle = bookTitleInput.value.trim();
                if (!podcastTitle) {
                    showNotification('Podcast title cannot be empty.', 'warning');
                    return;
                }

                hideBookModal();
                generatePodcastBtn.disabled = true;
                generatePodcastBtn.innerHTML = '<ion-icon class="animate-spin" name="refresh-outline"></ion-icon> Generating...';

                const engine = engineSelect.value;
                const voice = voiceSelect.value;
                const apiKey = null;

                const result = await generatePodcast(currentUser, podcastTitle, podcastText, engine, voice, apiKey);

                if (result.success) {
                    showNotification(`Podcast '${podcastTitle}' generation started with ID: ${result.podcast_id}`, 'success');
                    fetchAndRenderPodcasts();
                } else {
                    showNotification(`Failed to start podcast generation: ${result.error}`, 'error');
                }
                generatePodcastBtn.disabled = false;
                generatePodcastBtn.innerHTML = '<ion-icon name="mic-outline" class="mr-2"></ion-icon><span class="me-2">Create Offline Podcast</span>';
            },
            { showInput: true, inputValue: activeBook ? activeBook.title : '' }
        );
    });

    async function fetchAndRenderPodcasts() {
        if (!currentUser) return;
        try {
            const result = await getPodcasts(currentUser);
            if (result.success) {
                onlinePodcasts = result.podcasts || [];
                renderOnlinePodcasts();
            } else {
                showNotification(`Failed to fetch podcasts: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    pdfFileInput.addEventListener('change', async (e) => {
        if (currentUser) {
            saveBookBtn.classList.remove('hidden');
        }
    });
});