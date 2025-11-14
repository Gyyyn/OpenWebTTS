/*
 * -- index.js
 * --
 * -- This file contains most of the UI for the main app.
 * -- It's structed "top to bottom", mirroring the HTML of index.html.
 *
 */

// Import podcast generation
import { getPodcasts, generatePodcast, deletePodcast } from './podcast.js';

// Import Speech Generation functions
import { generateSpeech } from "./speechGen.js";

// Import helpers
import {
    readableUnixTime,
    parseTextContent,
    setBodyFont,
    getAllPdfText,
    detectHeadersAndFooters,
    fastFormatDetect,
    getCurrentMainVisiblePage,
    mapTextContent,
    splitTextIntoChunks,
    handlePrefs,
    createSleepTimer,
    startRecording,
    stopRecording,
    saveLocalBooks
} from "./helpers.js";

import { createFilesGrid, renderUserPdfs } from './library.js';

// Import UI
import {
    handleSidebarCollapse,
    updateCurrentUserUI,
    updatePlayerUI,
    updateCurrentPage,
    showNotification,
    showLoginModal,
    showBookModal,
    showFileModal,
    hideLoginModal,
    hideBookModal,
    hideFileModal,
    resetBookView,
    resetPdfView,
    checkTextContent,
    updateTextChunkReader,
    renderNotifications,
    updateVoices
} from "./UI.js";

