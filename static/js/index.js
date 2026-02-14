/*
 * -- index.js
 * --
 * -- This file contains most of the UI for the main app.
 * -- It's structed "top to bottom", mirroring the HTML of index.html.
 *
 */

// Import PDF.js
import * as pdfjsLib from './pdf.min.mjs';

// Import podcast generation
import { getPodcasts, generatePodcast, deletePodcast } from './podcast.js';

// Import Speech Generation functions
import { generateSpeech, generateSpeechWithTiming } from "./speechGen.js";

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
    splitTextIntoChunksAsync,
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

    // Track Ctrl key state for PDF chunk interaction
    // Chunks are only clickable when Ctrl is held, allowing normal text selection otherwise
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Control' || e.key === 'Meta') { // Meta for Mac Cmd key
            document.body.classList.add('ctrl-held');
        }
        
        // Alt+Q: Read selected text
        if (e.altKey && e.key === 'q') {
            e.preventDefault();
            const selectedText = window.getSelection().toString().trim();
            
            if (selectedText && selectedText.length > 0) {
                console.log('🎯 Alt+Q pressed - Reading selected text:', selectedText.substring(0, 50) + '...');
                showNotification('📢 Reading selected text: "' + selectedText.substring(0, 40) + '..."', 'info');
                
                // Process and play the selected text
                processTextAndPlay(selectedText, appState.variables.currentPageNum || 1);
            } else {
                showNotification('⚠️ No text selected. Select text and press Alt+Q to read it.', 'warning');
            }
        }
        
        // ?: Show keyboard shortcuts
        if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Only if not typing in an input
            if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                if (appState.elements.shortcutsModal) {
                    appState.elements.shortcutsModal.classList.remove('hidden');
                }
            }
        }
        
        // Space: Play/Pause audio
        if (e.key === ' ' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Only if not typing in an input
            if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                if (appState.variables.isPlaying && !appState.variables.isPaused) {
                    // Pause
                    appState.elements.audioPlayer.pause();
                    appState.variables.isPaused = true;
                    showNotification('⏸️ Paused', 'info');
                } else if (appState.variables.isPaused) {
                    // Resume
                    appState.elements.audioPlayer.play();
                    appState.variables.isPaused = false;
                    showNotification('▶️ Playing', 'info');
                }
            }
        }
        
        // Arrow keys: Navigate pages (only in PDF mode)
        if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                if (appState.variables.pdfDoc) {
                    e.preventDefault();
                    if (e.key === 'ArrowRight') {
                        // Next page
                        const nextPage = Math.min(appState.variables.currentPageNum + 1, appState.variables.pdfDoc.numPages);
                        if (nextPage !== appState.variables.currentPageNum) {
                            appState.variables.isManualPageChange = true;
                            appState.elements.pdfViewer.innerHTML = '';
                            renderPage(nextPage).then(() => {
                                appState.variables.isManualPageChange = false;
                            });
                        }
                    } else if (e.key === 'ArrowLeft') {
                        // Previous page
                        const prevPage = Math.max(appState.variables.currentPageNum - 1, 1);
                        if (prevPage !== appState.variables.currentPageNum) {
                            appState.variables.isManualPageChange = true;
                            appState.elements.pdfViewer.innerHTML = '';
                            renderPage(prevPage).then(() => {
                                appState.variables.isManualPageChange = false;
                            });
                        }
                    }
                }
            }
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Control' || e.key === 'Meta') {
            document.body.classList.remove('ctrl-held');
        }
    });
    
    // Remove class when window loses focus
    window.addEventListener('blur', () => {
        document.body.classList.remove('ctrl-held');
    });

    // Detect text selection and show Alt+Q hint
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText && selectedText.length > 0) {
            document.body.classList.add('has-selection');
        } else {
            document.body.classList.remove('has-selection');
        }
    });

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
            shortcutsBtn: document.getElementById('shortcuts-btn'),
            shortcutsModal: document.getElementById('shortcuts-modal'),
            shortcutsCloseBtn: document.getElementById('shortcuts-close-btn'),
            accountSwitcherBtn: document.getElementById('account-switcher-btn'),
            accountSwitcherMenu: document.getElementById('account-switcher-menu'),
            currentUserButton: document.getElementById('current-user-button'),
            generatePodcastBtn: document.getElementById('create-offline-podcast-btn'),
            downloadAudioBtn: document.getElementById('download-link'),
            zoomInBtn: document.getElementById('zoom-in-btn'),
            zoomOutBtn: document.getElementById('zoom-out-btn'),
            fitWidthBtn: document.getElementById('fit-width-btn'),
            fitPageBtn: document.getElementById('fit-page-btn'),
            rotateLeftBtn: document.getElementById('rotate-left-btn'),
            rotateRightBtn: document.getElementById('rotate-right-btn'),
            firstPageBtn: document.getElementById('first-page-btn'),
            lastPageBtn: document.getElementById('last-page-btn'),
            pageInput: document.getElementById('page-input'),
            zoomLevel: document.getElementById('zoom-level'),
            pdfSearchBtn: document.getElementById('pdf-search-btn'),
            pdfSearchBar: document.getElementById('pdf-search-bar'),
            pdfSearchInput: document.getElementById('pdf-search-input'),
            pdfSearchPrev: document.getElementById('pdf-search-prev'),
            pdfSearchNext: document.getElementById('pdf-search-next'),
            pdfSearchClose: document.getElementById('pdf-search-close'),
            pdfSearchResults: document.getElementById('pdf-search-results'),
            debugModeBtn: document.getElementById('debug-mode-btn'),
            pdfLoading: document.getElementById('pdf-loading'),
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
            pdfTextLayer: document.getElementById('pdf-text-layer'),
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
            pdfTextPositions: [], // Backend-extracted text positions
            debugMode: false, // Debug mode for development
            keyboardShortcutsVisible: false, // Keyboard shortcuts overlay

            // Speech to Text variables
            mediaRecorder: null,
            audioChunks: [],
            isRecording: false,
            currentUser: null,
            isTwoPageView: false,
            currentScale: 1.5, // Initial scale
            currentRotation: 0, // PDF rotation angle
            searchMatches: [], // Store PDF search matches
            currentSearchIndex: -1, // Current search result index
            isManualPageChange: false, // Flag to prevent infinite scroll interference

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
            // Word-by-word highlighting
            currentWordIndex: 0,
            currentWordCount: 0,
            currentChunkId: null,
            currentPdfWordIndex: 0, // For PDF word-by-word highlighting
            
            // Timing-based highlighting for backend PDF rendering
            useTimingBasedHighlighting: false, // Enable for PDFs with backend processing
            currentChunkTimingData: null, // Store timing data for current chunk
            audioTimingData: {}, // Cache timing data for all chunks
        },
        functions: {
            showNotification: showNotification,
            getCurrentMainVisiblePage: getCurrentMainVisiblePage,
            readableUnixTime: readableUnixTime
        },
    };
    // Set workerSrc for PDF.js
    pdfjsLib.GlobalWorkerOptions.workerSrc = './static/js/pdf.worker.min.mjs';

    // Debug: Log PDF control button initialization
    console.log('🔧 PDF Control Elements Initialization:');
    console.log('  Zoom In Button:', appState.elements.zoomInBtn ? '✅ Found' : '❌ Missing');
    console.log('  Zoom Out Button:', appState.elements.zoomOutBtn ? '✅ Found' : '❌ Missing');
    console.log('  Fit Width Button:', appState.elements.fitWidthBtn ? '✅ Found' : '❌ Missing');
    console.log('  Fit Page Button:', appState.elements.fitPageBtn ? '✅ Found' : '❌ Missing');
    console.log('  Rotate Left Button:', appState.elements.rotateLeftBtn ? '✅ Found' : '❌ Missing');
    console.log('  Rotate Right Button:', appState.elements.rotateRightBtn ? '✅ Found' : '❌ Missing');
    console.log('  First Page Button:', appState.elements.firstPageBtn ? '✅ Found' : '❌ Missing');
    console.log('  Last Page Button:', appState.elements.lastPageBtn ? '✅ Found' : '❌ Missing');
    console.log('  Page Input:', appState.elements.pageInput ? '✅ Found' : '❌ Missing');
    console.log('  Zoom Level Display:', appState.elements.zoomLevel ? '✅ Found' : '❌ Missing');
    console.log('  PDF Search Button:', appState.elements.pdfSearchBtn ? '✅ Found' : '❌ Missing');
    console.log('  PDF Viewer:', appState.elements.pdfViewer ? '✅ Found' : '❌ Missing');

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

    // This function highlights only plain-text with word-by-word tracking
    function highlightChunk(chunkText) {
        if (!appState.variables.currentReadingPage) {
            console.warn('No currentReadingPage set');
            return;
        }
        
        // Clear any existing word highlights
        const existingWords = appState.variables.currentReadingPage.querySelectorAll('.word-span');
        existingWords.forEach(span => {
            const text = span.textContent;
            span.replaceWith(document.createTextNode(text));
        });
        
        // Get clean text content
        const fullText = appState.variables.currentReadingPage.textContent;
        
        // Normalize whitespace for better matching
        const normalizedChunk = chunkText.trim().replace(/\s+/g, ' ');
        const normalizedFull = fullText.replace(/\s+/g, ' ');
        let startIndex = normalizedFull.indexOf(normalizedChunk);

        // If exact match not found, try first few words
        if (startIndex === -1) {
            const firstWords = normalizedChunk.split(' ').slice(0, 5).join(' ');
            startIndex = normalizedFull.indexOf(firstWords);
        }

        if (startIndex === -1) {
            console.error("Could not find chunk text to highlight");
            console.debug('Looking for:', normalizedChunk.substring(0, 100));
            console.debug('In text:', normalizedFull.substring(0, 200));
            return;
        }

        let highlightColor = appState.variables.localPrefs.highlightColor || '';
        const chunkId = `chunk-${appState.variables.currentChunkIndex}`;

        // Map normalized position back to original text position
        let actualStartIdx = 0;
        let normPos = 0;
        for (let i = 0; i < fullText.length && normPos < startIndex; i++) {
            const char = fullText[i];
            if (char !== ' ' || fullText[i-1] !== ' ') {
                normPos++;
            }
            actualStartIdx = i + 1;
        }
        
        // Split chunk into words for highlighting (no sentence wrapper)
        const words = chunkText.split(/(\s+)/);
        let highlightedHtml = '';
        
        let wordIndex = 0;
        words.forEach(word => {
            if (word.trim() !== '') {
                // Each word gets a span for word-by-word highlighting
                highlightedHtml += `<span class="word-span ${highlightColor}" data-chunk-id="${chunkId}" data-word-index="${wordIndex}">${word}</span>`;
                wordIndex++;
            } else {
                highlightedHtml += word;
            }
        });

        // Find end position by counting words in original text
        let actualEndIdx = actualStartIdx;
        let wordsFound = 0;
        let inWord = false;
        for (let i = actualStartIdx; i < fullText.length && wordsFound < wordIndex; i++) {
            const char = fullText[i];
            if (/\S/.test(char)) {
                if (!inWord) {
                    wordsFound++;
                    inWord = true;
                }
            } else {
                inWord = false;
            }
            actualEndIdx = i + 1;
        }
        
        // Replace text with highlighted version
        appState.variables.currentReadingPage.innerHTML = fullText.substring(0, actualStartIdx) +
                            highlightedHtml +
                            fullText.substring(actualEndIdx);
        
        // Store word count and chunk ID
        appState.variables.currentWordCount = wordIndex;
        appState.variables.currentWordIndex = 0;
        appState.variables.currentChunkId = chunkId;
    }

    function unhighlightChunk(chunkText) {
        // Remove all word-span elements and restore plain text
        if (!appState.variables.currentReadingPage) return;
        
        const wordSpans = appState.variables.currentReadingPage.querySelectorAll('.word-span');
        wordSpans.forEach(span => {
            const text = span.textContent;
            span.replaceWith(document.createTextNode(text));
        });
        
        // Reset word tracking
        appState.variables.currentWordIndex = 0;
        appState.variables.currentWordCount = 0;
        appState.variables.currentChunkId = null;
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

        if (isPdfBook) {
            let pdfData;
            
            if (appState.variables.currentUser) {
                // Use POST endpoint to get PDF data as base64 JSON to bypass download managers like IDM
                const dataUrl = book.content + '/data';  // Append /data to the PDF URL
                
                const response = await fetch(dataUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to fetch PDF data from ${dataUrl}: ${response.status} - ${errorText}`);
                }
                
                const jsonData = await response.json();
                
                if (!jsonData.data || jsonData.size === 0) {
                    throw new Error('PDF file is empty (0 bytes)');
                }
                
                // Store text positions from backend
                if (jsonData.text_positions && jsonData.text_positions.length > 0) {
                    appState.variables.pdfTextPositions = jsonData.text_positions;
                    console.log('✅ Received text positions for', jsonData.text_positions.length, 'pages from backend');
                    console.log('📊 First page dimensions:', {
                        width: jsonData.text_positions[0]?.width,
                        height: jsonData.text_positions[0]?.height,
                        items: jsonData.text_positions[0]?.text_items?.length
                    });
                    
                    // Show helpful notification about PDF interaction features
                    setTimeout(() => {
                        showNotification('💡 PDF Tips: Hover over text to highlight • Hold Ctrl+Click to start reading • Select text to copy', 'info');
                    }, 1500);
                } else {
                    console.warn('⚠️ No text positions received from backend');
                    appState.variables.pdfTextPositions = [];
                    showNotification('⚠️ Text selection may not be available for this PDF', 'warning');
                }
                
                // Decode base64 to binary
                const binaryString = atob(jsonData.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                pdfData = bytes.buffer;
                
            } else if (book.source === 'local' && appState.variables.localBooks[book.id].pdfData) {
                // Use locally stored PDF data for anonymous users
                pdfData = appState.variables.localBooks[book.id].pdfData;
            }

            if (pdfData) {
                // Show loading indicator
                if (appState.elements.pdfLoading) {
                    appState.elements.pdfLoading.classList.remove('hidden');
                }
                
                try {
                    appState.variables.pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
                    const lastPage = parseInt(localStorage.getItem(appState.variables.pdfDoc.fingerprints[0])) || 1;
                    
                    // Render initial page WITHOUT observers to prevent multiple triggers
                    appState.variables.isManualPageChange = true;
                    await renderPage(lastPage);
                    
                    // Delay observer attachment to let DOM fully settle
                    setTimeout(() => {
                        const firstPage = appState.elements.pdfViewer.children[0];
                        if (firstPage && window.upwardsScroll) {
                            window.upwardsScroll.observe(firstPage);
                            console.log('✅ [DEBUG] Initial upward observer attached to first page');
                        }
                        if (window.downwardsScroll) {
                            const toolbarSpace = document.querySelector("#toolbar-space");
                            if (toolbarSpace) {
                                window.downwardsScroll.observe(toolbarSpace);
                                console.log('✅ [DEBUG] Initial downward observer attached to toolbar');
                            }
                        }
                        appState.variables.isManualPageChange = false;
                    }, 500); // Wait for DOM to fully settle
                    
                    // Hide loading indicator
                    if (appState.elements.pdfLoading) {
                        appState.elements.pdfLoading.classList.add('hidden');
                    }
                    
                    // Show helpful notification about Ctrl+Click feature
                    setTimeout(() => {
                        showNotification('💡 Tip: Hold Ctrl and click on blue chunks to start reading from that point', 'info');
                    }, 1000);
                } catch (error) {
                    // Hide loading indicator
                    if (appState.elements.pdfLoading) {
                        appState.elements.pdfLoading.classList.add('hidden');
                    }
                    
                    console.error('❌ Failed to load PDF:', error);
                    let errorMsg = 'Failed to load PDF: ';
                    if (error.message.includes('empty')) {
                        errorMsg += 'The PDF file is empty or corrupted. Try re-uploading.';
                    } else if (error.message.includes('Invalid')) {
                        errorMsg += 'The PDF format is not supported or is corrupted.';
                    } else {
                        errorMsg += error.message || 'Unknown error occurred';
                    }
                    showNotification(errorMsg, 'error');
                    resetPdfView(appState);
                    // Fall back to text display
                    isPdfBook = false;
                    appState.variables.fullBookText = bookContent || '';
                    appState.variables.totalTextPages = Math.max(1, Math.ceil(appState.variables.fullBookText.length / appState.variables.charsPerPage));
                    const lastTextPage = parseInt(localStorage.getItem(`text-page-${book.id}`)) || 1;
                    renderTextPage(lastTextPage);
                }
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

        // Delay observer attachment for PDFs to prevent multiple triggers
        const observerDelay = book.is_pdf ? 500 : 0;
        
        setTimeout(() => {
            // Start scroll events
            if (book.is_pdf) {
                scrollCompensationElement = appState.elements.pdfViewer.children[0];
                if (scrollCompensationElement) {
                    upwardsScroll.observe(scrollCompensationElement);
                    console.log('✅ [DEBUG] Library PDF - upward observer attached');
                }
            } else {
                scrollCompensationElement = appState.elements.textDisplay.children[0];
                if (scrollCompensationElement) {
                    upwardsScroll.observe(scrollCompensationElement);
                }
            }

            // Only scroll if not on first page.
            if (scrollCompensationElement && scrollCompensationElement.dataset.page > 1) {
                document.scrollingElement.scrollTop = scrollCompensationElement.scrollHeight + 100;
            }

            downwardsScroll.observe(document.querySelector("#toolbar-space"));
            if (book.is_pdf) {
                console.log('✅ [DEBUG] Library PDF - downward observer attached');
            }
        }, observerDelay);
        
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
            appState.variables.localBooks[appState.variables.activeBook.id].skipHeadersNFooters = appState.elements.skipHeadersCheckbox.checked;
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

        // Check if we're using timing-based highlighting with backend rendering
        const hasBackendRendering = document.querySelector('.backend-text-span') !== null;
        const hasTimingData = currentAudio.timingData && appState.variables.useTimingBasedHighlighting;
        
        if (appState.variables.pdfDoc) {
            // Skip chunk highlighting if we have timing-based word highlighting
            if (!(hasBackendRendering && hasTimingData)) {
                await highlightPdfChunk(currentAudio.text);
            }
        }
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

        // Setup word-by-word highlighting for plain text
        if (!appState.variables.pdfDoc && fastFormatDetect(appState.elements.textDisplay.innerHTML) !== 'html') {
            appState.elements.audioPlayer.ontimeupdate = () => {
                // Check if word highlighting is enabled
                const enableWordHighlight = appState.variables.localPrefs?.enableWordHighlight !== false;
                if (!enableWordHighlight) return;
                
                const currentTime = appState.elements.audioPlayer.currentTime;
                const duration = appState.elements.audioPlayer.duration;
                
                if (duration && appState.variables.currentWordCount > 0 && appState.variables.currentChunkId) {
                    // Calculate which word should be highlighted based on time
                    const progress = currentTime / duration;
                    const targetWordIndex = Math.floor(progress * appState.variables.currentWordCount);
                    
                    if (targetWordIndex !== appState.variables.currentWordIndex && targetWordIndex < appState.variables.currentWordCount) {
                        // Get word highlight color from prefs
                        const wordColor = appState.variables.localPrefs?.wordHighlightColor || appState.variables.localPrefs?.highlightColor || '';
                        
                        // Remove highlight from previous word
                        const prevWord = document.querySelector(`span.word-span.highlight-word[data-chunk-id="${appState.variables.currentChunkId}"]`);
                        if (prevWord) {
                            prevWord.classList.remove('highlight-word');
                            // Remove color class
                            if (wordColor) prevWord.classList.remove(wordColor);
                        }
                        
                        // Highlight new word
                        const newWord = document.querySelector(`span.word-span[data-chunk-id="${appState.variables.currentChunkId}"][data-word-index="${targetWordIndex}"]`);
                        if (newWord) {
                            newWord.classList.add('highlight-word');
                            // Add color class
                            if (wordColor) newWord.classList.add(wordColor);
                        }
                        
                        appState.variables.currentWordIndex = targetWordIndex;
                    }
                }
            };
        } else if (appState.variables.pdfDoc) {
            // Setup word-by-word highlighting for PDF text spans
            appState.elements.audioPlayer.ontimeupdate = () => {
                // Check if word highlighting is enabled
                const enableWordHighlight = appState.variables.localPrefs?.enableWordHighlight !== false;
                if (!enableWordHighlight) return;
                
                const currentTime = appState.elements.audioPlayer.currentTime;
                const duration = appState.elements.audioPlayer.duration;
                
                if (!duration) return;
                
                // Check if we have timing data for precision highlighting
                const currentAudio = appState.variables.audioQueue[appState.variables.currentChunkIndex];
                const timingData = currentAudio?.timingData;
                
                if (timingData && timingData.words && appState.variables.useTimingBasedHighlighting) {
                    // Precision timing-based highlighting using backend timing data
                    const wordColor = appState.variables.localPrefs?.wordHighlightColor || appState.variables.localPrefs?.highlightColor || '';
                    
                    // Find the word that should be highlighted at current time
                    const currentWord = timingData.words.find(word => 
                        currentTime >= word.startTime && currentTime < word.endTime && !word.skip
                    );
                    
                    if (currentWord && currentWord.index !== undefined) {
                        // Remove previous highlight
                        const prevHighlighted = document.querySelector('.backend-text-span.pdf-text-word-highlight');
                        if (prevHighlighted) {
                            prevHighlighted.classList.remove('pdf-text-word-highlight');
                            if (wordColor) prevHighlighted.classList.remove(wordColor);
                        }
                        
                        // Calculate global word index
                        // timingData.startOffset tells us where this chunk starts in global text
                        // currentWord.index is the word position within the chunk
                        const chunk = appState.variables.allTextChunks[appState.variables.currentChunkIndex];
                        
                        // Find the first text span of this chunk to determine offset
                        const allTextSpans = document.querySelectorAll(`.backend-text-span`);
                        const chunkText = chunk.text.trim();
                        const chunkWords = chunkText.split(/\s+/);
                        
                        // Search for the chunk's starting word in the spans to get base index
                        let baseWordIdx = -1;
                        const firstChunkWord = chunkWords[0];
                        
                        for (const span of allTextSpans) {
                            const spanText = span.textContent.trim();
                            if (spanText.includes(firstChunkWord) || firstChunkWord.includes(spanText)) {
                                baseWordIdx = parseInt(span.dataset.wordIdx || '-1');
                                if (baseWordIdx >= 0) break;
                            }
                        }
                        
                        if (baseWordIdx >= 0) {
                            const targetWordIdx = baseWordIdx + currentWord.index;
                            
                            // Find and highlight the element with this word index
                            const targetSpan = document.querySelector(`.backend-text-span[data-word-idx="${targetWordIdx}"]`);
                            if (targetSpan) {
                                targetSpan.classList.add('pdf-text-word-highlight');
                                if (wordColor) targetSpan.classList.add(wordColor);
                                
                                // Scroll to keep highlighted word visible
                                targetSpan.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                            }
                        }
                    }
                } else {
                    // Fallback: duration-based highlighting (less precise)
                    const currentPageNum = appState.variables.currentReadingPage?.dataset?.page;
                    if (!currentPageNum) return;
                    
                    const textSpans = document.querySelectorAll(`.backend-text-span[data-page="${currentPageNum}"]`);
                    if (textSpans.length === 0) return;
                    
                    // Calculate progress and target word index
                    const progress = currentTime / duration;
                    const targetWordIndex = Math.floor(progress * textSpans.length);
                    
                    if (targetWordIndex !== appState.variables.currentPdfWordIndex && targetWordIndex < textSpans.length) {
                        // Get word highlight color from prefs
                        const wordColor = appState.variables.localPrefs?.wordHighlightColor || appState.variables.localPrefs?.highlightColor || '';
                        
                        // Remove previous word highlight
                        const prevHighlighted = document.querySelector('.pdf-text-word-highlight');
                        if (prevHighlighted) {
                            prevHighlighted.classList.remove('pdf-text-word-highlight');
                            // Remove color class
                            if (wordColor) {
                                prevHighlighted.classList.remove(wordColor);
                            }
                        }
                        
                        // Add word highlight to current word
                        const currentWord = textSpans[targetWordIndex];
                        if (currentWord) {
                            currentWord.classList.add('pdf-text-word-highlight');
                            // Add color class
                            if (wordColor) {
                                currentWord.classList.add(wordColor);
                            }
                        }
                        
                        appState.variables.currentPdfWordIndex = targetWordIndex;
                    }
                }
            };
        } else {
            // Clear ontimeupdate for HTML modes
            appState.elements.audioPlayer.ontimeupdate = null;
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
            appState.variables.currentWordIndex = 0;
            appState.variables.currentWordCount = 0;
            appState.variables.currentPdfWordIndex = 0; // Reset PDF word index
            
            // Clear PDF text span highlights
            const pdfHighlights = document.querySelectorAll('.pdf-text-chunk-highlight, .pdf-text-word-highlight');
            pdfHighlights.forEach(span => {
                span.classList.remove('pdf-text-chunk-highlight', 'pdf-text-word-highlight');
                span.classList.remove('green', 'blue'); // Remove color classes
            });
            
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
        appState.variables.currentPdfWordIndex = 0; // Reset PDF word index
        
        // Clear PDF text span highlights
        const pdfHighlights = document.querySelectorAll('.pdf-text-chunk-highlight, .pdf-text-word-highlight');
        pdfHighlights.forEach(span => {
            span.classList.remove('pdf-text-chunk-highlight', 'pdf-text-word-highlight');
            span.classList.remove('green', 'blue'); // Remove color classes
        });

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

    async function startSpeechGeneration() {
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

        // Now that we have our page text, prepare for generation with semantic splitting.
        appState.variables.allTextChunks = await splitTextIntoChunksAsync(text);

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
        // Handle both string chunks (from API) and object chunks (from local splitting)
        const chunkText = typeof chunk === 'string' ? chunk : chunk.text;
        if (!chunkText) return false;
        let cleanedChunk = chunkText.replaceAll('\n', ' '); // Clean new lines
        
        // Check if we should use timing-based highlighting (for PDF backend rendering)
        const usePdfBackendTiming = appState.variables.pdfTextPositions && 
                                     appState.variables.pdfTextPositions.length > 0 &&
                                     appState.variables.pdfDoc;
        
        if (usePdfBackendTiming) {
            // Use timing-based audio generation for precise highlighting
            console.log(`🎵 Using timing-based audio for chunk${chunkIndex}`);
            
            generateSpeechWithTiming(
                cleanedChunk, 
                appState.variables.bookDetectedLang, 
                appState.elements.engineSelect.value, 
                appState.elements.voiceSelect.value,
                50, // chunk size in words
                1.0 // speed
            ).then(timingData => {
                if (timingData && timingData.chunks && timingData.chunks.length > 0) {
                    // Use the first chunk (since we're generating one chunk at a time)
                    const chunkData = timingData.chunks[0];
                    const audioUrl = chunkData.audioUrl;
                    
                    // Store timing data with the chunk
                    appState.variables.audioQueue[chunkIndex] = { 
                        url: audioUrl, 
                        text: chunk,
                        timingData: chunkData // Contains words array with startTime/endTime
                    };
                    
                    appState.variables.audioTimingData[chunkIndex] = chunkData;
                    appState.variables.useTimingBasedHighlighting = true;
                    
                    console.log(`✅ Chunk ${chunkIndex} audio ready with timing data:`, chunkData);
                    
                    // If playback isn't running and this is the chunk we're waiting for, start playing
                    if (!appState.variables.isPlaying && chunkIndex === appState.variables.currentChunkIndex) {
                        playAudioQueue();
                    }
                } else {
                    console.debug(`Failed to get timing data for chunk ${chunkIndex}, falling back to regular generation`);
                    // Fallback to regular generation
                    generateRegularAudio(chunkIndex, cleanedChunk, chunk);
                }
            }).catch(error => {
                console.error(`Error generating timing-based audio for chunk ${chunkIndex}:`, error);
                // Fallback to regular generation
                generateRegularAudio(chunkIndex, cleanedChunk, chunk);
            });
        } else {
            // Regular audio generation without timing
            generateRegularAudio(chunkIndex, cleanedChunk, chunk);
        }
    }
    
    // Helper function for regular audio generation
    function generateRegularAudio(chunkIndex, cleanedChunk, chunk) {
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
        // Remove old style highlights
        const allWordElements = appState.elements.textDisplay.querySelectorAll('span.highlight');
        allWordElements.forEach(span => span.classList.remove('highlight'));
        
        // Remove word-span elements
        const allWordSpans = appState.elements.textDisplay.querySelectorAll('.word-span');
        allWordSpans.forEach(span => {
            const text = span.textContent;
            span.replaceWith(document.createTextNode(text));
        });
        
        // Clear active word highlights
        const activeWords = appState.elements.textDisplay.querySelectorAll('.highlight-word');
        activeWords.forEach(word => word.classList.remove('highlight-word'));
        
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
        if (appState.elements.pdfSearchBtn.parentElement) {
            appState.elements.pdfSearchBtn.parentElement.classList.add('hidden');
        }
        appState.elements.pdfSearchBar.classList.add('hidden');
    }

    async function renderTextLayer(pageNum) {
        if (!appState.variables.pdfDoc || !appState.elements.pdfTextLayer) {
            console.log('⚠️ Text layer rendering skipped - missing pdfDoc or pdfTextLayer element');
            return;
        }
        
        // Check if we have backend text positions
        if (!appState.variables.pdfTextPositions || appState.variables.pdfTextPositions.length === 0) {
            console.warn('⚠️ No text positions from backend, skipping text layer');
            return;
        }
        
        console.log(`📝 Rendering text layer for page ${pageNum} using backend positions`);
        
        try {
            const page = await appState.variables.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ 
                scale: appState.variables.currentScale,
                rotation: appState.variables.currentRotation 
            });
            
            // Get text positions for this page from backend data
            const pageData = appState.variables.pdfTextPositions.find(p => p.page_number === pageNum);
            if (!pageData || !pageData.text_items || pageData.text_items.length === 0) {
                console.warn(`⚠️ No text items for page ${pageNum}`);
                return;
            }
            
            console.log(`📄 Page ${pageNum} has ${pageData.text_items.length} text items from backend`);
            
            // Find the page wrapper and canvas - adaptive retry logic based on operation type
            let pageWrapper = null;
            let pageCanvas = null;
            
            // During scroll operations, use more attempts with longer delays
            const isScrollOperation = !appState.variables.isManualPageChange;
            const maxAttempts = isScrollOperation ? 12 : 5; // More attempts for scroll
            const baseDelay = isScrollOperation ? 300 : 150; // Longer base delay for scroll
            
            console.log(`🔍 [DEBUG] Looking for page ${pageNum} wrapper (${isScrollOperation ? 'SCROLL' : 'MANUAL'}, max attempts: ${maxAttempts})`);
            
            // First quick check
            pageWrapper = appState.elements.pdfViewer.querySelector(`.pdf-page-wrapper[data-page="${pageNum}"]`);
            pageCanvas = pageWrapper?.querySelector('canvas');
            
            if (!pageCanvas || !pageWrapper) {
                console.warn(`⚠️ [DEBUG] Canvas/wrapper for page ${pageNum} not immediately found, retrying...`);
                
                // Retry with progressive delays
                for (let attempt = 0; attempt < maxAttempts && (!pageCanvas || !pageWrapper); attempt++) {
                    await new Promise(resolve => setTimeout(resolve, baseDelay * (attempt + 1)));
                    pageWrapper = appState.elements.pdfViewer.querySelector(`.pdf-page-wrapper[data-page="${pageNum}"]`);
                    pageCanvas = pageWrapper?.querySelector('canvas');
                    
                    if (pageCanvas && pageWrapper) {
                        console.log(`✅ [DEBUG] Found wrapper for page ${pageNum} on attempt ${attempt + 1}`);
                        break;
                    } else {
                        console.warn(`⏳ [DEBUG] Attempt ${attempt + 1}/${maxAttempts} failed for page ${pageNum}`);
                    }
                }
                
                if (!pageCanvas || !pageWrapper) {
                    console.error(`❌ [DEBUG] Could not find canvas/wrapper for page ${pageNum} after ${maxAttempts} attempts`);
                    if (isScrollOperation) {
                        console.warn(`⏭️ [DEBUG] Skipping text layer - page ${pageNum} may have been removed during scroll`);
                    }
                    return;
                }
            }
            
            console.log(`📍 [DEBUG] Page ${pageNum} wrapper offset: top=${pageWrapper.offsetTop}, left=${pageWrapper.offsetLeft}`);
            
            // Clear existing text layers for this page INSIDE the wrapper
            const existingLayers = pageWrapper.querySelectorAll('.textLayer, .pdf-text-chunk');
            if (existingLayers.length > 0) {
                console.log(`🧹 [DEBUG] Removing ${existingLayers.length} existing text layers from page ${pageNum}`);
                existingLayers.forEach(layer => layer.remove());
            }
            
            // Create container for this page's text layer INSIDE the page wrapper
            // This ensures text stays with its page regardless of scrolling/DOM changes
            const textLayerDiv = document.createElement('div');
            textLayerDiv.className = 'textLayer';
            textLayerDiv.dataset.page = pageNum;
            textLayerDiv.style.position = 'absolute';
            textLayerDiv.style.left = '0';  // Relative to pageWrapper
            textLayerDiv.style.top = '0';   // Relative to pageWrapper
            textLayerDiv.style.width = viewport.width + 'px';
            textLayerDiv.style.height = viewport.height + 'px';
            textLayerDiv.style.pointerEvents = 'auto';
            textLayerDiv.style.zIndex = '1';
            
            // Calculate scale factors (backend uses PDF coordinates, we need to scale to viewport)
            const scaleX = viewport.width / pageData.width;
            const scaleY = viewport.height / pageData.height;
            
            // Create selectable text spans from backend positions with enhanced interaction
            let textSpansCreated = 0;
            for (const item of pageData.text_items) {
                if (!item.text || item.text.trim() === '') continue;
                
                const span = document.createElement('span');
                span.textContent = item.text;
                span.classList.add('pdf-text-span', 'selectable-text');
                
                // Enhanced positioning with better accuracy
                span.style.position = 'absolute';
                span.style.left = (item.x * scaleX) + 'px';
                span.style.top = (item.y * scaleY) + 'px';
                span.style.fontSize = (item.size * scaleY) + 'px';
                span.style.fontFamily = item.font || 'sans-serif';
                span.style.lineHeight = '1.2';
                
                // Make text selectable and visible on hover
                span.style.color = 'transparent';
                span.style.userSelect = 'text';
                span.style.webkitUserSelect = 'text';
                span.style.mozUserSelect = 'text';
                span.style.msUserSelect = 'text';
                span.style.cursor = 'text';
                span.style.whiteSpace = 'pre';
                span.style.transformOrigin = '0% 0%';
                span.style.pointerEvents = 'auto';
                span.style.display = 'inline-block';
                span.style.width = (item.width * scaleX) + 'px';
                span.style.height = (item.height * scaleY) + 'px';
                
                // Add smooth transitions
                span.style.transition = 'background-color 0.2s ease, color 0.2s ease, transform 0.15s ease';
                
                // Store data
                span.dataset.text = item.text;
                span.dataset.page = pageNum;
                span.dataset.itemId = item.id || textSpansCreated;
                
                // Track mouse position for click vs drag detection
                let mouseDownPos = null;
                
                span.addEventListener('mousedown', function(e) {
                    mouseDownPos = { x: e.clientX, y: e.clientY };
                    // Prevent default browser behavior when Ctrl is held to ensure proper event handling
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                    }
                });
                
                // Enhanced click handler - distinguishes click from drag/select
                span.addEventListener('mouseup', function(e) {
                    // Check if this was a drag (text selection) or a click
                    if (!mouseDownPos) return;
                    
                    const dragDistance = Math.sqrt(
                        Math.pow(e.clientX - mouseDownPos.x, 2) + 
                        Math.pow(e.clientY - mouseDownPos.y, 2)
                    );
                    
                    // If mouse moved more than 5px, it's a drag/selection, not a click
                    const isDrag = dragDistance > 5;
                    mouseDownPos = null;
                    
                    if (isDrag) {
                        // This was a text selection attempt, don't trigger playback
                        return;
                    }
                    
                    // Check if Ctrl/Cmd key is held
                    const selection = window.getSelection();
                    const hasSelection = selection && selection.toString().length > 0;
                    
                    // Only trigger playback if Ctrl is held and no selection and it was a click
                    if ((e.ctrlKey || e.metaKey) && !hasSelection && !isDrag) {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const clickedText = this.textContent;
                        console.log('📝 Text clicked with Ctrl:', clickedText.substring(0, 50) + '...');
                        console.log('📄 Clicked on page:', pageNum);
                        
                        // Get full text from PDF viewer (all text spans across all pages)
                        const pdfViewer = appState.elements.pdfViewer;
                        const allTextSpans = pdfViewer.querySelectorAll('.pdf-text-span');
                        console.log('📚 Found', allTextSpans.length, 'text spans in PDF');
                        
                        // Build full text from all pages starting from the clicked page
                        let fullText = '';
                        let textBeforeClick = '';
                        let foundClickedSpan = false;
                        
                        for (const span of allTextSpans) {
                            const spanPage = parseInt(span.dataset.page);
                            const spanText = span.textContent;
                            
                            // Check if this is the clicked span
                            if (span === this) {
                                foundClickedSpan = true;
                                console.log('✅ Found clicked span at position', textBeforeClick.length);
                            }
                            
                            // Only include text from current page onwards
                            if (spanPage >= pageNum) {
                                fullText += spanText + ' ';
                                if (!foundClickedSpan) {
                                    textBeforeClick += spanText + ' ';
                                }
                            }
                        }
                        
                        console.log('📄 Full text from page', pageNum, 'onwards:', fullText.length, 'characters');
                        console.log('📍 Text before click:', textBeforeClick.length, 'characters');
                        
                        if (foundClickedSpan) {
                            // Start from the clicked position
                            const textFromPoint = fullText.substring(textBeforeClick.length);
                            console.log('🎵 Starting playback from clicked position, remaining text:', textFromPoint.length, 'characters');
                            showNotification('🎵 Starting from: "' + clickedText.substring(0, 30) + '..."', 'info');
                            processTextAndPlay(textFromPoint, pageNum);
                        } else {
                            console.error('❌ Could not determine click position in document');
                            showNotification('❌ Could not locate text in document', 'error');
                        }
                    }
                });
                
                // Enhanced hover effects
                span.addEventListener('mouseenter', function(e) {
                    // Don't highlight during text selection
                    const selection = window.getSelection();
                    if (selection && selection.toString().length > 0) return;
                    
                    // Show background and make text slightly visible
                    this.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
                    this.style.color = 'rgba(0, 0, 0, 0.05)';
                    this.style.transform = 'scale(1.02)';
                    
                    // Show tooltip if Ctrl is not held
                    if (!e.ctrlKey && !e.metaKey) {
                        this.title = 'Hold Ctrl+Click to start reading from here, or select to copy text';
                    } else {
                        this.title = 'Click to start reading from here';
                    }
                });
                
                span.addEventListener('mouseleave', function() {
                    this.style.backgroundColor = 'transparent';
                    this.style.color = 'transparent';
                    this.style.transform = 'scale(1)';
                });
                
                // Update cursor based on Ctrl key state
                span.addEventListener('mousemove', function(e) {
                    if (e.ctrlKey || e.metaKey) {
                        this.style.cursor = 'pointer';
                    } else {
                        this.style.cursor = 'text';
                    }
                });
                
                // Store word index for highlighting during reading
                span.dataset.wordIndex = textSpansCreated;
                
                // Debug mode visualization
                if (appState.variables.debugMode) {
                    span.style.outline = '1px solid rgba(255, 0, 0, 0.3)';
                    span.style.backgroundColor = 'rgba(0, 255, 0, 0.05)';
                }
                
                textLayerDiv.appendChild(span);
                textSpansCreated++;
            }
            
            // Append text layer to pageWrapper (not global overlay) so it stays with its page
            pageWrapper.appendChild(textLayerDiv);
            console.log(`✅ [DEBUG] Text layer with ${textSpansCreated} spans appended to page ${pageNum} wrapper`);
            
            // Now create clickable chunks from the text
            await renderClickableChunks(pageNum, pageData, viewport, pageWrapper, scaleX, scaleY);
            
        } catch (error) {
            console.error('❌ Error rendering text layer for page', pageNum, ':', error);
            showNotification('Error rendering text layer: ' + error.message, 'error');
        }
    }
    
    async function renderClickableChunks(pageNum, pageData, viewport, pageWrapper, scaleX, scaleY) {
        // Clickable chunks are now handled by individual text spans with Ctrl+Click
        // This function is kept for backward compatibility but does minimal work
        console.log(`✅ [DEBUG] Text interaction enabled for ${pageData.text_items.length} items on page ${pageNum}`);
        console.log(`ℹ️  TIP: Hold Ctrl and click on any text to start reading from that point`);
        console.log(`ℹ️  TIP: Select text normally to copy it`);
    }
    
    async function processTextAndPlay(text, startPage) {
        // Split text into chunks for TTS
        try {
            console.log('🎬 processTextAndPlay called with', text.length, 'characters');
            
            // First, completely stop any current playback and reset state
            if (appState.variables.isPlaying) {
                console.log('⏹️ Stopping current playback before starting new one');
                stopAudioQueue();
                
                // Wait a bit for cleanup
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Reset the state completely
            appState.variables.audioQueue = [];
            appState.variables.allTextChunks = [];
            appState.variables.currentChunkIndex = 0;
            appState.variables.isPlaying = false;
            appState.variables.isPaused = false;
            
            const response = await fetch('/api/process_text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    chunk_size: 200,
                    use_llm: true
                })
            });
            
            if (!response.ok) {
                console.error('Failed to process text:', response.status, response.statusText);
                showNotification('❌ Failed to process text', 'error');
                return;
            }
            
            const data = await response.json();
            console.log('✅ Received', data.chunks?.length || 0, 'chunks from server');
            
            if (data.status === 'success' && data.chunks && data.chunks.length > 0) {
                // Convert chunks to the format expected by the player
                for (let i = 0; i < data.chunks.length; i++) {
                    appState.variables.allTextChunks.push({
                        text: data.chunks[i],
                        index: i
                    });
                }
                
                console.log('📝 Prepared', appState.variables.allTextChunks.length, 'chunks for TTS');
                
                // Set playback state
                appState.variables.currentChunkIndex = 0;
                appState.variables.isPlaying = true;
                appState.variables.isPaused = false;
                
                // Start generating speech for the first few chunks
                const chunksToPreload = Math.min(3, data.chunks.length);
                console.log('🔊 Pre-loading', chunksToPreload, 'audio chunks');
                
                for (let i = 0; i < chunksToPreload; i++) {
                    processAndQueueChunk(i);
                }
                
                // Start playback after a short delay
                setTimeout(() => {
                    console.log('▶️ Starting playback');
                    playAudioQueue();
                }, 500);
            } else {
                console.warn('⚠️ No chunks received from server');
                showNotification('⚠️ No text to process', 'warning');
            }
        } catch (error) {
            console.error('❌ Error processing text:', error);
            showNotification('❌ Error: ' + error.message, 'error');
        }
    }

    async function renderPage(num, skipTextExtraction = false, append = true, prepend = false) {
        if (!appState.variables.pdfDoc) return;
        
        console.log(`📄 [DEBUG] renderPage called - page: ${num}, skipText: ${skipTextExtraction}, append: ${append}, prepend: ${prepend}`);
        
        // Validate page number
        if (!num || num < 1 || num > appState.variables.pdfDoc.numPages) {
            console.error('❌ [DEBUG] Invalid page number:', num, '(valid range: 1-' + appState.variables.pdfDoc.numPages + ')');
            return;
        }
        
        // Clear text layer when replacing (not appending or prepending)
        if (!append && !prepend && appState.elements.pdfTextLayer) {
            console.log(`🧹 [DEBUG] Clearing global text layer (replacing)`);
            appState.elements.pdfTextLayer.innerHTML = '';
        }
        
        // Clear PDF viewer when replacing (not appending or prepending)
        if (!append && !prepend) {
            console.log(`🧹 [DEBUG] Clearing PDF viewer (replacing)`);
            appState.elements.pdfViewer.innerHTML = '';
        }
        
        appState.elements.pdfViewerWrapper.classList.remove('hidden');
        appState.elements.textboxViewerWrapper.classList.add('hidden');
        appState.elements.zoomInBtn.disabled = false;
        appState.elements.zoomOutBtn.disabled = false;
        appState.elements.pdfSearchBtn.parentElement.classList.remove('hidden');
        appState.variables.currentPageNum = num;
        
        console.log(`📌 [DEBUG] Current page set to ${num}, scale: ${appState.variables.currentScale}, rotation: ${appState.variables.currentRotation}`);
        
        // Show book-info panel with PDF controls
        const bookInfo = document.querySelector('#book-info');
        if (bookInfo) {
            bookInfo.classList.remove('hidden', 'opacity-0');
        }
        
        // Update zoom level display only during initial render or non-manual operations
        if (!appState.variables.isManualPageChange) {
            appState.elements.zoomLevel.textContent = Math.round(appState.variables.currentScale * 100) + '%';
        }
        
        // Update page input field max value
        if (appState.elements.pageInput) {
            appState.elements.pageInput.max = appState.variables.pdfDoc.numPages;
            appState.elements.pageInput.value = num;
        }

        const renderSinglePage = async (pageNumber, container) => {
            // Create a page wrapper for canvas and separator
            const pageWrapper = document.createElement('div');
            pageWrapper.classList.add('pdf-page-wrapper');
            pageWrapper.dataset.page = pageNumber;
            
            const canvas = document.createElement('canvas');
            const lastPage = appState.elements.pdfViewer.querySelector('canvas');
            canvas.classList.add('dark:invert');
            canvas.ariaLabel = 'PDF page';
            canvas.dataset.page = pageNumber;

            if (lastPage) {
                // Populate with last pages info, while we await.
                canvas.height = lastPage.offsetHeight;
                canvas.width = lastPage.offsetWidth;
            }

            pageWrapper.appendChild(canvas);
            
            // Add page separator with page number
            const separator = document.createElement('div');
            separator.classList.add('pdf-page-separator');
            separator.innerHTML = `<span>Page ${pageNumber}</span>`;
            pageWrapper.appendChild(separator);

            // Immediately render the page, even while we wait for PDF.js
            if (append) container.appendChild(pageWrapper);
            else container.prepend(pageWrapper);

            const page = await appState.variables.pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ 
                scale: appState.variables.currentScale,
                rotation: appState.variables.currentRotation 
            });
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            await page.render(renderContext).promise;

            // Create a selectable text layer for copying text using PDF.js standard class
            const selectableTextLayer = document.createElement('div');
            selectableTextLayer.className = 'textLayer';
            selectableTextLayer.style.position = 'absolute';
            selectableTextLayer.style.left = '0';
            selectableTextLayer.style.top = '0';
            selectableTextLayer.style.width = viewport.width + 'px';
            selectableTextLayer.style.height = viewport.height + 'px';
            
            // Add the selectable text layer to the page wrapper  
            pageWrapper.appendChild(selectableTextLayer);

            if (skipTextExtraction) return '';

            let textContent = await page.getTextContent();

            if (appState.elements.skipHeadersCheckbox.checked) {
                const parsedTextContent = detectHeadersAndFooters(textContent, canvas.height);
                textContent = parsedTextContent.body;
            }

            // Store text content for reference (selection, etc.)
            appState.variables.pdfTextContent[pageNumber] = textContent;
            return mapTextContent(textContent);
        };

        if (appState.variables.isTwoPageView) {
            const page1Text = await renderSinglePage(num, appState.elements.pdfViewer, append);
            let page2Text = '';

            if (num + 1 <= appState.variables.pdfDoc.numPages)
            page2Text = await renderSinglePage(num + 1, appState.elements.pdfViewer, append);

            if (!skipTextExtraction) {
                const combinedText = page1Text + ' ' + page2Text;
                appState.elements.textDisplay.textContent = combinedText;
            }
            
            // Render text layer for clickable chunks with adaptive delays
            if (!skipTextExtraction) {
                const isScrollOp = !appState.variables.isManualPageChange;
                const delay = isScrollOp ? 300 : 150; // Longer delay for scroll operations
                
                console.log(`📄 [DEBUG] Queuing text layer render for pages ${num} and ${num + 1} (${isScrollOp ? 'scroll' : 'manual'})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                await renderTextLayer(num);
                if (num + 1 <= appState.variables.pdfDoc.numPages) {
                    await renderTextLayer(num + 1);
                }
            }
        } else {
            const pageText = await renderSinglePage(num, appState.elements.pdfViewer, append);
            if (!skipTextExtraction)
            appState.elements.textDisplay.textContent = pageText;
            
            // Render text layer for clickable chunks with adaptive delays
            if (!skipTextExtraction) {
                const isScrollOp = !appState.variables.isManualPageChange;
                const delay = isScrollOp ? 300 : 150; // Longer delay for scroll operations
                
                console.log(`📄 [DEBUG] Queuing text layer render for page ${num} (${isScrollOp ? 'scroll' : 'manual'})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                await renderTextLayer(num);
            }
        }

        if (appState.variables.activeBook?.source === 'local' && !skipTextExtraction) {
            appState.variables.localBooks[appState.variables.activeBook.id].text = appState.elements.textDisplay.textContent;
            saveLocalBooks(appState);
        }
        
        // Update page number display
        updateCurrentPage(appState);
    }

    async function highlightPdfChunk(chunkObject) {
        const highlightLayer = document.getElementById('highlight-layer');
        if (!highlightLayer) {
            console.error('Highlight layer not found!');
            return;
        }
        
        // Check if currentReadingPage exists before accessing properties
        if (!appState.variables.currentReadingPage || !appState.variables.currentReadingPage.dataset) {
            console.warn('⚠️ currentReadingPage not available for highlighting');
            return;
        }
        
        highlightLayer.innerHTML = ''; // Clear previous highlights

        const currentReadingPageNum = Number.parseInt(appState.variables.currentReadingPage.dataset.page);

        // Normalize the target text
        const normalizeText = (text) => {
            return text.trim().replaceAll(/\s+/g, ' ');
        }

        const chunkText = normalizeText(chunkObject.text);
        let textToFind = chunkText;
        let currentPage = appState.variables.pdfTextContent[currentReadingPageNum];

        if (!currentPage) {
            console.debug('No PDF text content for page:', currentReadingPageNum);
            return;
        }

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
            console.debug('Could not find any match in the text. Chunk:', chunkText.substring(0, 50), '... Page text:', pageText.substring(0, 100));
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
        
        console.debug(`Highlighting ${itemsToHighlight.length} items on page ${currentReadingPageNum}`);

        // Now actually highlight the items
        for (const item of itemsToHighlight) {
            const page = await appState.variables.pdfDoc.getPage(currentReadingPageNum);
            const viewport = page.getViewport({ scale: appState.variables.currentScale });            

            createAndAppendHighlight(item, viewport, currentReadingPageNum, highlightLayer);
        }
        
        // Also add chunk-level highlighting to text spans
        addPdfChunkHighlightToSpans(currentReadingPageNum, chunkText);
    }
    
    // Add chunk-level highlighting to text spans
    function addPdfChunkHighlightToSpans(pageNum, chunkText) {
        // Clear previous chunk highlights
        const prevHighlights = document.querySelectorAll('.pdf-text-chunk-highlight');
        prevHighlights.forEach(span => {
            span.classList.remove('pdf-text-chunk-highlight');
            // Remove color classes
            span.classList.remove('green', 'blue');
        });
        
        // Get all text spans on the current page
        const textSpans = Array.from(document.querySelectorAll(`.backend-text-span[data-page="${pageNum}"]`));
        if (textSpans.length === 0) return;
        
        // Normalize function
        const normalizeText = (text) => text.trim().replace(/\s+/g, ' ');
        
        // Build text from spans
        const spansText = normalizeText(textSpans.map(span => span.textContent).join(' '));
        const targetText = normalizeText(chunkText);
        
        // Try to find the chunk in the spans text
        const matchIndex = spansText.indexOf(targetText.substring(0, Math.min(targetText.length, 100)));
        
        if (matchIndex === -1) {
            console.debug('Could not match chunk to text spans');
            return;
        }
        
        // Calculate which spans to highlight
        let currentPos = 0;
        const spansToHighlight = [];
        
        for (let i = 0; i < textSpans.length; i++) {
            const spanText = normalizeText(textSpans[i].textContent);
            const spanEnd = currentPos + spanText.length;
            
            // Check if this span overlaps with the chunk
            if (spanEnd > matchIndex && currentPos < matchIndex + targetText.length) {
                spansToHighlight.push(textSpans[i]);
            }
            
            currentPos = spanEnd + 1; // +1 for space between spans
        }
        
        // Apply chunk highlighting
        const highlightColor = appState.variables.localPrefs?.highlightColor || '';
        spansToHighlight.forEach(span => {
            span.classList.add('pdf-text-chunk-highlight');
            if (highlightColor) {
                span.classList.add(highlightColor);
            }
        });
    }
    
    // Helper function to create and append highlight (extracted for cleaner code)
    function createAndAppendHighlight(item, viewport, pageIndex, highlightLayer) {
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const highlight = document.createElement('div');
        highlight.className = 'highlight pdf-highlight';
        let layerOffset = 0;

        // Calculate how much we scrolled - accumulate heights of all previous pages
        for (const child of appState.elements.pdfViewer.children) {
            if (Number.parseInt(child.dataset.page) < pageIndex) {
                layerOffset += child.offsetHeight || child.height;
            } else {
                break;
            }
        }

        if (appState.variables.localPrefs.highlightColor)
        highlight.className += ` ${appState.variables.localPrefs.highlightColor}`;
        
        const leftOffset = (appState.variables.isTwoPageView && pageIndex === 1) ? (appState.elements.pdfViewer.children[0].offsetWidth || appState.elements.pdfViewer.children[0].width) : 0;
        
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
        
        if (appState.variables.currentUser) {
            // Define callback to load PDF when clicked
            const onPdfClick = async (pdf) => {
                // Close the library view
                const library = document.getElementById('library-file-grid');
                if (library) library.remove();
                
                // Find the book in onlineBooks that matches this PDF
                const book = appState.variables.onlineBooks.find(b => b.content === pdf.url);
                if (book) {
                    setActiveBook({ ...book, source: 'online' });
                } else {
                    // If not found, create a book object from the PDF data
                    const newBook = {
                        id: pdf.bookId || pdf.id,
                        title: pdf.name,
                        content: pdf.url,
                        is_pdf: true,
                        source: 'online'
                    };
                    setActiveBook(newBook);
                }
            };
            
            appState.elements.mainDiv.appendChild(await renderUserPdfs(appState.variables.currentUser, onPdfClick));
        } else {
            appState.elements.mainDiv.appendChild(createFilesGrid([]));
        }
    });

    // Shortcuts button - Open keyboard shortcuts help
    if (appState.elements.shortcutsBtn && appState.elements.shortcutsModal) {
        appState.elements.shortcutsBtn.addEventListener('click', () => {
            appState.elements.shortcutsModal.classList.remove('hidden');
        });
    }

    // Close shortcuts modal
    if (appState.elements.shortcutsCloseBtn && appState.elements.shortcutsModal) {
        appState.elements.shortcutsCloseBtn.addEventListener('click', () => {
            appState.elements.shortcutsModal.classList.add('hidden');
        });
        
        // Also close on click outside
        appState.elements.shortcutsModal.addEventListener('click', (e) => {
            if (e.target === appState.elements.shortcutsModal) {
                appState.elements.shortcutsModal.classList.add('hidden');
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !appState.elements.shortcutsModal.classList.contains('hidden')) {
                appState.elements.shortcutsModal.classList.add('hidden');
            }
        });
    }

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
                    
                    // OCR completed - update with enhanced/merged text
                    const previousTextLength = appState.variables.fullBookText?.length || 0;
                    const newTextLength = data.text?.length || 0;
                    
                    if (newTextLength > previousTextLength) {
                        console.log(`✨ OCR enhanced text: ${previousTextLength} → ${newTextLength} chars`);
                        showNotification('OCR completed! Text enhanced with additional content.', 'success');
                    } else {
                        console.log('✅ OCR completed (no additional content found)');
                        showNotification('OCR completed successfully.', 'success');
                    }
                    
                    appState.variables.fullBookText = data.text;

                    if (bookId && currentUser) {
                        const newOnlineBook = await saveOcrText(bookId, data.text);
                        if (newOnlineBook) {
                            setActiveBook({ ...newOnlineBook, source: 'online' });
                        } else {
                            console.error("Could not find online book after saving OCR text. Falling back to text view.");
                            appState.variables.totalTextPages = Math.max(1, Math.ceil(appState.variables.fullBookText.length / appState.variables.charsPerPage));
                            renderTextPage(1);
                        }
                    } else {
                        // Anonymous user - update local storage
                        if (appState.variables.activeBook?.source === 'local') {
                            appState.variables.localBooks[appState.variables.activeBook.id].text = appState.variables.fullBookText;
                            saveLocalBooks(appState);
                        }
                        appState.variables.totalTextPages = Math.max(1, Math.ceil(appState.variables.fullBookText.length / appState.variables.charsPerPage));
                        renderTextPage(1);
                    }
    
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    console.error('OCR failed:', data.detail);
                    showNotification(`OCR failed: ${data.detail}`, 'error');
    
                } else {
                    console.log('🔄 OCR in progress...');
                }
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
                // PDF fully processed with both extraction and OCR
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
                // OCR is running in background
                if (data.partial && data.text) {
                    // We have extracted text, show it immediately while OCR enhances
                    console.log('📄 Using extracted text immediately, OCR will enhance it');
                    appState.variables.fullBookText = data.text;
                    if (appState.variables.activeBook?.source === 'local') {
                        appState.variables.localBooks[appState.variables.activeBook.id].text = appState.variables.fullBookText;
                        saveLocalBooks(appState);
                    }
                    appState.variables.totalTextPages = Math.max(1, Math.ceil(appState.variables.fullBookText.length / appState.variables.charsPerPage));
                    renderTextPage(1);
                    showNotification('Text loaded. OCR running in background to enhance...', 'info');
                } else {
                    // No extracted text, waiting for OCR
                    showNotification('PDF contains no extractable text. Running OCR...', 'info');
                }
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
        e.preventDefault(); // Prevent default behavior
        e.stopPropagation(); // Stop event bubbling
        
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
                // Fallback to local PDF rendering for anonymous users
                console.log('📄 Loading PDF locally for anonymous user');
                const arrayBuffer = await file.arrayBuffer();
                if (appState.variables.activeBook?.source === 'local') {
                    // Store PDF data in memory (not localStorage due to size limits)
                    appState.variables.localBooks[appState.variables.activeBook.id].pdfData = arrayBuffer;
                    appState.variables.localBooks[appState.variables.activeBook.id].pdfId = 'local';
                    // Don't save to localStorage - pdfData will be ignored by JSON.stringify
                }
                // Clear text positions for local PDFs (no backend extraction)
                appState.variables.pdfTextPositions = [];
                console.log('⚠️ Local PDF mode: Text positions not available without backend');
                // Render the PDF directly
                console.log('🔄 Initializing PDF.js with loaded data');
                try {
                    appState.variables.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    console.log('✅ PDF loaded successfully!', {
                        numPages: appState.variables.pdfDoc.numPages,
                        initialScale: appState.variables.currentScale,
                        initialRotation: appState.variables.currentRotation
                    });
                    console.log('🎨 Rendering first page...');
                    
                    // Set manual page change flag to prevent observer triggers during initial load
                    appState.variables.isManualPageChange = true;
                    await renderPage(1);
                    
                    // Delay observer attachment to prevent multiple triggers
                    setTimeout(() => {
                        const firstPage = appState.elements.pdfViewer.children[0];
                        if (firstPage && window.upwardsScroll) {
                            window.upwardsScroll.observe(firstPage);
                            console.log('✅ [DEBUG] Local PDF - upward observer attached');
                        }
                        if (window.downwardsScroll) {
                            const toolbarSpace = document.querySelector("#toolbar-space");
                            if (toolbarSpace) {
                                window.downwardsScroll.observe(toolbarSpace);
                                console.log('✅ [DEBUG] Local PDF - downward observer attached');
                            }
                        }
                        appState.variables.isManualPageChange = false;
                    }, 500);
                } catch (error) {
                    console.error('❌ Failed to load PDF:', error);
                    showNotification('Failed to load PDF: Invalid or corrupted PDF file', 'error');
                    hideFileModal(appState);
                    return;
                }
                showNotification('PDF loaded! Note: PDFs are not persisted. Sign in to save permanently.', 'info');
                hideFileModal(appState);
                return;
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
        } else {
            showNotification('Please select a valid PDF, EPUB, or DOCX file.', 'warn');
        }
        
        // Reset the file input so the same file can be selected again
        e.target.value = '';
        hideFileModal(appState);
    });

    appState.elements.zoomInBtn.addEventListener('click', () => {
        if (!appState.variables.pdfDoc) return;
        console.log(`🔍 [DEBUG] Zoom In clicked - current scale: ${appState.variables.currentScale}`);
        
        // Disable infinite scroll during manual zoom
        appState.variables.isManualPageChange = true;
        if (window.downwardsScroll) window.downwardsScroll.disconnect();
        if (window.upwardsScroll) window.upwardsScroll.disconnect();
        
        appState.variables.currentScale += 0.25;
        console.log(`➕ [DEBUG] New scale: ${appState.variables.currentScale}`);
        appState.elements.zoomLevel.textContent = Math.round(appState.variables.currentScale * 100) + '%';
        appState.elements.pdfViewer.innerHTML = '';
        if (appState.elements.pdfTextLayer) {
            console.log(`🧹 [DEBUG] Clearing text layer for zoom in`);
            appState.elements.pdfTextLayer.innerHTML = '';
        }
        
        renderPage(appState.variables.currentPageNum).then(() => {
            appState.variables.isManualPageChange = false;
            setTimeout(() => {
                const topPage = appState.elements.pdfViewer.children[0];
                const bottomPage = appState.elements.pdfViewer.children[appState.elements.pdfViewer.children.length - 1];
                if (topPage && window.upwardsScroll) window.upwardsScroll.observe(topPage);
                if (bottomPage && window.downwardsScroll) window.downwardsScroll.observe(bottomPage);
                console.log('✅ [DEBUG] Zoom in complete, observers reconnected');
            }, 100);
        });
    });

    appState.elements.zoomOutBtn.addEventListener('click', () => {
        if (!appState.variables.pdfDoc) return;
        console.log(`🔍 [DEBUG] Zoom Out clicked - current scale: ${appState.variables.currentScale}`);
        appState.variables.isManualPageChange = true;
        
        if (window.downwardsScroll) window.downwardsScroll.disconnect();
        if (window.upwardsScroll) window.upwardsScroll.disconnect();
        
        appState.variables.currentScale = Math.max(0.25, appState.variables.currentScale - 0.25);
        console.log(`➖ [DEBUG] New scale: ${appState.variables.currentScale}`);
        appState.elements.zoomLevel.textContent = Math.round(appState.variables.currentScale * 100) + '%';
        appState.elements.pdfViewer.innerHTML = '';
        if (appState.elements.pdfTextLayer) {
            console.log(`🧹 [DEBUG] Clearing text layer for zoom out`);
            appState.elements.pdfTextLayer.innerHTML = '';
        }
        
        renderPage(appState.variables.currentPageNum).then(() => {
            appState.variables.isManualPageChange = false;
            setTimeout(() => {
                const topPage = appState.elements.pdfViewer.children[0];
                const bottomPage = appState.elements.pdfViewer.children[appState.elements.pdfViewer.children.length - 1];
                if (topPage && window.upwardsScroll) window.upwardsScroll.observe(topPage);
                if (bottomPage && window.downwardsScroll) window.downwardsScroll.observe(bottomPage);
                console.log('✅ [DEBUG] Zoom out complete, observers reconnected');
            }, 100);
        });
    });

    // Fit to width button
    appState.elements.fitWidthBtn.addEventListener('click', () => {
        if (!appState.variables.pdfDoc) return;
        appState.variables.isManualPageChange = true;
        
        // Disconnect infinite scroll to prevent interference
        if (window.downwardsScroll) window.downwardsScroll.disconnect();
        if (window.upwardsScroll) window.upwardsScroll.disconnect();
        
        const container = appState.elements.pdfViewerWrapper;
        const containerWidth = container.clientWidth;
        
        appState.variables.pdfDoc.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 1, rotation: appState.variables.currentRotation });
            const scale = (containerWidth - 40) / viewport.width;
            appState.variables.currentScale = scale;
            appState.elements.zoomLevel.textContent = Math.round(scale * 100) + '%';
            appState.elements.pdfViewer.innerHTML = '';
            if (appState.elements.pdfTextLayer) {
                appState.elements.pdfTextLayer.innerHTML = '';
            }
            
            return renderPage(appState.variables.currentPageNum);
        }).then(() => {
            appState.variables.isManualPageChange = false;
            // Reconnect observers
            setTimeout(() => {
                const topPage = appState.elements.pdfViewer.children[0];
                const bottomPage = appState.elements.pdfViewer.children[appState.elements.pdfViewer.children.length - 1];
                if (topPage && window.upwardsScroll) window.upwardsScroll.observe(topPage);
                if (bottomPage && window.downwardsScroll) window.downwardsScroll.observe(bottomPage);
                console.log('✅ [DEBUG] Fit width complete, observers reconnected');
            }, 100);
        });
    });

    // Fit to page button
    appState.elements.fitPageBtn.addEventListener('click', () => {
        if (!appState.variables.pdfDoc) return;
        appState.variables.isManualPageChange = true;
        
        // Disconnect infinite scroll to prevent interference
        if (window.downwardsScroll) window.downwardsScroll.disconnect();
        if (window.upwardsScroll) window.upwardsScroll.disconnect();
        
        const container = appState.elements.pdfViewerWrapper;
        const containerWidth = container.clientWidth;
        const containerHeight = window.innerHeight - 200;
        
        appState.variables.pdfDoc.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 1, rotation: appState.variables.currentRotation });
            const scaleWidth = (containerWidth - 40) / viewport.width;
            const scaleHeight = (containerHeight - 40) / viewport.height;
            const scale = Math.min(scaleWidth, scaleHeight);
            appState.variables.currentScale = scale;
            appState.elements.zoomLevel.textContent = Math.round(scale * 100) + '%';
            appState.elements.pdfViewer.innerHTML = '';
            if (appState.elements.pdfTextLayer) {
                appState.elements.pdfTextLayer.innerHTML = '';
            }
            
            return renderPage(appState.variables.currentPageNum);
        }).then(() => {
            appState.variables.isManualPageChange = false;
            // Reconnect observers
            setTimeout(() => {
                const topPage = appState.elements.pdfViewer.children[0];
                const bottomPage = appState.elements.pdfViewer.children[appState.elements.pdfViewer.children.length - 1];
                if (topPage && window.upwardsScroll) window.upwardsScroll.observe(topPage);
                if (bottomPage && window.downwardsScroll) window.downwardsScroll.observe(bottomPage);
                console.log('✅ [DEBUG] Fit page complete, observers reconnected');
            }, 100);
        });
    });

    // Rotate left button
    appState.elements.rotateLeftBtn.addEventListener('click', () => {
        if (!appState.variables.pdfDoc) return;
        appState.variables.isManualPageChange = true;
        appState.variables.currentRotation = (appState.variables.currentRotation - 90 + 360) % 360;
        appState.elements.pdfViewer.innerHTML = '';
        if (appState.elements.pdfTextLayer) {
            appState.elements.pdfTextLayer.innerHTML = '';
        }
        renderPage(appState.variables.currentPageNum).then(() => {
            appState.variables.isManualPageChange = false;
        });
    });

    // Rotate right button
    appState.elements.rotateRightBtn.addEventListener('click', () => {
        if (!appState.variables.pdfDoc) return;
        appState.variables.isManualPageChange = true;
        appState.variables.currentRotation = (appState.variables.currentRotation + 90) % 360;
        appState.elements.pdfViewer.innerHTML = '';
        if (appState.elements.pdfTextLayer) {
            appState.elements.pdfTextLayer.innerHTML = '';
        }
        renderPage(appState.variables.currentPageNum).then(() => {
            appState.variables.isManualPageChange = false;
        });
    });

    // Debug mode toggle button
    if (appState.elements.debugModeBtn) {
        appState.elements.debugModeBtn.addEventListener('click', () => {
            appState.variables.debugMode = !appState.variables.debugMode;
            
            // Update button appearance
            if (appState.variables.debugMode) {
                appState.elements.debugModeBtn.classList.add('bg-indigo-500', 'text-white');
                appState.elements.debugModeBtn.classList.remove('bg-gray-100', 'dark:bg-gray-800');
                showNotification('🐛 Debug mode enabled - text boundaries visible', 'info');
            } else {
                appState.elements.debugModeBtn.classList.remove('bg-indigo-500', 'text-white');
                appState.elements.debugModeBtn.classList.add('bg-gray-100', 'dark:bg-gray-800');
                showNotification('Debug mode disabled', 'info');
            }
            
            // Re-render current page to apply debug styling
            if (appState.variables.pdfDoc) {
                appState.elements.pdfViewer.innerHTML = '';
                if (appState.elements.pdfTextLayer) {
                    appState.elements.pdfTextLayer.innerHTML = '';
                }
                renderPage(appState.variables.currentPageNum);
            }
        });
    }

    // First page button
    appState.elements.firstPageBtn.addEventListener('click', () => {
        if (appState.variables.pdfDoc) {
            appState.variables.isManualPageChange = true;
            appState.elements.pdfViewer.innerHTML = '';
            renderPage(1).then(() => {
                appState.variables.isManualPageChange = false;
            });
        } else if (appState.variables.fullBookText) {
            appState.elements.textDisplay.innerHTML = '';
            renderTextPage(1);
        }
    });

    // Last page button
    appState.elements.lastPageBtn.addEventListener('click', () => {
        if (appState.variables.pdfDoc) {
            const lastPage = appState.variables.pdfDoc.numPages;
            appState.variables.isManualPageChange = true;
            appState.elements.pdfViewer.innerHTML = '';
            renderPage(lastPage).then(() => {
                appState.variables.isManualPageChange = false;
            });
        } else if (appState.variables.fullBookText) {
            appState.elements.textDisplay.innerHTML = '';
            renderTextPage(appState.variables.totalTextPages);
        }
    });

    // Page input - jump to page
    appState.elements.pageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const pageNum = parseInt(appState.elements.pageInput.value);
            console.log(`📌 [DEBUG] Goto page triggered - page: ${pageNum}`);
            if (appState.variables.pdfDoc) {
                if (pageNum >= 1 && pageNum <= appState.variables.pdfDoc.numPages) {
                    console.log(`✅ [DEBUG] Valid page number, rendering page ${pageNum}`);
                    appState.variables.isManualPageChange = true;
                    appState.elements.pdfViewer.innerHTML = '';
                    if (appState.elements.pdfTextLayer) {
                        console.log(`🧹 [DEBUG] Clearing text layer for goto page`);
                        appState.elements.pdfTextLayer.innerHTML = '';
                    }
                    renderPage(pageNum).then(() => {
                        appState.variables.isManualPageChange = false;
                        console.log(`✅ [DEBUG] Page ${pageNum} rendered, isManualPageChange reset`);
                    });
                } else {
                    console.error(`❌ [DEBUG] Invalid page number: ${pageNum} (valid: 1-${appState.variables.pdfDoc.numPages})`);
                }
            } else if (appState.variables.fullBookText) {
                if (pageNum >= 1 && pageNum <= appState.variables.totalTextPages) {
                    appState.elements.textDisplay.innerHTML = '';
                    renderTextPage(pageNum);
                }
            }
        }
    });

    // PDF Search functionality
    appState.elements.pdfSearchBtn.addEventListener('click', () => {
        console.log('🔍 PDF Search button clicked');
        appState.elements.pdfSearchBar.classList.toggle('hidden');
        if (!appState.elements.pdfSearchBar.classList.contains('hidden')) {
            console.log('📝 Search bar shown, focusing input');
            appState.elements.pdfSearchInput.focus();
        } else {
            console.log('❌ Search bar hidden, clearing results');
            clearSearchHighlights();
        }
    });

    appState.elements.pdfSearchClose.addEventListener('click', () => {
        appState.elements.pdfSearchBar.classList.add('hidden');
        appState.elements.pdfSearchInput.value = '';
        clearSearchHighlights();
    });

    // Search in PDF
    appState.elements.pdfSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            performPdfSearch();
        }
    });

    appState.elements.pdfSearchNext.addEventListener('click', () => {
        navigateSearchResults(1);
    });

    appState.elements.pdfSearchPrev.addEventListener('click', () => {
        navigateSearchResults(-1);
    });

    // Function to perform PDF search
    async function performPdfSearch() {
        const searchText = appState.elements.pdfSearchInput.value.trim().toLowerCase();
        if (!searchText || !appState.variables.pdfDoc) return;

        appState.variables.searchMatches = [];
        appState.variables.currentSearchIndex = -1;

        // Search through all pages
        for (let pageNum = 1; pageNum <= appState.variables.pdfDoc.numPages; pageNum++) {
            const page = await appState.variables.pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            textContent.items.forEach((item, index) => {
                const text = item.str.toLowerCase();
                let startIndex = 0;
                while ((startIndex = text.indexOf(searchText, startIndex)) !== -1) {
                    appState.variables.searchMatches.push({
                        pageNum: pageNum,
                        itemIndex: index,
                        startIndex: startIndex,
                        text: item.str
                    });
                    startIndex += searchText.length;
                }
            });
        }

        // Update results display
        if (appState.variables.searchMatches.length > 0) {
            appState.elements.pdfSearchResults.classList.remove('hidden');
            appState.elements.pdfSearchResults.textContent = `Found ${appState.variables.searchMatches.length} matches`;
            navigateSearchResults(1);
        } else {
            appState.elements.pdfSearchResults.classList.remove('hidden');
            appState.elements.pdfSearchResults.textContent = 'No matches found';
        }
    }

    // Navigate between search results
    function navigateSearchResults(direction) {
        if (appState.variables.searchMatches.length === 0) return;

        appState.variables.currentSearchIndex += direction;
        
        // Wrap around
        if (appState.variables.currentSearchIndex >= appState.variables.searchMatches.length) {
            appState.variables.currentSearchIndex = 0;
        } else if (appState.variables.currentSearchIndex < 0) {
            appState.variables.currentSearchIndex = appState.variables.searchMatches.length - 1;
        }

        const match = appState.variables.searchMatches[appState.variables.currentSearchIndex];
        
        // Update results display
        appState.elements.pdfSearchResults.textContent = 
            `Match ${appState.variables.currentSearchIndex + 1} of ${appState.variables.searchMatches.length}`;

        // Navigate to the page with the match
        if (match.pageNum !== appState.variables.currentPageNum) {
            appState.elements.pdfViewer.innerHTML = '';
            renderPage(match.pageNum);
        }
    }

    // Clear search highlights
    function clearSearchHighlights() {
        appState.variables.searchMatches = [];
        appState.variables.currentSearchIndex = -1;
        appState.elements.pdfSearchResults.classList.add('hidden');
    }

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
        { name: 'Fit PDF to Width', icon: 'fa-arrows-left-right', description: 'Fit PDF page to width', action: () => {
            if (appState.variables.activeBook && appState.variables.pdfDoc) {
                appState.elements.fitWidthBtn?.click(); hideCommandPalette();
            } else showNotification('No PDF is currently active.');
        } },
        { name: 'Fit PDF to Page', icon: 'fa-maximize', description: 'Fit entire PDF page to screen', action: () => {
            if (appState.variables.activeBook && appState.variables.pdfDoc) {
                appState.elements.fitPageBtn?.click(); hideCommandPalette();
            } else showNotification('No PDF is currently active.');
        } },
        { name: 'Rotate PDF Left', icon: 'fa-rotate-left', description: 'Rotate PDF counterclockwise', action: () => {
            if (appState.variables.activeBook && appState.variables.pdfDoc) {
                appState.elements.rotateLeftBtn?.click(); hideCommandPalette();
            } else showNotification('No PDF is currently active.');
        } },
        { name: 'Rotate PDF Right', icon: 'fa-rotate-right', description: 'Rotate PDF clockwise', action: () => {
            if (appState.variables.activeBook && appState.variables.pdfDoc) {
                appState.elements.rotateRightBtn?.click(); hideCommandPalette();
            } else showNotification('No PDF is currently active.');
        } },
        { name: 'Search in PDF', icon: 'fa-search', description: 'Search for text in PDF', action: () => {
            if (appState.variables.activeBook && appState.variables.pdfDoc) {
                appState.elements.pdfSearchBtn?.click(); hideCommandPalette();
            } else showNotification('No PDF is currently active.');
        } },
        { name: 'First Page', icon: 'fa-angles-left', description: 'Go to first page', action: () => {
            if (appState.variables.activeBook) {
                appState.elements.firstPageBtn?.click(); hideCommandPalette();
            } else showNotification('No book is currently active.');
        } },
        { name: 'Last Page', icon: 'fa-angles-right', description: 'Go to last page', action: () => {
            if (appState.variables.activeBook) {
                appState.elements.lastPageBtn?.click(); hideCommandPalette();
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

    // Initialize highlighting settings
    const wordHighlightToggle = document.getElementById('word-highlight-toggle');
    const chunkHighlightColorSelect = document.getElementById('chunk-highlight-color');
    const wordHighlightColorSelect = document.getElementById('word-highlight-color');

    // Set default values if not already set
    if (appState.variables.localPrefs.enableWordHighlight === undefined) {
        appState.variables.localPrefs.enableWordHighlight = true; // Default to enabled
    }
    if (!appState.variables.localPrefs.highlightColor) {
        appState.variables.localPrefs.highlightColor = 'yellow'; // Default chunk color
    }
    if (!appState.variables.localPrefs.wordHighlightColor) {
        appState.variables.localPrefs.wordHighlightColor = appState.variables.localPrefs.highlightColor; // Default to chunk color
    }

    // Load saved settings
    wordHighlightToggle.checked = appState.variables.localPrefs.enableWordHighlight;
    chunkHighlightColorSelect.value = appState.variables.localPrefs.highlightColor;
    wordHighlightColorSelect.value = appState.variables.localPrefs.wordHighlightColor;

    // Save settings when changed
    wordHighlightToggle.addEventListener('change', () => {
        appState.variables.localPrefs.enableWordHighlight = wordHighlightToggle.checked;
        handlePrefs(appState.variables.localPrefs);
    });

    chunkHighlightColorSelect.addEventListener('change', () => {
        appState.variables.localPrefs.highlightColor = chunkHighlightColorSelect.value;
        handlePrefs(appState.variables.localPrefs);
    });

    wordHighlightColorSelect.addEventListener('change', () => {
        appState.variables.localPrefs.wordHighlightColor = wordHighlightColorSelect.value;
        handlePrefs(appState.variables.localPrefs);
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
    
    let downwardScrollInProgress = false;
    
    const downwardsScroll = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        if (appState.variables.isManualPageChange) return; // Skip during manual operations
        if (downwardScrollInProgress) return; // Prevent concurrent executions
        
        downwardScrollInProgress = true;
        
        try {
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

            if (currentPage >= pageLimit) {
                downwardScrollInProgress = false;
                return;
            }

        const lastRenderedPage = container.element.children[container.element.children.length - 1];

        // Calculate next page number and validate
        if (container.type == 'pdf' && !appState.variables.isManualPageChange) {
            const nextPageNum = Number.parseInt(lastRenderedPage.dataset.page) + (appState.variables.isTwoPageView ? 2 : 1);
            if (nextPageNum <= appState.variables.pdfDoc.numPages) {
                renderPage(nextPageNum);
            }
        } else if (container.type != 'pdf') {
            const nextPageNum = Number.parseInt(lastRenderedPage.dataset.page) + 1;
            if (nextPageNum <= pageLimit) {
                renderTextPage(nextPageNum);
            }
        }

            // Do a simple DOM cleanup. We lock this during generation to avoid unloading
            // a page being read.
            if (container.element.children.length > infiniteScrollPageCache && !appState.variables.isPlaying)
            container.element.children[0].remove();

            // Try to force DOM update.
            void container.element.offsetHeight;
            requestAnimationFrame(() => {
                topPage = container.element.children[0];

                // Update upwards scroll with delay
                upwardsScroll.disconnect();
                if (topPage) {
                    setTimeout(() => {
                        upwardsScroll.observe(topPage);
                        downwardScrollInProgress = false;
                    }, 100);
                } else {
                    downwardScrollInProgress = false;
                }
            });
        } catch (error) {
            console.error('❌ Downward scroll error:', error);
            downwardScrollInProgress = false;
        }
    });

    // This is the more complicated of the two.
    let upwardScrollInProgress = false;
    
    const upwardsScroll = new IntersectionObserver((entries) => {

        if (!entries[0].isIntersecting) return;
        if (appState.variables.isManualPageChange) return; // Skip during manual operations
        if (upwardScrollInProgress) return; // Prevent concurrent executions
        
        upwardScrollInProgress = true;
        
        try {
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

            // Check if we're already at the first page to avoid render
            const firstRenderedPage = container.element.children[0];
            if (!firstRenderedPage) {
                upwardScrollInProgress = false;
                return;
            }
            
            const firstPageNum = Number.parseInt(firstRenderedPage.dataset.page);
            if (firstPageNum <= 1) {
                upwardScrollInProgress = false;
                return;
            }

            const oldScrollHeight = container.element.scrollHeight;

        // Calculate previous page number, ensuring it's >= 1
        const prevPageNum = Number.parseInt(firstRenderedPage.dataset.page) - (appState.variables.isTwoPageView ? 2 : 1);
        if (container.type == 'pdf' && !appState.variables.isManualPageChange && prevPageNum >= 1) {
            // Use prepend mode (4th param = true) to add page at beginning without clearing
            renderPage(prevPageNum, false, false, true);
        } else if (container.type != 'pdf') {
            renderTextPage(Number.parseInt(firstRenderedPage.dataset.page) - 1, false);
        }

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

                // Observe the new top page with delay
                const newTopPage = container.element.children[0];
                if (newTopPage) {
                    setTimeout(() => {
                        upwardsScroll.observe(newTopPage);
                        upwardScrollInProgress = false;
                    }, 100);
                } else {
                    upwardScrollInProgress = false;
                }
            });
        } catch (error) {
            console.error('❌ Upward scroll error:', error);
            upwardScrollInProgress = false;
        }
    });
    
    // Store observers globally so fit buttons can access them
    window.downwardsScroll = downwardsScroll;
    window.upwardsScroll = upwardsScroll;
    
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