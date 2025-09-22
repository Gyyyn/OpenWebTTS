/*
 * -- index.js
 * --
 * -- This file contains most of the UI for the main app.
 * -- It's structed "top to bottom", mirroring the HTML of index.html.
 *
 */

/*
 * Imports.
 */

// Import IndexedDB functions
import { savePdf, loadPdf, deletePdf } from './db.js';

// Import podcast generation
import { getPodcasts, generatePodcast, deletePodcast } from './podcast.js';

// Import Speech Generation functions
import { generateSpeech } from "./speechGen.js";

// Import helpers
import { checkPhraseSimilarity, detectHeadersAndFooters } from "./helpers.js";
import { createFilesGrid, renderUserPdfs } from './library.js';

document.addEventListener('DOMContentLoaded', () => {

    /*
     * Setup manipulated elements.
     */

    // Inputs
    const engineSelect = document.getElementById('engine');
    const voiceSelect = document.getElementById('voice');
    const pdfFileInput = document.getElementById('pdf-file');
    const webPageLinkInput  = document.getElementById('web-page-url');
    const textInput = document.getElementById('text');
    const playbackSpeed = document.getElementById('playback-speed');

    // Checkboxes
    const toggleTwoPageBtn = document.getElementById('two-page-view-checkbox');
    const autoReadCheckbox = document.getElementById('auto-read-checkbox');
    const autoDeleteChunksCheckbox = document.getElementById('auto-delete-chunks-checkbox');
    const skipHeadersNFootersCheckbox = document.getElementById('skip-headers-checkbox');

    // Buttons
    const collapseSidebarButton = document.getElementById('collapse-sidebar-btn');
    const newBookBtn = document.getElementById('new-book-btn');
    const libraryBtn = document.getElementById('library-btn');
    const commandsBtn = document.getElementById('commands-btn');
    const generatePodcastBtn = document.getElementById('create-offline-podcast-btn');
    const stopBtn = document.getElementById('stop-btn');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const generateBtn = document.getElementById('generate-btn');
    const generateBtnIcon = document.getElementById('generate-btn-icon');
    const closeCurrentChunkButton = document.getElementById('close-current-chunk');
    
    // Elements
    const sidebar = document.getElementById('sidebar');
    const localBookList = document.getElementById('local-book-list');
    const onlineBookList = document.getElementById('online-book-list');
    const mainDiv = document.getElementById('main');
    const bookView = document.getElementById('book-view');
    const bookPageTitle = document.getElementById('book-title');
    const pageNumSpan = document.getElementById('page-num');
    const textboxViewerWrapper = document.getElementById('textbox-viewer-wrapper');
    const textDisplay = document.getElementById('text-display'); // Main textarea from TTS.
    const pdfViewer = document.getElementById('pdf-viewer');
    const pdfViewerWrapper = document.getElementById('pdf-viewer-wrapper');
    const generateBtnText = document.getElementById('generate-btn-text');
    const loadingDiv = document.getElementById('loading');
    const audioOutput = document.getElementById('audio-output');
    const audioPlayer = document.getElementById('audio-player');
    const playbackSpeedDisplay = document.getElementById('playback-speed-display');
    const currentChunk = document.getElementById('current-chunk');

    // Modal Elements
    const bookModal = document.getElementById('book-modal');
    const modalTitle = document.getElementById('modal-title');
    const bookTitleInput = document.getElementById('book-title-input');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalActionBtn = document.getElementById('modal-action-btn');

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
    const filePickerModalURLLoadingIndicator = document.getElementById('url-loading-indicator');

    // Speech to Text Elements
    const recordBtn = document.getElementById('record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const recordingIndicator = document.getElementById('recording-indicator');
    const audioFileInput = document.getElementById('audio-file-input');
    const transcribeFileBtn = document.getElementById('transcribe-file-btn');

    // Book elements
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
    let localPrefs = JSON.parse(localStorage.getItem('prefs')) || {};
    let pdfTextContent = {}
    
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

    /*
     * --- Functions
     */

    // Toolbar collapse, handled mainly by CSS
    function handleSidebarCollapse() {
        sidebar.classList.toggle('collapsed');
        collapseSidebarButton.classList.toggle('rotate-180');
        collapseSidebarButton.classList.toggle('cursor-[w-resize]');
        collapseSidebarButton.classList.toggle('cursor-[e-resize]');

        if (sidebar.classList.contains('collapsed')) {
            mainDiv.classList.remove('md:ml-[260px]');
            mainDiv.classList.add('md:ml-[64px]');
        } else {
            mainDiv.classList.remove('md:ml-[64px]');
            mainDiv.classList.add('md:ml-[260px]');
        }
    }
  
    collapseSidebarButton.addEventListener('click', function(e) {
        e.preventDefault();
        handleSidebarCollapse();
    });

    // Set initial sidebar state based on screen width
    if (window.innerWidth < 768) { // Tailwind's `md` breakpoint
        if (!sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            collapseSidebarButton.classList.remove('rotate-180');
            collapseSidebarButton.classList.remove('cursor-[w-resize]');
            collapseSidebarButton.classList.add('cursor-[e-resize]');
        }
    } else {
        if (sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            collapseSidebarButton.classList.add('rotate-180');
            collapseSidebarButton.classList.add('cursor-[w-resize]');
            collapseSidebarButton.classList.remove('cursor-[e-resize]');
        }
    }

    function saveLocalBooks() {
        localStorage.setItem('books', JSON.stringify(localBooks));
    }

    function setActiveBook(book) {

        // Reset everything and stop playback.
        activeBook = book;
        resetBookView();
        stopAudioQueue()
        renderLocalBooks();
        renderOnlineBooks();

        if (!book) return;

        // Remove active bg from library.
        libraryBtn.classList.remove('bg-indigo-100');

        loadBookContent(book);
        openFilePickerBtn.classList.add('hidden')
        if (book && book.source === 'local') {
            openFilePickerBtn.classList.remove('hidden')
            updateCheckbox(autoReadCheckbox, 'autoRead');
            updateCheckbox(autoDeleteChunksCheckbox, 'autoDeleteChunks');
            updateCheckbox(skipHeadersNFootersCheckbox, 'skipHeadersNFooters');
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
                    playerDiv.classList.add('hidden');
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
        modalActionBtn.querySelector('span:first-child').textContent = actionText;
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
            if (!bookModal.classList.contains('hidden'))
            modalActionBtn.click();
        } else if (event.key === 'Escape') {
            if (!bookModal.classList.contains('hidden'))
            modalCancelBtn.click();
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

    let renderBookContent = async (book) => {
        if (!book) return;

        bookView.classList.remove('hidden');
        bookPageTitle.innerHTML = book.title;
        
        let bookContent = '';
        let isPdfBook = false;

        if (book.source === 'online' && book.is_pdf) {
            isPdfBook = true;
            bookContent = book.content; // This will be the path to the PDF on the server
        } else if (book.source === 'online') {
            bookContent = book.content;
        } else if (book.source === 'local') {
            bookContent = localBooks[book.id].text;
            if (localBooks[book.id].pdfId) {
                isPdfBook = true;
            }
        }

        // Text Pagination Logic
        fullBookText = bookContent || '';
        totalTextPages = Math.max(1, Math.ceil(fullBookText.length / charsPerPage));
        textCurrentPage = 1;

        bookView.classList.remove('hidden');
        currentChunkIndex = 0; // Reset chunk index
        autoDeleteChunksCheckbox.disabled = false;
        toggleTwoPageBtn.disabled = true;

        if (isPdfBook) {
            let pdfData;
            if (book.source === 'local') {
                pdfData = await loadPdf(localBooks[book.id].pdfId);
            } else if (book.source === 'online') {
                // Fetch PDF from server
                const response = await fetch(book.content); // book.content is the URL to the PDF
                if (!response.ok) {
                    throw new Error(`Failed to fetch PDF from ${book.content}`);
                }
                pdfData = await response.arrayBuffer();
            }

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
    };
    
    // Wrapper for loadBookContent to add functionality
    let loadBookContent = async (book) => {

        if (isPlaying) {
            showNotification('Stop playback first!', 'warning');
            return;
        }

        // Close library if it's open.
        const library = document.getElementById('library-file-grid');

        if (library) library.remove();

        await renderBookContent(book);
        if (currentUser && !book.is_pdf) { // Only show save button for non-PDF online books
            saveBookBtn.classList.remove('hidden');
        } else {
            saveBookBtn.classList.add('hidden');
        }
    };


    function createNewBook() {

        const randomTitles = [
            "An Expert's Guide to Knowing Absolutely Everything About Things I Just Googled",
            "The Life-Changing Magic of Leaving It for Tomorrow",
            "How to Win Friends and Alienate People with Your Unsolicited Advice",
            "I'm Listening: A Memoir About Waiting for My Turn to Speak",
            "Meditations on the Serenity of an Uncharged Phone Battery",
            "Achieving Peak Productivity Between the Hours of 2 and 4 AM",
            "The Subtle Art of Being Loudly Correct in Group Chats",
            "Why Your Opinion Matters (A Collection of Short Fictional Stories)",
            "Journey to the Center of My Own Comfort Zone",
            "Conquering Your Goals, As Soon As You Figure Out What They Are"
        ];

        const bookId = `book-${Date.now()}`;
        const randomIndex = Math.floor(Math.random() * randomTitles.length);
        const randomTitle = randomTitles[randomIndex];
        localBooks[bookId] = {
            title: randomTitle,
            text: '',
            autoRead: false,
            autoDeleteChunks:
            false,
            pdfId: null
        };

        saveLocalBooks();
        setActiveBook({ ...localBooks[bookId], id: bookId, source: 'local' });
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

    /*
     * -- Events
     */

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

    skipHeadersNFootersCheckbox.addEventListener('change', () => {
        if (activeBook && activeBook.source === 'local') {
            localBooks[activeBook.id].skipHeadersNFooters = skipHeadersNFootersCheckbox.checked;
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

            let endpoint = `/api/voices?engine=${engine}`;

            let apiKey = null;
            if (engine === 'gemini') {
                apiKey = localStorage.getItem('geminiApiKey');
                if (!apiKey) {
                    alert('Please set your Gemini API Key in the Config page.');
                }

                endpoint += `&api_key=${apiKey}`;
            }

            const response = await fetch(endpoint);
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

    function splitTextIntoChunks(text, chunkSize) {

        // Get local chunk size from prefs, default to 50 if not found or invalid
        const parsedChunkSize = parseInt(localPrefs.chunkSize);
        chunkSize = (!isNaN(parsedChunkSize) && parsedChunkSize > 0) ? parsedChunkSize : 50;

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

        if (pdfDoc) {
            await highlightPdfChunk(currentAudio.text);
        } else {
            highlightChunk(currentAudio.text); // Original behavior for text view
        }

        const shouldAutoDelete = (activeBook && activeBook.source === 'local') && localBooks[activeBook.id].autoDeleteChunks;
        
        if (!shouldAutoDelete && currentChunk && currentChunk.childNodes[1] && currentChunk.childNodes[1].childNodes[1]) {
            currentChunk.childNodes[1].childNodes[1].textContent = currentAudio.text.text;
            currentChunk.classList.remove('hidden');
        }

        audioPlayer.src = currentAudio.url;
        audioPlayer.playbackRate = playbackSpeed.value;
        
        // Add a retry counter to currentAudio object if it doesn't exist
        if (typeof currentAudio.retries === 'undefined') {
            currentAudio.retries = 0;
        }

        // Try playing the URL
        try {
            await audioPlayer.play();
        } catch (error) {
            console.warn(`Audio playback failed for chunk ${currentChunkIndex} (${currentAudio.url}), retrying in 2 seconds. Error:`, error);
            // This error often occurs if the user hasn\'t interacted with the document yet,
            // or if the browser blocks autoplay.
            if (currentAudio.retries < 3) { // Max 3 retries
                currentAudio.retries++;
                setTimeout(async () => {
                    playAudioQueue(); // Retry playing after a delay
                }, 2000); // Wait 2 seconds before retrying
            } else {
                console.error(`Audio playback failed for chunk ${currentChunkIndex} (${currentAudio.url}) after multiple retries. Skipping chunk. Error:`, error);
                isPlaying = false;
                disableAudioControls();
                generateBtnText.textContent = 'Generate Speech';
                generateBtnIcon.name = 'volume-high-outline';
                audioPlayer.src = ''; // Clear source to prevent further attempts
                showNotification(`Failed to play audio for chunk ${currentChunkIndex}. Skipping.`, 'error');
                
                // Skip to the next chunk if playback failed persistently
                unhighlightChunk(currentAudio.text);
                currentChunk.classList.add('hidden');
                currentChunkIndex++;
                processAndQueueChunk(currentChunkIndex + 2); // Pre-fetch next-next chunk
                if (audioQueue[currentChunkIndex]) {
                    playAudioQueue();
                } else {
                    // If there are no more chunks in the queue after skipping
                    isPlaying = false;
                    disableAudioControls();
                    clearAllHighlights();
                    generateBtnText.textContent = 'Generate Speech';
                    generateBtnIcon.name = 'volume-high-outline';
                }
            }
        }

        audioPlayer.onended = async () => {

            if (pdfDoc) {
                clearPdfHighlights();
            } else {
                unhighlightChunk(currentAudio.text); // Original behavior for text view
            }

            currentChunk.classList.add('hidden');
            
            currentChunkIndex++;
            processAndQueueChunk(currentChunkIndex + 2); // Pre-fetch next-next chunk

            if (audioQueue[currentChunkIndex]) {
                playAudioQueue();
            } else {

                isPlaying = false;
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
                // Introduce a small delay to ensure the file is fully ready on the server
                setTimeout(() => {
                    audioQueue[chunkIndex] = { url: audioUrl, text: chunk };

                    // If playback isn't running and this is the chunk we're waiting for, start playing.
                    if (!isPlaying && chunkIndex === currentChunkIndex) {
                        playAudioQueue();
                    }
                }, 100); // 100ms delay
            } else {
                console.debug(`❌ Failed to get audio for chunk index: ${chunkIndex}`);
            }
        });
    }

    function clearAllHighlights() {
        const allWordElements = textDisplay.querySelectorAll('span.highlight');
        allWordElements.forEach(span => span.classList.remove('highlight'));
        clearPdfHighlights();
    }

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

    async function renderPage(num, skipTextExtraction = false) {
        if (!pdfDoc) return;
        pdfViewerWrapper.classList.remove('hidden');
        textboxViewerWrapper.classList.add('hidden');
        autoDeleteChunksCheckbox.checked = false;

        // Enable PDF-specific controls
        toggleTwoPageBtn.disabled = false;
        zoomInBtn.disabled = false;
        zoomOutBtn.disabled = false;

        currentPageNum = num;
        pdfViewer.innerHTML = '';

        const mapTextContent = (textObject) => {
            return textObject.items.map(item => item.str).join(' ');
        }

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

            if (skipTextExtraction) {
                return '';
            }

            let textContent = await page.getTextContent();

            if (skipHeadersNFootersCheckbox.checked) {
                const parsedTextContent = detectHeadersAndFooters(textContent, canvas.height);
                textContent = parsedTextContent.body;
            }

            pdfTextContent[pageNumber] = textContent;
            return mapTextContent(textContent);
        };

        if (isTwoPageView) {
            const page1Text = await renderSinglePage(num, pdfViewer);
            let page2Text = '';

            if (num + 1 <= pdfDoc.numPages) {
                page2Text = await renderSinglePage(num + 1, pdfViewer);
            }

            if (!skipTextExtraction) {
                const combinedText = page1Text + ' ' + page2Text;
                allTextChunks = splitTextIntoChunks(combinedText);
                textDisplay.textContent = combinedText;
            }

            pageNumSpan.textContent = `Pages ${num}-${Math.min(num + 1, pdfDoc.numPages)} of ${pdfDoc.numPages}`;
            nextPageBtn.disabled = num >= pdfDoc.numPages - 1;

        } else {
            const pageText = await renderSinglePage(num, pdfViewer);

            if (!skipTextExtraction) {
                allTextChunks = splitTextIntoChunks(pageText);
                textDisplay.textContent = pageText;
            }

            pageNumSpan.textContent = `Page ${num} of ${pdfDoc.numPages}`;
            nextPageBtn.disabled = num >= pdfDoc.numPages;
        }

        currentChunkIndex = 0;
        localStorage.setItem(pdfDoc.fingerprint, num);
        prevPageBtn.disabled = num <= 1;

        if (activeBook && activeBook.source === 'local' && !skipTextExtraction) {
            localBooks[activeBook.id].text = textDisplay.textContent;
            saveLocalBooks();
        }
    }

    let matchingIndex = 0;
    let lastMatchedIndex = 0;

    async function highlightPdfChunk(chunkObject) {
        const highlightLayer = document.getElementById('highlight-layer');
        if (!highlightLayer) return;
    
        highlightLayer.innerHTML = ''; // Clear previous highlights
    
        const chunkText = chunkObject.text;
        const visiblePages = isTwoPageView ? [currentPageNum, currentPageNum + 1] : [currentPageNum];
    
        // The "shopping list" of text we still need to find. Whitespace is normalized.
        let textToFind = chunkText.trim().replace(/\s+/g, ' ');
        // A flag to ensure we only start highlighting after finding the beginning of the phrase.
        let matchingStarted = false;
        // How many failed matches we had.
        let matchingFails = 0;
    
        // Use a for...of loop to correctly handle await inside the loop
        for (const [pageIndex, pageNum] of visiblePages.entries()) {
            console.log(matchingIndex, lastMatchedIndex, matchingFails)
            if (!pdfTextContent[pageNum] || textToFind.length === 0) continue;
            matchingIndex += 1;
            if (matchingIndex < lastMatchedIndex) continue;
    
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: currentScale });
            
            // Use a for...of loop to allow 'break' and 'continue'
            for (const item of pdfTextContent[pageNum].items) {
                if (textToFind.length === 0) break; // Exit if we've found the entire chunk

                console.log(item.str);
    
                // Normalize the text from the PDF item for a more reliable comparison
                const itemText = item.str.trim().replace(/\s+/g, ' ');
                if (itemText.length === 0) continue;
    
                if (!matchingStarted) {
                    // We haven't found the start yet. Check if our remaining text starts with this item's text.
                    if (checkPhraseSimilarity(itemText, textToFind)) {
                        matchingStarted = true;
                        lastMatchedIndex = matchingIndex;
                        // Fall-through to the highlighting logic below
                    } else {
                        continue; // Not the start, so skip to the next item
                    }
                }
    
                // Once matching has started, we expect items to appear contiguously
                if (matchingStarted) {
                    if (checkPhraseSimilarity(itemText, textToFind)) {
                        // This item is a valid part of our sequence, so highlight it
                        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                        const highlight = document.createElement('div');
                        highlight.className = 'highlight pdf-highlight';
                        
                        const leftOffset = (isTwoPageView && pageIndex === 1) ? pdfViewer.children[0].width : 0;
                        
                        highlight.style.left = `${tx[4] + leftOffset}px`;
                        highlight.style.top = `${tx[5] - 10}px`; // Your -10px offset is kept
                        highlight.style.width = `${item.width * currentScale}px`;
                        highlight.style.height = `${item.height * currentScale}px`;
                        
                        highlightLayer.appendChild(highlight);
    
                    } else {

                        matchingFails += 1;

                        if (matchingFails > 2) {
                            // The sequence is broken. Stop highlighting for this chunk.
                            textToFind = ''; 
                        }
                        
                    }
                }
            }
            if (textToFind.length === 0) break; // Exit the page loop if we're done
        }
    }
    
    /* Clears all highlights from the PDF overlay. */
    function clearPdfHighlights() {
        const highlightLayer = document.getElementById('highlight-layer');
        if (highlightLayer) {
            highlightLayer.innerHTML = '';
        }
    }

    libraryBtn.addEventListener('click', async () => {

        // First reset the book view.
        setActiveBook(null);
        libraryBtn.classList.add('bg-indigo-100');

        bookView.classList.add('hidden');
        
        if (currentUser) {
            const pdfGrid = await renderUserPdfs(currentUser);
            mainDiv.appendChild(pdfGrid);
        } else {
            const fileGrid = createFilesGrid([]);
            mainDiv.appendChild(fileGrid);
        }
    });

    playbackSpeed.addEventListener('input', () => {
        audioPlayer.playbackRate = playbackSpeed.value;
        playbackSpeedDisplay.textContent = playbackSpeed.value.toString() + "x";
    });

    stopBtn.addEventListener('click', stopAudioQueue);

    webPageLinkInput.addEventListener('change', async (e) => {
        const url = webPageLinkInput.value;

        if (!url) return;

        webPageLinkInput.disabled = true;
        filePickerModalURLLoadingIndicator.classList.toggle('hidden');

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
            fullBookText = data.text;
            
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

        filePickerModalURLLoadingIndicator.classList.toggle('hidden');
        webPageLinkInput.disabled = false;
    });

    async function saveOcrText(bookId, text) {
        try {
            const response = await fetch(`/api/users/${currentUser}/books/${bookId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ocr_text: text }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save OCR text.');
            }
            console.log('OCR text saved successfully for book:', bookId);
            // Refresh the book list to get the new data with ocr_text
            await fetchAndRenderOnlineBooks();
            // Return the newly fetched book
            return onlineBooks.find(b => b.id === bookId);
        } catch (error) {
            console.error('Error saving OCR text:', error);
            showNotification(`Failed to save OCR text: ${error.message}`, 'error');
            return null; // Return null on failure
        }
    }

    function pollOcrResult(taskId, bookId = null) {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/ocr_result/${taskId}`);
                if (!response.ok) {
                    clearInterval(interval);
                    throw new Error('Failed to get OCR status.');
                }
                const data = await response.json();
    
                if (data.status === 'completed') {
                    clearInterval(interval);
                    loadingDiv.classList.add('hidden');
                    generateBtn.disabled = false;
                    showNotification('PDF OCR completed successfully.', 'success');

                    if (bookId && currentUser) {
                        const newOnlineBook = await saveOcrText(bookId, data.text);
                        if (newOnlineBook) {
                            setActiveBook({ ...newOnlineBook, source: 'online' });
                        } else {
                            // Fallback if the book couldn't be found after saving
                            console.error("Could not find online book after saving OCR text. Falling back to text view.");
                            fullBookText = data.text;
                            renderTextPage(1);
                        }
                    } else {
                        // Anonymous user flow
                        fullBookText = data.text;
                        if (activeBook.source === 'local') {
                            localBooks[activeBook.id].text = fullBookText;
                            saveLocalBooks();
                        }
                        renderTextPage(1);
                    }
    
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    console.error('OCR failed:', data.detail);
                    alert(`OCR failed: ${data.detail}`);
                    loadingDiv.classList.add('hidden');
                    generateBtn.disabled = false;
    
                } else {
                    // 'processing', so we continue polling.
                    console.log('OCR in progress...');
                }
            } catch (error) {
                clearInterval(interval);
                console.error('Error polling for OCR result:', error);
                alert(`An error occurred while checking OCR status: ${error.message}`);
                loadingDiv.classList.add('hidden');
                generateBtn.disabled = false;
            }
        }, 2000); // Poll every 2 seconds
    }

    async function handlePdfUpload(file, bookId = null) {
        loadingDiv.classList.remove('hidden');
        generateBtn.disabled = true;

        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch('/api/read_pdf', { method: 'POST', body: formData });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to read PDF.');
            }
            const data = await response.json();
            
            if (data.status === 'completed') {
                if (bookId && currentUser) {
                    saveOcrText(bookId, data.text);
                }
                fullBookText = data.text;
                if (activeBook.source === 'local') {
                    localBooks[activeBook.id].text = fullBookText;
                    saveLocalBooks();
                }
                totalTextPages = Math.max(1, Math.ceil(fullBookText.length / charsPerPage));
                renderTextPage(1);
                loadingDiv.classList.add('hidden');
                generateBtn.disabled = false;
            } else if (data.status === 'ocr_started') {
                showNotification('PDF contains no text. Starting background OCR...', 'info');
                pollOcrResult(data.task_id, bookId);
            } else {
                throw new Error('Received an unexpected response from the server.');
            }

        } catch (error) {
            console.error('Error reading PDF:', error);
            alert(`An error occurred: ${error.message}`);
            textDisplay.innerHTML = '';
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
        }
    }

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
            if (currentUser) {
                // If logged in, directly upload to server
                const formData = new FormData();
                formData.append('file', file);
                formData.append('content', fileName.replace(`.${fileExtension}`, '')); // Use filename as content

                try {
                    const response = await fetch(`/api/users/${currentUser}/pdfs`, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || 'Failed to upload PDF.');
                    }
                    const data = await response.json();
                    showNotification(data.message, 'success');
                    await handlePdfUpload(file, data.book_id); // Now, read the PDF content
                    hideFileModal();
                    return; // Exit after server upload
                } catch (error) {
                    showNotification(`Error uploading PDF: ${error.message}`, 'error');
                    hideFileModal();
                    return;
                }
            } else {
                // Fallback to local IndexedDB for anonymous users
                await handlePdfUpload(file);
            }
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
        } else if (fileExtension === 'docx') {
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
                const response = await fetch('/api/read_docx', { method: 'POST', body: formData });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to read DOCX.');
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
                console.error('Error reading DOCX:', error);
                alert(`An error occurred: ${error.message}`);
                textDisplay.innerHTML = '';
            } finally {
                loadingDiv.classList.add('hidden');
                generateBtn.disabled = false;
            }
        } else {
            alert('Please select a valid PDF, EPUB, or DOCX file.');
        }
        
        hideFileModal();
    });

    prevPageBtn.addEventListener('click', () => {

        clearAllHighlights();

        if (pdfDoc) {
            if (currentPageNum <= 1) return;
            renderPage(currentPageNum - (isTwoPageView ? 2 : 1));
        } else {
            if (textCurrentPage <= 1) return;
            renderTextPage(textCurrentPage - 1);
        }
    });

    nextPageBtn.addEventListener('click', () => {

        clearAllHighlights();

        if (pdfDoc) {
            const limit = isTwoPageView ? pdfDoc.numPages -1 : pdfDoc.numPages;
            if (currentPageNum >= limit) return;
            renderPage(currentPageNum + (isTwoPageView ? 2 : 1));
        } else {
            if (textCurrentPage >= totalTextPages) return;
            renderTextPage(textCurrentPage + 1);
        }
    });

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
                generateBtnIcon.name = 'pause';
                audioPlayer.play();
            } else {
                isPaused = true;
                generateBtnText.textContent = 'Play';
                generateBtnIcon.name = 'play';
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
        { name: 'Delete Book', description: 'Delete the currently active book', action: () => { 
            if (activeBook) {
                if (activeBook.source === 'online') {
                    deleteOnlineBook(activeBook.id);
                } else if (activeBook.source === 'local') {
                    deleteLocalBook(activeBook.id);
                }
                hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Rename Book', description: 'Rename the currently active book', action: () => { 
            if (activeBook) {
                if (activeBook.source === 'online') {
                    renameOnlineBook(activeBook);
                } else if (activeBook.source === 'local') {
                    renameLocalBook(activeBook);
                }
                hideCommandPalette();
            } else showNotification('No book is currently active.');
         } },

        { name: 'Import File', description: 'Import a PDF or EPUB file', action: () => {
            if (activeBook) {
                showFileModal(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Generate Speech', description: 'Generate speech for the current text', action: () => {
            if (activeBook) {
                startSpeechGeneration(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Stop Playback', description: 'Stop current audio playback', action: () => {
            if (activeBook) {
                stopAudioQueue(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Record Audio', description: 'Start recording audio for transcription', action: () => {
            if (activeBook) {
                startRecording(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Transcribe Audio File', description: 'Transcribe an audio file', action: () => {
            if (activeBook) {
                audioFileInput.click(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Login/Create Account', description: 'Login or create a new user account', action: () => { showLoginModal(); hideCommandPalette(); } },
        { name: 'Save Book (Online)', description: 'Save the current book to your online account', action: () => {
            if (activeBook) {
                handleSaveBook(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Toggle Two-Page View', description: 'Toggle between single and two-page PDF view', action: () => {
            if (activeBook) {
                toggleTwoPageBtn.click(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Zoom In PDF', description: 'Increase zoom level of PDF', action: () => {
            if (activeBook) {
                zoomInBtn.click(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Zoom Out PDF', description: 'Decrease zoom level of PDF', action: () => {
            if (activeBook) {
                zoomOutBtn.click(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Previous Page', description: 'Go to the previous page', action: () => {
            if (activeBook) {
                prevPageBtn.click(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Next Page', description: 'Go to the next page', action: () => {
            if (activeBook) {
                nextPageBtn.click(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
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

    commandsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (commandPaletteModal.classList.contains('hidden')) showCommandPalette();
        else hideCommandPalette();
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

        // Determine if the active book is a PDF based on its content or a flag
        const isPdfBook = activeBook.is_pdf || (activeBook.source === 'local' && localBooks[activeBook.id].pdfId);

        if (isPdfBook) {
            showNotification('PDFs are saved immediately upon upload. No further saving action is needed.', 'info');
            return;
        }

        // For text-based books, proceed with the existing save logic
        if (isUpdatingOnlineBook) {
            bookData.content = fullBookText; // Use full text
            bookData.is_pdf = false; // Explicitly mark as not a PDF
        } else {
            bookData.title = activeBook.title;
            bookData.content = localBooks[activeBook.id].text;
            bookData.is_pdf = false; // Explicitly mark as not a PDF
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
                // If a local book was saved online, remove it from local storage
                if (localBooks[activeBook.id]) {
                    delete localBooks[activeBook.id];
                    saveLocalBooks();
                    renderLocalBooks();
                }
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
                    const bookToDelete = onlineBooks.find(book => book.id === bookId);
                    if (!bookToDelete) throw new Error("Book not found in online list.");

                    let url = `/api/users/${currentUser}/books/${bookId}`;
                    if (bookToDelete.is_pdf) {
                        // If it's a PDF, call the dedicated PDF delete endpoint (if you create one)
                        // For now, we'll assume the generic delete handles it if the content is just a path.
                        // If a specific PDF cleanup is needed, a new endpoint might be required.
                    }

                    const response = await fetch(url, { method: 'DELETE' });
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