document.addEventListener('DOMContentLoaded', () => {

    let appState = {
        elements: {
            // Inputs
            engineSelect: document.getElementById('engine'),
            voiceSelect: document.getElementById('voice'),
            pdfFileInput: document.getElementById('pdf-file'),
            webPageLinkInput: document.getElementById('web-page-url'),
            playbackSpeed: document.getElementById('playback-speed'),
            bgNoiseSelect: document.getElementById('bg-noise'),
            bgNoiseVolume: document.getElementById('bg-noise-volume'),
            // Checkboxes
            skipHeadersCheckbox: document.getElementById('skip-headers-checkbox'),
            bgNoiseToggle: document.getElementById('bg-noise-toggle'),
            // Buttons
            collapseSidebarButton: document.getElementById('collapse-sidebar-btn'),
            newBookBtn: document.getElementById('new-book-btn'),
            libraryBtn: document.getElementById('library-btn'),
            commandsBtn: document.getElementById('commands-btn'),
            accountSwitcherBtn: document.getElementById('account-switcher-btn'),
            accountSwitcherMenu: document.getElementById('account-switcher-menu'),
            currentUserButton: document.getElementById('current-user-button'),
            generatePodcastBtn: document.getElementById('create-offline-podcast-btn'),
            downloadAudioBtn: document.getElementById('download-link'),
            zoomInBtn: document.getElementById('zoom-in-btn'),
            zoomOutBtn: document.getElementById('zoom-out-btn'),
            generateBtn: document.getElementById('generate-btn'),
            generateBtnIcon: document.getElementById('generate-btn-icon'),
            stopBtn: document.getElementById('stop-btn'),
            prevChunkButton: document.getElementById('prev-audio-btn'),
            nextChunkButton: document.getElementById('next-audio-btn'),
            settingsDropupToggleBtn: document.getElementById('settings-dropup-toggle-btn'),
            // Elements
            sidebar: document.getElementById('sidebar'),
            localBookList: document.getElementById('local-book-list'),
            onlineBookList: document.getElementById('online-book-list'),
            podcastList: document.getElementById('podcast-list'),
            notificationDropdown: document.getElementById('notification-dropdown'),
            notificationList: document.getElementById('notification-list'),
            mainDiv: document.getElementById('main'),
            bookView: document.getElementById('book-view'),
            bookPageTitle: document.getElementById('book-title'),
            pageNumSpan: document.getElementById('page-num'),
            pageNumInput: document.createElement('input'),
            speechToTextSection: document.getElementById('speech-to-text-section'),
            emptyTextOverlay: document.getElementById('empty-text-overlay'),
            pasteClipboardOverlayBtn: document.getElementById('paste-clipboard-overlay-btn'),
            textboxViewerWrapper: document.getElementById('textbox-viewer-wrapper'),
            textDisplay: document.getElementById('text-display'),
            pdfViewer: document.getElementById('pdf-viewer'),
            pdfViewerWrapper: document.getElementById('pdf-viewer-wrapper'),
            generateBtnText: document.getElementById('generate-btn-text'),
            audioOutput: document.getElementById('audio-output'),
            audioPlayer: document.getElementById('audio-player'),
            playbackSpeedDisplay: document.getElementById('playback-speed-display'),
            currentChunk: document.getElementById('current-chunk'),
            currentChunkTextSpan: document.getElementById('current-chunk-text-span'),
            settingsDropupMenu: document.getElementById('settings-dropup-menu'),
            // Modal Elements
            bookModal: document.getElementById('book-modal'),
            modalTitle: document.getElementById('modal-title'),
            bookTitleInput: document.getElementById('book-title-input'),
            modalCancelBtn: document.getElementById('modal-cancel-btn'),
            modalActionBtn: document.getElementById('modal-action-btn'),
            // Login Modal Elements
            loginModal: document.getElementById('login-modal'),
            addAccountBtn: document.getElementById('add-account-btn'),
            loginModalCancelBtn: document.getElementById('login-modal-cancel-btn'),
            loginUsernameInput: document.getElementById('login-username-input'),
            loginPasswordInput: document.getElementById('login-password-input'),
            loginActionBtn: document.getElementById('login-modal-action-btn'),
            createAccountBtn: document.getElementById('create-account-btn'),
            currentUserDisplay: document.getElementById('current-user'),
            saveBookBtn: document.getElementById('save-book-btn'),
            logoutBtn: document.getElementById('logout-btn'),
            themeToggle: document.getElementById('dropdown-theme-toggle'),
            // File Picker Modal Elements
            filePickerModal: document.getElementById('file-picker-modal'),
            openFilePickerBtn: document.getElementById('open-file-picker-modal'),
            closeFilePickerBtn: document.getElementById('close-file-picker-modal'),
            filePickerModalURLLoadingIndicator: document.getElementById('url-loading-indicator'),
            // Speech to Text Elements
            recordBtn: document.getElementById('record-btn'),
            stopRecordBtn: document.getElementById('stop-record-btn'),
            recordingIndicator: document.getElementById('recording-indicator'),
            audioFileInput: document.getElementById('audio-file-input'),
            transcribeFileBtn: document.getElementById('transcribe-file-btn'),
        },
        variables: {
            pdfDoc: null,
            currentPageNum: 1,
            localBooks: JSON.parse(localStorage.getItem('books')) || {},
            onlineBooks: [],
            onlinePodcasts: [], // New array to store online podcasts
            activeBook: null,
            audioQueue: [],
            isPlaying: false,
            isPaused: false,
            allTextChunks: [],
            currentChunkIndex: 0,
            localPrefs: handlePrefs(),
            pdfTextContent: {},

            // Speech to Text variables
            mediaRecorder: null,
            audioChunks: [],
            isRecording: false,
            currentUser: null,
            isTwoPageView: false,
            currentScale: 1.5, // Initial scale

            // Pagination
            textCurrentPage: 1,
            charsPerPage: 4000, // Characters per page for text content
            totalTextPages: 1,
            fullBookText: '', // To store the entire text of a book
            currentTextPageLength: 0, // To track text length for editing
            bookDetectedLang: '',
            currentPageContainer: null,
            currentMostVisiblePage: null,
            currentReadingPage: null,
            // Global sleep timer
            playerSleepTimer: null,
        },
        functions: {
            showNotification: showNotification,
            getCurrentMainVisiblePage: getCurrentMainVisiblePage,
            readableUnixTime: readableUnixTime
        },
    };
    // Set workerSrc for PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = './static/js/pdf.worker.min.mjs';

    appState.elements.pageNumInput.type = 'number';
    appState.elements.pageNumInput.className = 'w-16 text-center bg-gray-200 rounded-lg';
    appState.elements.pageNumInput.style.display = 'none';
    appState.elements.pageNumSpan.parentElement.insertBefore(appState.elements.pageNumInput, appState.elements.pageNumSpan.nextSibling);

    appState.elements.pageNumSpan.addEventListener('click', () => {
        appState.elements.pageNumSpan.style.display = 'none';
        appState.elements.pageNumInput.style.display = 'inline-block';
        if (appState.variables.pdfDoc) {
            appState.elements.pageNumInput.value = appState.variables.currentPageNum;
        } else {
            appState.elements.pageNumInput.value = appState.variables.textCurrentPage;
        }
        appState.elements.pageNumInput.focus();
        appState.elements.pageNumInput.select();
    });

    const goToPage = () => {
        const page = parseInt(appState.elements.pageNumInput.value);
        if (!isNaN(page)) {
            appState.elements.currentPageContainer.innerHTML = ''; // Clear current view.
            if (pdfDoc) renderPage(page);
            else renderTextPage(page);
        }
        appState.elements.pageNumInput.style.display = 'none';
        appState.elements.pageNumSpan.style.display = 'inline-block';
    };

    document.addEventListener('click', (e) => {
        if (e.target !== appState.elements.pageNumInput && e.target !== appState.elements.pageNumSpan) {
            appState.elements.pageNumInput.style.display = 'none';
            appState.elements.pageNumSpan.style.display = 'inline-block';
        }
    });

    appState.elements.pageNumInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.stopPropagation();
            goToPage();
        } else if (e.key === 'Escape') {
            appState.elements.pageNumInput.style.display = 'none';
            appState.elements.pageNumSpan.style.display = 'inline-block';
        }
    });
  
    appState.elements.collapseSidebarButton.addEventListener('click', () => { handleSidebarCollapse(appState) });

    // Set initial sidebar state based on screen width
    if (window.innerWidth < 768) { // Tailwind's `md` breakpoint
        if (!appState.elements.sidebar.classList.contains('collapsed')) {
            appState.elements.sidebar.classList.add('collapsed');
            appState.elements.collapseSidebarButton.classList.remove('rotate-180');
            appState.elements.collapseSidebarButton.classList.remove('cursor-[w-resize]');
            appState.elements.collapseSidebarButton.classList.add('cursor-[e-resize]');
        }
    } else {
        if (appState.elements.sidebar.classList.contains('collapsed')) {
            appState.elements.sidebar.classList.remove('collapsed');
            appState.elements.collapseSidebarButton.classList.add('rotate-180');
            appState.elements.collapseSidebarButton.classList.add('cursor-[w-resize]');
            appState.elements.collapseSidebarButton.classList.remove('cursor-[e-resize]');
        }
    }

    function setActiveBook(book) {
        // Reset everything and stop playback.
        appState.variables.activeBook = book;
        resetBookView(appState);
        stopAudioQueue()
        renderLocalBooks();
        renderOnlineBooks();
        appState.elements.recordBtn.classList.remove('hidden');
        appState.elements.transcribeFileBtn.classList.remove('hidden');

        if (!book) return;

        // Remove active bg from library.
        appState.elements.libraryBtn.classList.remove('bg-indigo-100');

        loadBookContent(book);
        appState.elements.openFilePickerBtn.classList.add('hidden');

        if (book.is_pdf) {
            appState.elements.recordBtn.classList.add('hidden');
            appState.elements.transcribeFileBtn.classList.add('hidden');
            appState.variables.currentPageContainer = appState.elements.pdfViewer;
        } else appState.variables.currentPageContainer = appState.elements.textDisplay;

        if (book?.source === 'local') appState.elements.openFilePickerBtn.classList.remove('hidden')
    }

    function renderOnlineBooks() {
        if (appState.variables.onlineBooks.length < 1) return;
        appState.elements.onlineBookList.innerHTML = '';
        appState.variables.onlineBooks.forEach(book => {
            const li = createBookListItem(book, 'online');
            appState.elements.onlineBookList.appendChild(li);
        });
    }

    function renderOnlinePodcasts() {
        if (appState.variables.onlinePodcasts.length < 1) return; // Quit if we have an empty list.
        appState.elements.podcastList.innerHTML = '';
        appState.variables.onlinePodcasts.forEach(podcast => {
            const li = document.createElement('li');
            li.className = 'relative p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-200 '; // Added relative for absolute positioning of player
            li.title = `${podcast.title}`;
            li.ariaLabel = `Podcast item ${podcast.title}`;

            const mainContentDiv = document.createElement('div');
            mainContentDiv.className = 'flex justify-between items-center whitespace-nowrap overflow-hidden text-ellipsis';
            mainContentDiv.addEventListener('click', () => {

                const playerDiv = li.querySelector(`#podcast-audio-player-${podcast.id}`);

                if (sidebar.classList.contains('collapsed')) {
                    handleSidebarCollapse();
                    playerDiv.classList.add('hidden');
                }

                if (playerDiv)
                playerDiv.classList.toggle('hidden');
            });

            const titleSpan = document.createElement('span');
            titleSpan.className = 'ms-2 text-xs hide-on-collapse';
            titleSpan.textContent = `${podcast.title} (${podcast.status})`;

            const containerSpan = document.createElement('span');
            containerSpan.classList = 'overflow-hidden cursor-pointer';

            const titleIcon = document.createElement('span');
            titleIcon.innerHTML = '<i class="fas fa-microphone"></i>';

            containerSpan.prepend(titleIcon);
            containerSpan.append(titleSpan);

            mainContentDiv.appendChild(containerSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'ps-2 hide-on-collapse flex items-center space-x-2';

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
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

                        hideBookModal(appState);

                    },
                    { showInput: false },
                    appState
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
                playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
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
                    stopAudioQueue();

                    // Ensure other players are paused
                    document.querySelectorAll('audio').forEach(otherAudio => {
                        if (otherAudio !== audioElem && !otherAudio.paused) {
                            otherAudio.pause();
                            const otherPlayerContainer = otherAudio.closest('[id^="podcast-audio-player-"]');
                            if (otherPlayerContainer) {
                                const otherPlayBtn = otherPlayerContainer.querySelector('button');
                                if (otherPlayBtn) {
                                    otherPlayBtn.innerHTML = '<i class="fas fa-play"></i>';
                                }
                            }
                        }
                    });

                    if (audioElem.paused) {
                        audioElem.play();
                        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                        // Also ensure the player is visible if play is clicked
                        audioPlayerContainer.classList.remove('hidden');
                    } else {
                        audioElem.pause();
                        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
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
                    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
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
                compressBtn.innerHTML = '<i class="fas fa-compress"></i>';
                compressBtn.className = 'hover:text-gray-500';
                compressBtn.title = 'Compress Podcast';

                actionsDiv.prepend(compressBtn);

            } else if (podcast.status === 'failed') {

                // Retry Button (TODO)
                const retryBtn = document.createElement('button');
                retryBtn.innerHTML = '<i class="fas fa-repeat"></i>';
                retryBtn.className = 'hover:text-gray-500';
                retryBtn.title = 'Retry Podcast';

                actionsDiv.prepend(retryBtn);
                
            } else {
                audioPlayerContainer.innerHTML = '<span class="text-gray-500">Podcast audio not ready.</span>';
            }
            
            li.appendChild(audioPlayerContainer);
            appState.elements.podcastList.appendChild(li);
        });
    }

    function renderLocalBooks() {
        if (appState.variables.localBooks.length < 1) return; // No need to render an empty list.
        appState.elements.localBookList.innerHTML = '';
        for (const bookId in appState.variables.localBooks) {
            const book = { ...appState.variables.localBooks[bookId], id: bookId };
            const li = createBookListItem(book, 'local');
            appState.elements.localBookList.appendChild(li);
        }
    }

    function createBookListItem(book, source) {
        const li = document.createElement('li');
        const isActive = appState.variables.activeBook?.id === book.id;
        li.className = `flex justify-between items-center cursor-pointer p-1 rounded-lg whitespace-nowrap overflow-hidden text-ellipsis dark:hover:bg-gray-700 dark:text-gray-200  ${isActive ? 'bg-indigo-100 dark:bg-indigo-900 dark:bg-opacity-30' : 'hover:bg-gray-200'}`;
        li.title = `${book.title}`;
        li.ariaLabel = `Book item ${book.title}`;

        const titleSpan = document.createElement('span');
        titleSpan.className = `ms-2 text-xs hide-on-collapse`;
        titleSpan.textContent = book.title;
        li.addEventListener('click', () => {
            setActiveBook({ ...book, source });
        });

        const containerSpan = document.createElement('span');
        containerSpan.classList = 'overflow-hidden';

        const titleIcon = document.createElement('span');
        titleIcon.innerHTML = '<i class="fas fa-book"></i>';

        if (book.is_pdf) titleIcon.innerHTML = '<i class="fas fa-file-pdf"></i>';

        containerSpan.prepend(titleIcon);
        containerSpan.append(titleSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'ps-2 flex items-center space-x-2 hide-on-collapse';

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.className = 'hover:text-gray-500';
        deleteBtn.ariaLabel = `Delete item ${book.title}`;

        const renameBtn = document.createElement('button');
        renameBtn.innerHTML = '<i class="fas fa-i-cursor"></i>';
        renameBtn.className = 'hover:text-gray-500';
        renameBtn.ariaLabel = `Rename item ${book.title}`;

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

    // Add event listener for keydown events on the document
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            if (!appState.elements.bookModal.classList.contains('hidden'))
                appState.elements.modalActionBtn.click();
        } else if (event.key === 'Escape') {
            if (!appState.elements.bookModal.classList.contains('hidden'))
                appState.elements.modalCancelBtn.click();
        }
    });

    function deleteBook(bookId) {
        const book = appState.variables.localBooks[bookId];
        if (!book) return;

        showBookModal(
            `Delete Book: ${book.title}?`,
            'Delete',
            () => {
                delete appState.variables.localBooks[bookId];
                saveLocalBooks(appState);

                if (appState.variables.activeBook && appState.variables.activeBook.id === bookId) {
                    appState.variables.activeBook = null;
                    appState.elements.textDisplay.innerHTML = '';
                    resetPdfView(appState);
                }

                hideBookModal(appState);
                renderLocalBooks();
                resetBookView(appState);
            },
            { showInput: false },
            appState
        );
    }

    function renameBook(bookId) {
        const book = appState.variables.localBooks[bookId];
        if (!book) return;

        showBookModal(
            'Rename Book',
            'Rename',
            () => {
                const newTitle = appState.elements.bookTitleInput.value;
                if (newTitle?.trim() !== book.title) {
                    book.title = newTitle.trim();
                    saveLocalBooks(appState);
                    renderLocalBooks();
                    if (appState.variables.activeBook?.id === bookId)
                    appState.elements.bookPageTitle.innerHTML = book.title;
                }
                hideBookModal(appState);
            },
            { showInput: true, inputValue: book.title },
            appState
        );
    }

    // This function highlights only plain-text.
    function highlightChunk(chunkObject) {
        const fullText = appState.variables.currentReadingPage.textContent;
        const chunkText = chunkObject.text;
        const startIndex = fullText.indexOf(chunkText);

        if (startIndex === -1) {
            console.error("Could not find chunk text to highlight:", chunkObject);
            console.debug(fullText);
            return;
        }

        let highlightClass = "highlight";

        if (appState.variables.localPrefs.highlightColor)
        highlightClass += ` ${localPrefs.highlightColor}`;

        // Create the HTML for the highlighted chunk (with spans for each word)
        const words = chunkText.split(/(\s+)/); // Keep spaces
        let highlightedHtml = '';
        words.forEach(word => {
            if (word.trim() !== '') {
                // Use the same data-chunk-id for easy removal later
                highlightedHtml += `<span class="${highlightClass}" data-chunk-id="${chunkObject.id}">${word}</span>`;
            } else {
                highlightedHtml += word;
            }
        });

        // Replace the plain text of the chunk with our new highlighted HTML
        appState.variables.currentReadingPage.innerHTML = fullText.substring(0, startIndex) +
                            highlightedHtml +
                            fullText.substring(startIndex + chunkText.length);
    }

    function unhighlightChunk(chunkObject) {
        // Find all the spans for the chunk we just played
        const spans = appState.variables.currentReadingPage.querySelectorAll(`span[data-chunk-id="${chunkObject.id}"]`);
        if (spans.length === 0) return;

        // We can simply replace the entire innerHTML with the plain text again.
        // This is efficient because the highlight/unhighlight is the only change.
        appState.variables.currentReadingPage.textContent = appState.variables.allTextChunks.map(chunk => chunk.text).join(' ');
    }

    let renderBookContent = async (book) => {
        if (!book) return;

        appState.elements.bookView.classList.remove('hidden');
        appState.elements.bookPageTitle.innerHTML = book.title;
        
        let bookContent = '';
        let isPdfBook = false;

        // Reset views.
        appState.elements.pdfViewer.innerHTML = '';
        appState.elements.textDisplay.innerHTML = '';

        if (book.source === 'online' && book.is_pdf) {
            isPdfBook = true;
            bookContent = book.content; // This will be the path to the PDF on the server
        } else if (book.source === 'online') {
            bookContent = book.content;
        } else if (book.source === 'local') {
            bookContent = appState.variables.localBooks[book.id].text;
            if (appState.variables.localBooks[book.id].pdfId) {
                isPdfBook = true;
            }
        }

        // Text Pagination Logic
        appState.variables.fullBookText = bookContent || '';
        appState.variables.totalTextPages = Math.max(1, Math.ceil(appState.variables.fullBookText.length / appState.variables.charsPerPage));
        appState.variables.textCurrentPage = 1;

        appState.elements.bookView.classList.remove('hidden');
        appState.variables.currentChunkIndex = 0; // Reset chunk index

        if (isPdfBook && appState.variables.currentUser) {
            let pdfData;
            // Fetch PDF from server
            const response = await fetch(book.content); // book.content is the URL to the PDF
            if (!response.ok) {
                throw new Error(`Failed to fetch PDF from ${book.content}`);
            }
            
            pdfData = await response.arrayBuffer();

            if (pdfData) {
                appState.variables.pdfDoc = await pdfjsLib.getDocument({ data: pdfData, }).promise;
                const lastPage = parseInt(localStorage.getItem(appState.variables.pdfDoc.fingerprints[0])) || 1;
                renderPage(lastPage);
            } else {
                resetPdfView(appState);
                const lastTextPage = parseInt(localStorage.getItem(`text-page-${book.id}`)) || 1;
                renderTextPage(lastTextPage);
            }
        } else {
            resetPdfView(appState);
            const lastTextPage = parseInt(localStorage.getItem(`text-page-${book.id}`)) || 1;
            renderTextPage(lastTextPage);
        }

        if (bookContent.length > 0) {
            try {
                const response = await fetch('/api/detect_lang', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: bookContent })
                });
    
                if (!response.ok) throw new Error('Failed to detect language.');
    
                const data = await response.json();
                appState.variables.bookDetectedLang = data.language;
                
            } catch (error) {
                console.debug('Error detecting language:', error);
            }
        }
    };
    
    // Wrapper for loadBookContent to add functionality
    let loadBookContent = async (book) => {

        if (appState.variables.isPlaying) {
            showNotification('Stop playback first!', 'warning');
            return;
        }

        // Close library if it's open.
        const library = document.getElementById('library-file-grid');

        if (library) library.remove();

        // Disconnect previous scroll observers.
        upwardsScroll.disconnect();
        downwardsScroll.disconnect();

        await renderBookContent(book);
        let scrollCompensationElement = null;

        // Start scroll events
        if (book.is_pdf) {
            scrollCompensationElement = appState.elements.pdfViewer.children[0];
            upwardsScroll.observe(appState.elements.pdfViewer.children[0]);
        } else {
            scrollCompensationElement = appState.elements.textDisplay.children[0];
            upwardsScroll.observe(appState.elements.textDisplay.children[0]);
        }

        // Only scroll if not on first page.
        if (scrollCompensationElement && scrollCompensationElement.dataset.page > 1) {
            document.scrollingElement.scrollTop = scrollCompensationElement.scrollHeight + 100;
        }

        downwardsScroll.observe(document.querySelector("#toolbar-space"));
        checkTextContent(appState);

        if (appState.variables.currentUser && !book.is_pdf) { // Only show save button for non-PDF online books
            appState.elements.saveBookBtn.classList.remove('hidden');
        } else {
            appState.elements.saveBookBtn.classList.add('hidden');
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
        appState.variables.localBooks[bookId] = {
            title: randomTitle,
            text: '',
            pdfId: null
        };

        saveLocalBooks(appState);
        setActiveBook({ ...appState.variables.localBooks[bookId], id: bookId, source: 'local' });
    }

    function handleTextBookUpdate() {

        if (appState.variables.pdfDoc !== null)
        return;

        const newPageText = appState.elements.textDisplay.textContent;
        const start = (appState.variables.textCurrentPage - 1) * appState.variables.charsPerPage;

        // Reconstruct the full text by replacing the edited part
        appState.variables.fullBookText = appState.variables.fullBookText.substring(0, start) +
                        newPageText +
                        appState.variables.fullBookText.substring(start + appState.variables.currentTextPageLength);
        
        // Update the stored length for subsequent edits on the same page
        appState.variables.currentTextPageLength = newPageText.length;

        if (appState.variables.activeBook.source === 'local') {
            appState.variables.localBooks[appState.variables.activeBook.id].text = appState.variables.fullBookText;
            saveLocalBooks(appState);
        } else { // Online book
            // For online books, just enable the save button to indicate changes
            appState.elements.saveBookBtn.classList.remove('hidden');
            appState.elements.saveBookBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
        }
        // Recalculate total pages and update display
        appState.variables.totalTextPages = Math.max(1, Math.ceil(appState.variables.fullBookText.length / appState.variables.charsPerPage));
        appState.elements.pageNumSpan.textContent = `Page ${appState.variables.textCurrentPage} of ${appState.variables.totalTextPages}`;

        // Update chunks for speech generation from the edited page text
        renderTextPage(appState.variables.textCurrentPage);
    }

    /** -- Events -- */
    if (appState.variables.activeBook?.source === 'local' && appState.variables.localPrefs.skipHeaders)
        appState.elements.skipHeadersCheckbox.checked = appState.variables.localPrefs.skipHeaders;

    appState.elements.skipHeadersCheckbox.addEventListener('change', () => {
        if (appState.variables.activeBook?.source === 'local') {
            appState.variables.localBooks[appState.variables.activeBook.id].skipHeadersNFooters = skipHeadersCheckbox.checked;
            saveLocalBooks(appState);
        } else {
            handlePrefs({ skipHeaders: appState.elements.skipHeadersCheckbox.checked })
        }
    });

    appState.elements.newBookBtn.addEventListener('click', createNewBook);

    // 1 means forwards, -1 means backwards.
    async function handlePageChange(dir = 1) {
        const finishedPageNum = Number.parseInt(appState.variables.currentReadingPage.dataset.page);
        let lastAvailablePage = 0;
        appState.variables.currentChunkIndex = 0; // Reset chunk index, important for playAudioQueue 

        // Find next page
        Array.from(appState.variables.currentPageContainer.children).forEach(child => {
            const pageIndex = Number.parseInt(child.dataset.page);
            lastAvailablePage = pageIndex;
            if (pageIndex === finishedPageNum + dir) {
                appState.variables.currentReadingPage = child;
            }
        });

        // Clean up pages we aren't probably using. The garbage collection
        // inside the infinite scroll handlers are paused during audio
        // generation, so we need to do it here sometimes.
        const cleanUpPages = (pages, readingPage) => {
            const pageArray = Array.from(pages);
            const readingPageIndex = pageArray.findIndex(page => page.dataset.page === readingPage.dataset.page);
            const middleIndex = Math.floor(pageArray.length / 2);
            
            // Remove pages that are too far from the reading page
            pageArray.forEach((page, index) => {
                if (Math.abs(index - readingPageIndex) > middleIndex) {
                    page.remove();
                }
            });
        }

        // If we haven't found the page we need, maybe we need to load it.
        if (dir === 1 && finishedPageNum >= lastAvailablePage) {
            // Load next page
            if (appState.variables.pdfDoc) await renderPage(lastAvailablePage + 1, true, true);
            else renderTextPage(lastAvailablePage + 1, true);
            lastAvailablePage = -1;
        } else if (dir === -1 && finishedPageNum <= 1) {
            // Load previous page
            if (appState.variables.pdfDoc) await renderPage(lastAvailablePage - 1, true, false);
            else renderTextPage(lastAvailablePage - 1, false);
            lastAvailablePage = -1;
        }

        // If we were rendered a new page before, we need to do some adjustments.
        if (lastAvailablePage === -1) {
            cleanUpPages(appState.variables.currentPageContainer.children, appState.variables.currentReadingPage); // Clean up the DOM, so it doesn't get too big.
            appState.variables.currentReadingPage = appState.variables.currentPageContainer.lastChild; // We wouldn't have found the next page before. 
        }
        // There is a non zero change that we just read 
        // the same page again here, if we didn't find
        // the next page above.
        startSpeechGeneration();
    }

    async function playAudioQueue() {
        if (appState.variables.isPaused) return;

        if (!appState.variables.audioQueue[appState.variables.currentChunkIndex]) {
            // This case can be hit if the buffer is empty. We just wait.
            // Playback will be triggered by processAndQueueChunk when the audio arrives.
            updatePlayerUI('BUFFERING', appState);
            return;
        }

        updatePlayerUI('PLAYING', appState);

        const currentAudio = appState.variables.audioQueue[appState.variables.currentChunkIndex];
        updateTextChunkReader(appState);

        if (appState.variables.pdfDoc)
        await highlightPdfChunk(currentAudio.text);
        else {
            if (fastFormatDetect(appState.elements.textDisplay.innerHTML) == 'html') {
                highlightHTML(currentAudio.text); // HTML highlights
            } else {
                highlightChunk(currentAudio.text); // Plain text
            }
        }

        appState.elements.audioPlayer.src = currentAudio.url;
        appState.elements.downloadAudioBtn.href = currentAudio.url;
        appState.elements.audioPlayer.playbackRate = appState.elements.playbackSpeed.value;
        
        // Add a retry counter to currentAudio object if it doesn't exist
        if (typeof currentAudio.retries === 'undefined') {
            currentAudio.retries = 0;
        }

        // Try playing the URL
        try {
            await appState.elements.audioPlayer.play();
        } catch (error) {
            console.warn(`Audio playback failed for chunk ${appState.variables.currentChunkIndex} (${currentAudio.url}), retrying in 2 seconds. Error:`, error);
            // This error often occurs if the user hasn\'t interacted with the document yet,
            // or if the browser blocks autoplay.
            if (currentAudio.retries < 3) { // Max 3 retries
                currentAudio.retries++;
                setTimeout(async () => {
                    playAudioQueue(); // Retry playing after a delay
                }, 2000); // Wait 2 seconds before retrying
            } else {
                console.error(`Audio playback failed for chunk ${appState.variables.currentChunkIndex} (${currentAudio.url}) after multiple retries. Skipping chunk. Error:`, error);
                updatePlayerUI('BUFFERING', appState)
                appState.elements.audioPlayer.src = ''; // Clear source to prevent further attempts
                showNotification(`Failed to play audio for chunk ${appState.variables.currentChunkIndex}. Skipping.`, 'error');
                
                // Skip to the next chunk if playback failed persistently
                unhighlightChunk(currentAudio.text);
                appState.elements.currentChunk.classList.add('hidden');
                appState.variables.currentChunkIndex++;
                processAndQueueChunk(appState.variables.currentChunkIndex + 1); // Pre-fetch next-next chunk
                if (appState.variables.audioQueue[appState.variables.currentChunkIndex])
                playAudioQueue();
                else {
                    // If there are no more chunks in the queue after skipping
                    updatePlayerUI('IDLE', appState);
                    clearAllHighlights();
                }
            }
        }

        appState.elements.audioPlayer.onended = async () => {
            clearAllHighlights();
            appState.elements.currentChunk.classList.add('hidden');
            appState.variables.currentChunkIndex++;
            processAndQueueChunk(appState.variables.currentChunkIndex + 1); // Pre-fetch next chunk

            if (appState.variables.audioQueue[appState.variables.currentChunkIndex]) playAudioQueue();
            else {
                clearAllHighlights();
                // Next Page Logic
                if ((appState.variables.currentChunkIndex >= appState.variables.allTextChunks.length)) await handlePageChange(1);
            }
        };
    }

    function stopAudioQueue() {
        appState.variables.currentReadingPage = null;
        appState.variables.currentChunkIndex = 0;
        appState.elements.currentChunk.classList.add('hidden');
        appState.variables.audioQueue = [];
        appState.elements.audioPlayer.pause();
        appState.elements.audioPlayer.src = '';

        updatePlayerUI('IDLE', appState);
        appState.elements.speechToTextSection.classList.remove('hidden');
    }

    function goToNextAudioChunk() {
        if (!appState.variables.isPlaying) {
            return;
        }

        // Stop current playback
        if (appState.elements.audioPlayer && !appState.elements.audioPlayer.paused) {
            appState.elements.audioPlayer.pause();
            appState.elements.audioPlayer.currentTime = 0;
        }

        // Clear current highlights
        if (appState.variables.pdfDoc) clearPdfHighlights();
        else clearAllHighlights();

        // Check if we're at the end of the current page
        if (appState.variables.currentChunkIndex >= appState.variables.allTextChunks.length - 1) {
            // Handle page progression for auto-read
            handlePageChange(1);
            return;
        }

        // Move to next chunk
        appState.variables.currentChunkIndex++;
        
        // Clear the current chunk display
        appState.elements.currentChunk.classList.add('hidden');

        // Process the chunks. This will also play the audio.
        processAndQueueChunk(appState.variables.currentChunkIndex);
        processAndQueueChunk(appState.variables.currentChunkIndex + 1);

        playAudioQueue();
    
    }

    function goToPreviousAudioChunk() {
        if (!appState.variables.isPlaying || appState.variables.currentChunkIndex <= 0) return;

        // Stop current playback
        if (appState.elements.audioPlayer && !appState.elements.audioPlayer.paused) {
            appState.elements.audioPlayer.pause();
            appState.elements.audioPlayer.currentTime = 0;
        }

        // Clear current highlights
        if (appState.variables.pdfDoc) clearPdfHighlights();
        else clearAllHighlights();

        // Move to previous chunk
        appState.variables.currentChunkIndex--;
        
        // Clear the current chunk display
        appState.elements.currentChunk.classList.add('hidden');
        
        // Start playing from the new chunk
        playAudioQueue();
    }

    function startSpeechGeneration() {
        updatePlayerUI('BUFFERING', appState);
        // If currentReadingPage is not set, we are going to find
        // the page the user is currently looking at.
        if (!appState.variables.currentMostVisiblePage)
        appState.variables.currentMostVisiblePage = getCurrentMainVisiblePage(appState.variables.currentPageContainer);
        if (!appState.variables.currentReadingPage)
        appState.variables.currentReadingPage = appState.variables.currentMostVisiblePage;

        let text = appState.variables.currentReadingPage.textContent.trim();

        if (appState.variables.pdfDoc) {
            // Get text from PDF object.
            text = mapTextContent(appState.variables.pdfTextContent[appState.variables.currentReadingPage.dataset.page]);
            // Update local page tracker.
            localStorage.setItem(appState.variables.pdfDoc.fingerprints[0], appState.variables.currentReadingPage.dataset.page);
        } else {
            if (appState.variables.activeBook) {
                localStorage.setItem(`text-page-${appState.variables.activeBook.id}`, appState.variables.currentReadingPage.dataset.page);
            }
        }

        // Now that we have our page text, prepare for generation.
        appState.variables.allTextChunks = splitTextIntoChunks(text);

        if (appState.variables.allTextChunks.length === 0) return;

        // If we got here okay, we can reset the view and queues.
        appState.elements.speechToTextSection.classList.add('hidden');
        appState.variables.audioQueue = [];      

        const initialBufferSize = Math.min(3, appState.variables.allTextChunks.length);
        for (let i = 0; i < initialBufferSize; i++) {
            processAndQueueChunk(i);
        }

        appState.elements.audioOutput.classList.remove('hidden');

        // Start sleep timer if set.
        // appState.variables.playerSleepTimer = createSleepTimer(30 * 60 * 1000, () => {
        //     stopAudioQueue();
        //     showNotification("Playback stopped by sleep timer");
        // });
    }

    function processAndQueueChunk(chunkIndex) {
        if (chunkIndex >= appState.variables.allTextChunks.length || chunkIndex < 0) return false;

        const chunk = appState.variables.allTextChunks[chunkIndex];
        let cleanedChunk = chunk.text.replaceAll('\n', ' '); // Clean new lines
        
        generateSpeech(cleanedChunk, appState.variables.bookDetectedLang, appState.elements.engineSelect.value, appState.elements.voiceSelect.value).then(audioUrl => {
            if (audioUrl) {
                appState.variables.audioQueue[chunkIndex] = { url: audioUrl, text: chunk };
                // If playback isn't running and this is the chunk we're waiting for, start playing.
                if (!appState.variables.isPlaying && chunkIndex === appState.variables.currentChunkIndex)
                playAudioQueue();
            } else console.debug(`Failed to get audio for chunk index: ${chunkIndex}`);
        });
    }

    function clearAllHighlights() {
        const allWordElements = appState.elements.textDisplay.querySelectorAll('span.highlight');
        allWordElements.forEach(span => span.classList.remove('highlight'));
        clearPdfHighlights();
    }

    function renderTextPage(num, append = true) {
        appState.variables.textCurrentPage = num;
        const start = (num - 1) * appState.variables.charsPerPage;
        const end = start + appState.variables.charsPerPage;
        const pageText = appState.variables.fullBookText.substring(start, end);

        const injectHTML = document.createElement('div');
        injectHTML.innerHTML = parseTextContent(pageText);
        injectHTML.dataset.page = appState.variables.textCurrentPage;

        appState.variables.currentTextPageLength = pageText.length; // Store for editing

        if (append) { appState.elements.textDisplay.appendChild(injectHTML) }
        else { appState.elements.textDisplay.prepend(injectHTML) }

        // Ensure we are in text view mode
        appState.elements.pdfViewerWrapper.classList.add('hidden');
        appState.elements.textboxViewerWrapper.classList.remove('hidden');
        appState.elements.zoomInBtn.disabled = true;
        appState.elements.zoomOutBtn.disabled = true;
    }

    async function renderPage(num, skipTextExtraction = false, append = true) {
        if (!appState.variables.pdfDoc) return;
        appState.elements.pdfViewerWrapper.classList.remove('hidden');
        appState.elements.textboxViewerWrapper.classList.add('hidden');
        appState.elements.zoomInBtn.disabled = false;
        appState.elements.zoomOutBtn.disabled = false;
        appState.variables.currentPageNum = num;

        const renderSinglePage = async (pageNumber, container) => {
            const canvas = document.createElement('canvas');
            const lastPage = appState.elements.pdfViewer.lastChild;
            canvas.classList.add('dark:invert');
            canvas.ariaLabel = 'PDF page';
            canvas.dataset.page = pageNumber;

            if (lastPage) {
                // Populate with last pages info, while we await.
                canvas.height = lastPage.offsetHeight;
                canvas.width = lastPage.OffsetWidth;
            }

            // Immediately render the page, even while we wait for PDF.js
            if (append) container.appendChild(canvas);
            else container.prepend(canvas);

            const page = await appState.variables.pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: appState.variables.currentScale });
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            await page.render(renderContext).promise;

            if (skipTextExtraction) return '';

            let textContent = await page.getTextContent();

            if (appState.elements.skipHeadersCheckbox.checked) {
                const parsedTextContent = detectHeadersAndFooters(textContent, canvas.height);
                textContent = parsedTextContent.body;
            }

            appState.variables.pdfTextContent[pageNumber] = textContent;
            return mapTextContent(textContent);
        };

        if (appState.variables.isTwoPageView) {
            const page1Text = await renderSinglePage(num, appState.elements.pdfViewer, append);
            let page2Text = '';

            if (num + 1 <= pdfDoc.numPages)
            page2Text = await renderSinglePage(num + 1, appState.elements.pdfViewer, append);

            if (!skipTextExtraction) {
                const combinedText = page1Text + ' ' + page2Text;
                appState.elements.textDisplay.textContent = combinedText;
            }
        } else {
            const pageText = await renderSinglePage(num, appState.elements.pdfViewer);
            if (!skipTextExtraction)
            appState.elements.textDisplay.textContent = pageText;
        }

        if (appState.variables.activeBook?.source === 'local' && !skipTextExtraction) {
            appState.variables.localBooks[appState.variables.activeBook.id].text = appState.elements.textDisplay.textContent;
            saveLocalBooks(appState);
        }
    }

    async function highlightPdfChunk(chunkObject) {
        const highlightLayer = document.getElementById('highlight-layer');
        if (!highlightLayer) return; // Quit if there is an error with the layer.
        highlightLayer.innerHTML = ''; // Clear previous highlights

        const currentReadingPageNum = Number.parseInt(appState.variables.currentReadingPage.dataset.page);

        // Normalize the target text
        const normalizeText = (text) => {
            return text.trim().replaceAll(/\s+/g, ' ');
        }

        const chunkText = normalizeText(chunkObject.text);
        let textToFind = chunkText;
        let currentPage = appState.variables.pdfTextContent[currentReadingPageNum];

        // Build complete text from page.
        const pageText = normalizeText(mapTextContent(currentPage));

        // Find the best match position in the complete text
        let bestMatchStart = -1;

        // Try to find the longest prefix of textToFind that appears in pageText
        for (let len = Math.min(textToFind.length, 200); len >= 10; len--) {
            const prefixToFind = textToFind.substring(0, len);
            const matchIndex = pageText.indexOf(prefixToFind);
            
            if (matchIndex !== -1) {
                bestMatchStart = matchIndex;
                break;
            }
        }

        if (bestMatchStart === -1) {
            console.debug('Could not find any match in the text: ', pageText);
            return;
        }

        // Now find the PDF items
        let currentTextPos = 0;
        let itemsToHighlight = [];
        let totalMatchedLength = 0;

        for (let i = 0; i < currentPage.items.length && totalMatchedLength < textToFind.length; i++) {
            const item = currentPage.items[i];
            const itemEndPos = currentTextPos + item.str.length;

            // Check if this item overlaps with our match region
            if (itemEndPos > bestMatchStart && currentTextPos < bestMatchStart + textToFind.length) {
                itemsToHighlight.push(item);
                totalMatchedLength += item.str.length;
            }

            currentTextPos = itemEndPos;
        }
        

        // Now actually highlight the items
        for (const item of itemsToHighlight) {
            const page = await appState.variables.pdfDoc.getPage(currentReadingPageNum);
            const viewport = page.getViewport({ scale: appState.variables.currentScale });            

            createAndAppendHighlight(item, viewport, currentReadingPageNum, highlightLayer);
        }
    }
    
    // Helper function to create and append highlight (extracted for cleaner code)
    function createAndAppendHighlight(item, viewport, pageIndex, highlightLayer) {
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const highlight = document.createElement('div');
        highlight.className = 'highlight pdf-highlight';
        let layerOffset = 0;

        // Calculate how much we scrolled.
        for (const child of appState.elements.pdfViewer.children) {
            if (Number.parseInt(child.dataset.page) < pageIndex) {
                layerOffset += child.height;
            } else {
                break;
            }
        }

        if (appState.variables.localPrefs.highlightColor)
        highlight.className += ` ${appState.variables.localPrefs.highlightColor}`;
        
        const leftOffset = (appState.variables.isTwoPageView && pageIndex === 1) ? appState.elements.pdfViewer.children[0].width : 0;
        
        highlight.style.left = `${tx[4] + leftOffset}px`;
        highlight.style.top = `${tx[5] - 10 + layerOffset}px`;
        highlight.style.width = `${item.width * appState.variables.currentScale}px`;
        highlight.style.height = `${item.height * appState.variables.currentScale}px`;
        
        highlightLayer.appendChild(highlight);
    }
    
    /* Clears all highlights from the PDF overlay. */
    function clearPdfHighlights() {
        const highlightLayer = document.getElementById('highlight-layer');
        if (highlightLayer) {
            highlightLayer.innerHTML = '';
        }
    }

    function highlightHTML(chunkObject) {
        const previousHighlights = document.querySelectorAll('[data-highlighted]');
        // First clear previous highlights.
        if (previousHighlights) {
            previousHighlights.forEach((item) => {
                item.classList.remove('highlight');
                if (item.dataset.highlightClass) {
                    item.classList.remove(item.dataset.highlightClass);
                    item.removeAttribute('data-highlight-class');
                }
            });
        }
        
        // Prepare a semi-flat structure
        let textNodes = [];

        appState.variables.currentReadingPage.childNodes.forEach((item) => {

            if (!item.textContent || item.nodeName == '#text') return;

            if (item.textContent == `\n`) return;

            if (item.childNodes.length > 5) {
                item.childNodes.forEach((itemChildNodeItem) => {
                    textNodes.push(itemChildNodeItem);
                });
            } else {
                textNodes.push(item);
            }

        });

        // Get every child node inside the display area, and check them for text matches.
        textNodes.forEach((item) => {            
            let itemMatches = false;
            const trimmedChunk = chunkObject.text.replaceAll(/\s+/g, ' ');
            const trimmedItem = item.textContent.replaceAll(/\s+/g, ' ');

            // Adapted logic from PDF highlighting
            for (let len = trimmedItem.length; len > 100; len = len - 5) {
                const iLen = trimmedItem.length;
                let matchIndexStart = -1;
                let matchIndexEnd = -1;
                let matchIndexMiddle = -1;

                const prefixFromStart = trimmedChunk.substring(0, len);
                const prefixFromEnd = trimmedChunk.substring(iLen - len);
                // This looks complicated, but just gets and increasingly large sub-string from the middle.
                const prefixFromMiddle = trimmedChunk.substring((iLen/2) - (len/2), (iLen/2) + (len/2));

                // Make sure we are using reasonably long strings
                if (prefixFromStart.length > 20) matchIndexStart = trimmedItem.indexOf(prefixFromStart);
                if (prefixFromEnd.length > 20) matchIndexEnd = trimmedItem.indexOf(prefixFromEnd);
                if (prefixFromMiddle.length > 50) matchIndexMiddle = trimmedItem.indexOf(prefixFromMiddle);
                
                if ((matchIndexStart !== -1) || (matchIndexEnd !== -1) || (matchIndexMiddle !== -1)) {
                    itemMatches = true;
                    break;
                }
            }
            
            // If this item is in the main text chunk, include it in the highlight.
            if (itemMatches) {
                if (!item.classList) return;            
                item.classList.add('highlight');
                // Mark it for removal later.
                item.dataset.highlighted = true;
                if (appState.variables.localPrefs.highlightColor) {
                    item.dataset.highlightClass = appState.variables.localPrefs.highlightColor;
                    item.classList.add(appState.variables.localPrefs.highlightColor);
                }
            }
        });
        
    }

    appState.elements.libraryBtn.addEventListener('click', async () => {
        // First reset the book view.
        setActiveBook(null);
        appState.elements.libraryBtn.classList.add('bg-indigo-100', 'dark:bg-indigo-900', 'dark:bg-opacity-30');
        appState.elements.bookView.classList.add('hidden');
        
        if (appState.variables.currentUser)
        appState.elements.mainDiv.appendChild(await renderUserPdfs(currentUser));
        else appState.elements.mainDiv.appendChild(createFilesGrid([]));
    });

    appState.elements.playbackSpeed.addEventListener('input', () => {
        appState.elements.audioPlayer.playbackRate = appState.elements.playbackSpeed.value;
        appState.elements.playbackSpeedDisplay.textContent = appState.elements.playbackSpeed.value.toString() + "x";
    });

    appState.elements.stopBtn.addEventListener('click', stopAudioQueue);

    appState.elements.webPageLinkInput.addEventListener('change', async (e) => {
        const url = appState.elements.webPageLinkInput.value;
        if (!url) return;
        appState.elements.webPageLinkInput.disabled = true;
        appState.elements.filePickerModalURLLoadingIndicator.classList.toggle('hidden');

        try {
            new URL(url);
        } catch (error) {
            showNotification('Please enter a valid URL.', 'warn');
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
            appState.variables.fullBookText = data.text;
            
            if (appState.variables.activeBook?.source === 'local') {
                appState.variables.localBooks[appState.variables.activeBook.id].text = data.text;
                saveLocalBooks(appState);
            }
            
            // Make sure the page is updated.
            renderTextPage(1);

        } catch (error) {
            console.error('Error reading website:', error);
            showNotification(`Failed to read website: ${error.message}`, 'error');
        }

        appState.elements.filePickerModalURLLoadingIndicator.classList.toggle('hidden');
        appState.elements.webPageLinkInput.disabled = false;
    });

    async function saveOcrText(bookId, text) {
        try {
            const response = await fetch(`/api/users/${appState.variables.currentUser}/books/${bookId}`, {
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
            return appState.variables.onlineBooks.find(b => b.id === bookId);
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
                    showNotification('PDF OCR completed successfully.', 'success');

                    if (bookId && currentUser) {
                        const newOnlineBook = await saveOcrText(bookId, data.text);
                        if (newOnlineBook) {
                            setActiveBook({ ...newOnlineBook, source: 'online' });
                        } else {
                            // Fallback if the book couldn't be found after saving
                            console.error("Could not find online book after saving OCR text. Falling back to text view.");
                            appState.variables.fullBookText = data.text;
                            renderTextPage(1);
                        }
                    } else {
                        // Anonymous user flow
                        if (appState.variables.activeBook?.source === 'local') {
                            appState.variables.localBooks[appState.variables.activeBook.id].text = appState.variables.fullBookText;
                            saveLocalBooks(appState);
                        }
                        renderTextPage(1);
                    }
    
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    console.error('OCR failed:', data.detail);
                    showBookModal(`OCR failed: ${data.detail}`, 'error');
    
                } else console.log('OCR in progress...');
            } catch (error) {
                clearInterval(interval);
                console.error('Error polling for OCR result:', error);
                showNotification(`An error occurred while checking OCR status: ${error.message}`, 'error');
            }
        }, 2000); // Poll every 2 seconds
    }

    async function handlePdfUpload(file, bookId = null) {
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
                if (bookId && appState.variables.currentUser) {
                    saveOcrText(bookId, data.text);
                }
                appState.variables.fullBookText = data.text;
                if (appState.variables.activeBook?.source === 'local') {
                    appState.variables.localBooks[appState.variables.activeBook.id].text = appState.variables.fullBookText;
                    saveLocalBooks(appState);
                }
                appState.variables.totalTextPages = Math.max(1, Math.ceil(appState.variables.fullBookText.length / appState.variables.charsPerPage));
                renderTextPage(1);
            } else if (data.status === 'ocr_started') {
                showNotification('PDF contains no text. Starting background OCR...', 'info');
                pollOcrResult(data.task_id, bookId);
            } else {
                throw new Error('Received an unexpected response from the server.');
            }

        } catch (error) {
            console.error('Error reading PDF:', error);
            showNotification(`An error occurred: ${error.message}`, 'error');
        }
    }

    appState.elements.pdfFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        if (appState.variables.activeBook.source === 'local') {
            appState.variables.localBooks[appState.variables.activeBook.id].title = fileName.replace(`.${fileExtension}`, '');
            appState.elements.bookPageTitle.innerHTML = appState.variables.localBooks[appState.variables.activeBook.id].title;
        }

        if (fileExtension === 'pdf') {
            if (appState.variables.currentUser) {
                // If logged in, directly upload to server
                const formData = new FormData();
                formData.append('file', file);
                formData.append('content', fileName.replace(`.${fileExtension}`, '')); // Use filename as content

                try {
                    const response = await fetch(`/api/users/${appState.variables.currentUser}/pdfs`, {
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
                    hideFileModal(appState);
                    return; // Exit after server upload
                } catch (error) {
                    showNotification(`Error uploading PDF: ${error.message}`, 'error');
                    hideFileModal(appState);
                    return;
                }
            } else {
                // Fallback to local IndexedDB for anonymous users
                await handlePdfUpload(file);
                showNotification('PDF text extracted! Sign in to save PDF files.')
            }
        } else if (fileExtension === 'epub') {
            if (appState.variables.activeBook.source === 'local') {
                appState.variables.localBooks[appState.variables.activeBook.id].pdfId = null;
                saveLocalBooks(appState);
            }
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
                appState.variables.fullBookText = data.text;
                if (appState.variables.activeBook.source === 'local') {
                    appState.variables.localBooks[appState.variables.activeBook.id].text = appState.variables.fullBookText;
                    saveLocalBooks(appState);
                }
                appState.variables.totalTextPages = Math.max(1, Math.ceil(appState.variables.fullBookText.length / appState.variables.charsPerPage));
                renderTextPage(1);

            } catch (error) {
                console.error('Error reading EPUB:', error);
                showNotification(`An error occurred: ${error.message}`, error);
                appState.elements.textDisplay.innerHTML = '';
            }
        } else if (fileExtension === 'docx') {
            if (appState.variables.activeBook.source === 'local') {
                appState.variables.localBooks[appState.variables.activeBook.id].pdfId = null;
                saveLocalBooks(appState);
            }
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
                if (appState.variables.activeBook?.source === 'local') {
                    localBooks[appState.variables.activeBook.id].text = fullBookText;
                    saveLocalBooks(appState);
                }
                appState.variables.totalTextPages = Math.max(1, Math.ceil(appState.variables.fullBookText.length / appState.variables.charsPerPage));
                renderTextPage(1);

            } catch (error) {
                console.error('Error reading DOCX:', error);
                showNotification(`An error occurred: ${error.message}`, 'error');
                appState.elements.textDisplay.innerHTML = '';
            }
        } showNotification('Please select a valid PDF, EPUB, or DOCX file.', 'warn');
        
        hideFileModal(appState);
    });

    appState.elements.zoomInBtn.addEventListener('click', () => {
        if (!appState.variables.pdfDoc) return;
        appState.variables.currentScale += 0.25;
        renderPage(appState.variables.currentPageNum);
    });

    appState.elements.zoomOutBtn.addEventListener('click', () => {
        if (!appState.variables.pdfDoc) return;
        appState.variables.currentScale = Math.max(0.25, appState.variables.currentScale - 0.25);
        renderPage(appState.variables.currentPageNum);
    });

    appState.elements.engineSelect.addEventListener('change', (e) => { e.preventDefault(); updateVoices(appState) });

    appState.elements.generateBtn.addEventListener('click', () => {
        const bgNoiseAudio = document.getElementById('bg-noise-audio');
        if (appState.variables.isPlaying) {
            if (appState.variables.isPaused) {
                updatePlayerUI('PLAYING', appState);
                appState.elements.audioPlayer.play();
                appState.elements.bgNoiseAudio?.play();

            } else {
                updatePlayerUI('PAUSED', appState);
                appState.elements.audioPlayer.pause();
                bgNoiseAudio?.pause();
                
            }
        } else startSpeechGeneration();
    });

    appState.elements.modalCancelBtn.addEventListener('click', () => { hideBookModal(appState) });
    appState.elements.openFilePickerBtn.addEventListener('click', () => { showFileModal(appState) });
    appState.elements.closeFilePickerBtn.addEventListener('click', () => { hideFileModal(appState) });
    
    appState.elements.filePickerModal.addEventListener('click', (e) => {
        if (e.target === appState.elements.filePickerModal) hideFileModal(appState);
    });

    async function transcribeAudioFile(audioFile) {
        try {
            appState.elements.transcribeFileBtn.disabled = true;
            appState.elements.transcribeFileBtn.innerHTML = '<i class="animate-spin fas fa-rotate-right"></i> Processing...';
            
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
                const currentText = appState.elements.textDisplay.textContent || '';
                const newText = currentText + (currentText ? '\n\n' : '') + data.text;
                appState.elements.textDisplay.textContent = newText;
                
                if (appState.variables.activeBook && appState.variables.activeBook.source === 'local') {
                    appState.variables.localBooks[appState.variables.activeBook.id].text = newText;
                    saveLocalBooks(appState);
                }

                checkTextContent(appState);
                
                showNotification(`File transcription completed! Detected language: ${data.language || 'Unknown'}`, 'success');
            } else showNotification('No speech detected in the audio file.', 'warning');
            
        } catch (error) {
            console.error('Error transcribing audio file:', error);
            showNotification(`File transcription failed: ${error.message}`, 'error');
        } finally {
            appState.elements.transcribeFileBtn.disabled = false;
            appState.elements.transcribeFileBtn.innerHTML = '<span class="me-2">Transcribe File</span><i class="fas fa-file-audio"></i>';
        }
    }

    appState.elements.recordBtn.addEventListener('click', () => { startRecording(appState) });
    appState.elements.stopRecordBtn.addEventListener('click', () => { stopRecording(appState) });
    appState.elements.transcribeFileBtn.addEventListener('click', () => { appState.elements.audioFileInput.click() });
    
    appState.elements.audioFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await transcribeAudioFile(file);
        appState.elements.audioFileInput.value = '';
    });

    appState.elements.addAccountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginModal(appState);
    });

    appState.elements.loginModalCancelBtn.addEventListener('click', (e) => { e.preventDefault(); hideLoginModal(appState); });

    appState.elements.loginModal.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target === appState.elements.loginModal) hideLoginModal(appState);
    });

    const commandPaletteModal = document.getElementById('command-palette-modal');
    const commandPaletteInput = document.getElementById('command-palette-input');
    const commandList = document.getElementById('command-list');

    const commands = [
        { name: 'New Book', icon: 'fa-file-circle-plus', description: 'Create a new temporary book', action: () => { createNewBook(); hideCommandPalette(); } },
        { name: 'Delete Book', icon: 'fa-trash', description: 'Delete the currently active book', action: () => { 
            if (appState.variables.activeBook) {
                if (appState.variables.activeBook.source === 'online') {
                    deleteOnlineBook(appState.variables.activeBook.id);
                } else if (appState.variables.activeBook.source === 'local') {
                    deleteLocalBook(appState.variables.activeBook.id);
                }
                hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Rename Book', icon: 'fa-i-cursor', description: 'Rename the currently active book', action: () => { 
            if (appState.variables.activeBook) {
                if (appState.variables.activeBook.source === 'online') {
                    renameOnlineBook(appState.variables.activeBook);
                } else if (appState.variables.activeBook.source === 'local') {
                    renameLocalBook(appState.variables.activeBook);
                }
                hideCommandPalette();
            } else showNotification('No book is currently active.');
         } },

        { name: 'Import File', icon: 'fa-folder-open', description: 'Import a PDF or EPUB file', action: () => {
            if (appState.variables.activeBook) {
                showFileModal(appState); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Generate Speech', icon: 'fa-volume-high', description: 'Generate speech for the current text', action: () => {
            if (appState.variables.activeBook) {
                startSpeechGeneration(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Stop Playback', icon: 'fa-stop', description: 'Stop current audio playback', action: () => {
            if (appState.variables.activeBook) {
                stopAudioQueue(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Record Audio', icon: 'fa-microphone-lines', description: 'Start recording audio for transcription', action: () => {
            if (appState.variables.activeBook) {
                startRecording(appState); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Transcribe Audio File', icon: 'fa-file-signature', description: 'Transcribe an audio file', action: () => {
            if (appState.variables.activeBook) {
                audioFileInput.click(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Login/Create Account', icon: 'fa-user-plus', description: 'Login or create a new user account', action: () => { showLoginModal(appState); hideCommandPalette(); } },
        { name: 'Save Book', icon: 'fa-floppy-disk', description: 'Save the current book to your online account', action: () => {
            if (appState.variables.activeBook) {
                handleSaveBook(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Zoom In PDF', icon: 'fa-magnifying-glass-plus', description: 'Increase zoom level of PDF', action: () => {
            if (appState.variables.activeBook) {
                appState.elements.zoomInBtn?.click(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Zoom Out PDF', icon: 'fa-magnifying-glass-minus', description: 'Decrease zoom level of PDF', action: () => {
            if (appState.variables.activeBook) {
                appState.elements.zoomOutBtn?.click(); hideCommandPalette();
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
            
            let commandIcon = command.icon ? `<i class="me-2 fas ${command.icon}"></i>` : '';
            
            li.className = `p-2 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900 dark:hover:bg-opacity-30 rounded-lg ${index === selectedCommandIndex ? 'bg-indigo-200 dark:bg-indigo-900 dark:bg-opacity-30' : ''}`;
            li.innerHTML = `
                <div class="font-medium text-gray-800 dark:text-gray-300">
                    <span class="flex flex-row items-center">${commandIcon}${command.name}</span>
                </div>
                <div class="text-sm text-gray-700 dark:text-gray-500">${command.description}</div>
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

    appState.elements.commandsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (commandPaletteModal.classList.contains('hidden')) showCommandPalette();
        else hideCommandPalette();
    });

    async function fetchAndRenderOnlineBooks() {
        if (!appState.variables.currentUser) return;
        try {
            const response = await fetch(`/api/users/${appState.variables.currentUser}/books`);
            if (!response.ok) throw new Error('Failed to fetch online books.');
            const data = await response.json();
            appState.variables.onlineBooks = data.books || [];
            renderOnlineBooks();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    async function handleLogin() {
        const username = appState.elements.loginUsernameInput.value.trim();
        const password = appState.elements.loginPasswordInput.value.trim();
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
            appState.variables.currentUser = data.username;
            sessionStorage.setItem('currentUser', appState.variables.currentUser);
            updateCurrentUserUI(appState);
            hideLoginModal();
            showNotification('Login successful!', 'success');
            fetchAndRenderOnlineBooks();
            fetchAndRenderPodcasts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    function handleLogout() {
        appState.variables.currentUser = null;
        sessionStorage.removeItem('currentUser');
        appState.variables.onlineBooks = [];
        appState.variables.onlinePodcasts = [];
        renderOnlineBooks();
        renderOnlinePodcasts();
        updateCurrentUserUI(appState);
        showNotification('You have been logged out.', 'info');
    }

    async function handleCreateAccount() {
        const username = appState.elements.loginUsernameInput.value.trim();
        const password = appState.elements.loginPasswordInput.value.trim();
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
        if (!appState.variables.currentUser) {
            showNotification('You must be logged in to save a book.', 'warning');
            return;
        }
        if (!appState.variables.activeBook) {
            showNotification('No active book to save.', 'warning');
            return;
        }

        let bookData = {};
        let isUpdatingOnlineBook = appState.variables.activeBook.source === 'online';

        // Determine if the active book is a PDF based on its content or a flag
        const isPdfBook = appState.variables.activeBook.is_pdf ?? false;

        if (isPdfBook) {
            showNotification('PDFs are saved immediately upon upload. No further saving action is needed.', 'info');
            return;
        }

        // For text-based books, proceed with the existing save logic
        if (isUpdatingOnlineBook) {
            bookData.content = appState.variables.fullBookText; // Use full text
            bookData.is_pdf = false; // Explicitly mark as not a PDF
        } else {
            bookData.title = appState.variables.activeBook.title;
            bookData.content = appState.variables.localBooks[appState.variables.activeBook.id].text;
            bookData.is_pdf = false; // Explicitly mark as not a PDF
        }

        try {
            const url = isUpdatingOnlineBook 
                ? `/api/users/${appState.variables.currentUser}/books/${appState.variables.activeBook.id}`
                : `/api/users/${appState.variables.currentUser}/books`;
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
                if (appState.variables.localBooks[appState.variables.activeBook.id]) {
                    delete appState.variables.localBooks[appState.variables.activeBook.id];
                    saveLocalBooks(appState);
                    renderLocalBooks();
                }
                appState.variables.activeBook = null;
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
                    const bookToDelete = appState.variables.onlineBooks.find(book => book.id === bookId);
                    if (!bookToDelete) throw new Error("Book not found in online list.");

                    let url = `/api/users/${appState.variables.currentUser}/books/${bookId}`;

                    const response = await fetch(url, { method: 'DELETE' });
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || 'Failed to delete the book.');
                    }
                    const data = await response.json();
                    showNotification(data.message, 'success');

                    appState.variables.onlineBooks = appState.variables.onlineBooks.filter(book => book.id !== bookId);
                    renderOnlineBooks();

                    if (appState.variables.activeBook && appState.variables.activeBook.id === bookId) {
                        appState.variables.activeBook = null;
                        resetBookView(appState);
                    }
                } catch (error) {
                    showNotification(error.message, 'error');
                }
                hideBookModal(appState);
            },
            { showInput: false },
            appState
        );
    }

    function renameOnlineBook(book) {
        showBookModal(
            'Rename Book',
            'Rename',
            async () => {
                const newTitle = appState.elements.bookTitleInput.value;
                if (newTitle && newTitle.trim() !== '' && newTitle !== book.title) {
                    try {
                        const response = await fetch(`/api/users/${appState.variables.currentUser}/books/${book.id}`, {
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

                        const bookToUpdate = appState.variables.onlineBooks.find(b => b.id === book.id);
                        if (bookToUpdate) {
                            bookToUpdate.title = newTitle.trim();
                            renderOnlineBooks();
                            if (appState.variables.activeBook?.id === book.id) {
                                appState.elements.bookPageTitle.innerHTML = newTitle.trim();
                            }
                        }
                    } catch (error) {
                        showNotification(error.message, 'error');
                    }
                }
                hideBookModal(appState);
            },
            { showInput: true, inputValue: book.title },
            appState
        );
    }

    appState.elements.loginActionBtn.addEventListener('click', handleLogin);
    appState.elements.createAccountBtn.addEventListener('click', handleCreateAccount);
    appState.elements.logoutBtn.addEventListener('click', handleLogout);
    appState.elements.saveBookBtn.addEventListener('click', handleSaveBook);

    // Toggle account switcher dropdown
    appState.elements.accountSwitcherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const active = appState.elements.accountSwitcherMenu.classList.toggle('hidden');
        
        // Animate dropdown
        if (!active) {
            appState.elements.accountSwitcherMenu.style.opacity = '0';
            appState.elements.accountSwitcherMenu.style.transform = 'translateY(10px)';
            setTimeout(() => {
                appState.elements.accountSwitcherMenu.style.opacity = '1';
                appState.elements.accountSwitcherMenu.style.transform = 'translateY(0)';
            }, 10);
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        e.preventDefault();
        appState.elements.accountSwitcherMenu.classList.add('hidden');
    });
    
    // Prevent dropdown from closing when clicking inside it
    appState.elements.accountSwitcherMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Handle keyboard navigation
    appState.elements.accountSwitcherMenu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            accountSwitcherMenu.classList.add('hidden');
            accountSwitcherBtn.focus();
        }
    });
    
    // Smooth close animation
    appState.elements.accountSwitcherMenu.style.transition = 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out';
    
    // Initialize dropdown position
    appState.elements.accountSwitcherMenu.style.opacity = '0';
    appState.elements.accountSwitcherMenu.style.transform = 'translateY(10px)';

    appState.elements.generatePodcastBtn.addEventListener('click', () => {
        if (!appState.variables.currentUser) {
            showNotification('You must be logged in to generate a podcast.', 'warning');
            return;
        }

        let podcastText = appState.variables.fullBookText.trim(); // Use full text for podcast
        
        if (!podcastText) {
            showNotification('No text found!', 'warning');
            return;
        }

        showBookModal(
            'Generate Podcast', 
            'Generate', 
            async () => {
                const podcastTitle = appState.elements.bookTitleInput.value.trim();
                if (!podcastTitle) {
                    showNotification('Podcast title cannot be empty.', 'warning');
                    return;
                }

                hideBookModal(appState);
                appState.elements.generatePodcastBtn.disabled = true;
                appState.elements.generatePodcastBtn.innerHTML = '<i class="animate-spin fas fa-rotate-right"></i> Generating...';

                const engine = appState.elements.engineSelect.value;
                const voice = appState.elements.voiceSelect.value;
                const apiKey = null;

                if (appState.variables.pdfDoc) {
                    const canvas = appState.variables.currentMostVisiblePage;
                    podcastText = await getAllPdfText(pdfDoc, { 
                        skipHeadersNFooters: appState.elements.skipHeadersCheckbox.value,
                        canvasHeight: canvas.height 
                    });
                }

                const result = await generatePodcast(
                    appState.variables.currentUser, 
                    podcastTitle, 
                    podcastText, 
                    appState.variables.bookDetectedLang,
                    engine, 
                    voice, 
                    apiKey
                );

                if (result.success) {
                    showNotification(`Your podcast is generating and will be ready soon!`, 'success');
                    fetchAndRenderPodcasts();
                } else {
                    showNotification(`Failed to start podcast generation: ${result.error}`, 'error');
                }
                appState.elements.generatePodcastBtn.disabled = false;
                appState.elements.generatePodcastBtn.innerHTML = '<i class="fas fa-podcast"></i><span class="ms-2">New Podcast</span>';
            },
            { showInput: true, inputValue: appState.variables.activeBook ? appState.variables.activeBook.title : '' },
            appState
        );
    });

    async function fetchAndRenderPodcasts() {
        if (!appState.variables.currentUser) return;
        try {
            const result = await getPodcasts(appState.variables.currentUser);
            if (result.success) {
                appState.variables.onlinePodcasts = result.podcasts || [];
                renderOnlinePodcasts();
            } else {
                showNotification(`Failed to fetch podcasts: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    appState.elements.pdfFileInput.addEventListener('change', async (e) => {
        if (appState.variables.currentUser) appState.elements.saveBookBtn.classList.remove('hidden');
    });
    
    appState.elements.themeToggle.addEventListener('change', () => {
        if (appState.elements.themeToggle.checked) {
            document.documentElement.classList.add('dark');
            appState.variables.localPrefs.theme = 'dark'
        } else {
            document.documentElement.classList.remove('dark');
            appState.variables.localPrefs.theme = 'light';
        }

        handlePrefs({theme: appState.variables.localPrefs.theme});
    });

    appState.elements.prevChunkButton.addEventListener('click', goToPreviousAudioChunk);
    appState.elements.nextChunkButton.addEventListener('click', goToNextAudioChunk);

    // Check text content when text changes (add to existing listener if any)
    appState.elements.textDisplay.addEventListener('input', () => { checkTextContent(appState) });
    appState.elements.textDisplay.addEventListener('paste', () => {
        // Use setTimeout to check after paste operation completes
        setTimeout(() => { checkTextContent(appState) }, 10);
    });

    // Paste Clipboard button functionality
    appState.elements.pasteClipboardOverlayBtn.addEventListener('click', (e) => {
        navigator.clipboard.readText().then(text => {
            if (text.trim().length < 1)
            return;

            appState.elements.textDisplay.textContent = text;
            handleTextBookUpdate();
            checkTextContent(appState);
        });
    });

    appState.elements.currentUserButton.addEventListener('click', (e) => {
        e.preventDefault();
        renderNotifications(appState);  
        appState.elements.notificationDropdown.classList.remove('hidden');
    });
    
    // Theme toggle functionality
    appState.elements.themeToggle.addEventListener('change', function() {
        const html = document.documentElement;
        if (this.checked) {
            html.classList.add('dark');
            appState.variables.localPrefs.theme = 'dark';
            handlePrefs({theme: appState.variables.localPrefs.theme});
        } else {
            html.classList.remove('dark');
            appState.variables.localPrefs.theme = 'light';
            handlePrefs({theme: appState.variables.localPrefs.theme});
        }
    });

    // Toggle settings dropup
    appState.elements.settingsDropupToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        appState.elements.settingsDropupMenu.classList.toggle('hidden');
        
        // Animate dropup
        if (!appState.elements.settingsDropupMenu.classList.contains('hidden')) {
            appState.elements.settingsDropupMenu.style.opacity = '0';
            appState.elements.settingsDropupMenu.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                appState.elements.settingsDropupMenu.style.opacity = '1';
                appState.elements.settingsDropupMenu.style.transform = 'translateY(0)';
            }, 10);
        }
    });
    
    // Close dropups when clicking outside
    document.addEventListener('click', (e) => {
        e.preventDefault();
        appState.elements.settingsDropupMenu.classList.add('hidden');
        appState.elements.notificationDropdown.classList.add('hidden');
    });
    
    // Prevent dropup from closing when clicking inside it
    appState.elements.settingsDropupMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Handle keyboard navigation
    appState.elements.settingsDropupMenu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            appState.elements.settingsDropupMenu.classList.add('hidden');
            appState.elements.settingsDropupToggleBtn.focus();
        }
    });

    appState.elements.bgNoiseToggle.addEventListener("change", () => {
        appState.elements.bgNoiseSelect.parentElement.classList.toggle('hidden');

        if (!appState.elements.bgNoiseToggle.checked) {
            document.getElementById('bg-noise-audio').remove();
            return;
        }
        
        // Reset list
        appState.elements.bgNoiseSelect.innerHTML = `<option value="none">None (Disable)</option>`;

        // Fetch and populate background noise options
        fetch('/api/noise_files')
            .then(response => response.json())
            .then(response => {
                
                response.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file;
                    option.textContent = file.replace('.wav', '').replace('.ogg', '').replace(/_/g, ' ');
                    appState.elements.bgNoiseSelect.appendChild(option);
                });

                const bgNoiseAudio = document.createElement('audio');
                bgNoiseAudio.id = 'bg-noise-audio';
                bgNoiseAudio.loop = true;
                bgNoiseAudio.classList.add('hidden');

                // Quick hack for gapless looping
                bgNoiseAudio.addEventListener('timeupdate', (e) => {
                    var buffer = .44
                    if(e.target.currentTime > e.target.duration - buffer){
                        e.target.currentTime = 0
                        e.target.play()
                    }
                });

                appState.elements.bgNoiseSelect.parentNode.insertBefore(bgNoiseAudio, appState.elements.bgNoiseSelect.nextSibling);

            })
            .catch(error => console.error('Error fetching noise files:', error));
    });

    appState.elements.bgNoiseSelect.addEventListener("change", (e) => {
        const bgNoiseAudio = document.getElementById('bg-noise-audio');

        if (bgNoiseAudio) {

            if (e.target.value === "none") {
                bgNoiseAudio.pause();
                return;
            }

            bgNoiseAudio.src = `./static/audio/noise/${e.target.value}`;
            bgNoiseAudio.play();
        }
        
    });

    appState.elements.bgNoiseVolume.addEventListener("change", (e) => {
        const bgNoiseAudio = document.getElementById('bg-noise-audio');
        if (bgNoiseAudio) bgNoiseAudio.volume = e.target.value;
    });

    // Infinite Scroll handlers
    const infiniteScrollPageCache = 4;
    let scrollTimeout = 0;

    window.addEventListener('scroll', () => {

        const bookInfo = document.querySelector('#book-info');
        bookInfo?.classList.remove('hidden', 'opacity-0');

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            updateCurrentPage(appState);
            setTimeout(() => {
                bookInfo?.classList.add('opacity-0');
            }, 1500);
        }, 100);

    });
    
    const downwardsScroll = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;

        let topPage = null;
        let currentPage = appState.variables.textCurrentPage;
        let pageLimit = appState.variables.totalTextPages;

        let container = {
            type: 'text',
            element: appState.elements.textDisplay
        };

        if (appState.variables.pdfDoc) {
            container.type = 'pdf';
            container.element = appState.elements.pdfViewer;
            pageLimit = appState.variables.isTwoPageView ? appState.variables.pdfDoc.numPages -1 : appState.variables.pdfDoc.numPages;
            // Careful not to mix these. currentPage is local
            // currentPageNum is the global PDF page tracker.
            currentPage = appState.variables.currentPageNum;
        };

        if (currentPage >= pageLimit) return;

        const lastRenderedPage = container.element.children[container.element.children.length - 1];

        if (container.type == 'pdf')
        renderPage(Number.parseInt(lastRenderedPage.dataset.page) + (appState.variables.isTwoPageView ? 2 : 1));
        else renderTextPage(Number.parseInt(lastRenderedPage.dataset.page) + 1);

        // Do a simple DOM cleanup. We lock this during generation to avoid unloading
        // a page being read.
        if (container.element.children.length > infiniteScrollPageCache && !appState.variables.isPlaying)
        container.element.children[0].remove();

        // Try to force DOM update.
        void container.element.offsetHeight;
        requestAnimationFrame(() => {
            topPage = container.element.children[0];

            // Update upwards scrol
            upwardsScroll.disconnect();
            upwardsScroll.observe(topPage);
        });
    });

    // This is the more complicated of the two.
    const upwardsScroll = new IntersectionObserver((entries) => {

        if (!entries[0].isIntersecting) return;

        const oldTopPage = entries[0].target;
        if (oldTopPage) upwardsScroll.unobserve(oldTopPage);

        let currentPage = appState.variables.textCurrentPage;

        let container = {
            type: 'text',
            element: appState.elements.textDisplay
        };

        if (appState.variables.pdfDoc) {
            container.type = 'pdf';
            container.element = appState.elements.pdfViewer;
            // Careful not to mix these. currentPage is local
            // currentPageNum is the global PDF page tracker.
            currentPage = appState.variables.currentPageNum;
        };

        if (currentPage == 1) return;

        const oldScrollHeight = container.element.scrollHeight;
        const firstRenderedPage = container.element.children[0];

        if (container.type == 'pdf') renderPage(Number.parseInt(firstRenderedPage.dataset.page) - (appState.variables.isTwoPageView ? 2 : 1), false, false);
        else renderTextPage(Number.parseInt(firstRenderedPage.dataset.page) - 1, false);

        // Do a simple DOM cleanup. We lock this during generation to avoid unloading
        // a page being read.
        if (container.element.children.length > infiniteScrollPageCache && !appState.variables.isPlaying) {
            container.element.children[container.element.children.length - 1].remove(); // Remove last entry
        }

        // Try to force DOM update.
        void container.element.offsetHeight;

        // Wait for the browser to paint the new page
        requestAnimationFrame(() => {
            // Calculate the height that was just added
            const newScrollHeight = container.element.scrollHeight;
            const heightAdded = newScrollHeight - (oldScrollHeight * 1.5);

            // Adjust the scroll position to keep the user in the same place
            container.element.scrollTop = container.element.scrollTop + heightAdded;

            // Observe the new top page
            const newTopPage = container.element.children[0];
            if (newTopPage) upwardsScroll.observe(newTopPage);
        });
    });
    
    // Smooth animations
    appState.elements.settingsDropupMenu.style.transition = 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out';
    appState.elements.settingsDropupMenu.style.opacity = '0';
    appState.elements.settingsDropupMenu.style.transform = 'translateY(-10px)';

    // Initial load functions
    const savedUser = sessionStorage.getItem('currentUser');

    if (savedUser) {
        appState.variables.currentUser = savedUser;
        updateCurrentUserUI(appState);
        fetchAndRenderOnlineBooks();
        fetchAndRenderPodcasts();
    }
    
    setBodyFont();
    renderNotifications(appState);
    renderLocalBooks();
    updateVoices(appState);
});