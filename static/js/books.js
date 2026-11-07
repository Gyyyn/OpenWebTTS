
/**
 * Populates userdata on the appState object.
 * @param {object} appState The main appState object.
 */
export async function fetchOnlineUserdata(appState) {
    if (!appState.variables.currentUser) return;

    try {
        const result = await appState.functions.getPodcasts(appState.variables.currentUser);
        appState.variables.onlinePodcasts = result.podcasts || [];
    } catch (error) {
        showNotification(error.message, 'error');
    }

    try {
        const response = await fetch(`/api/users/${appState.variables.currentUser}/books`);
        if (!response.ok) throw new Error('Failed to fetch online books.');
        const data = await response.json();
        appState.variables.onlineBooks = data.books || [];
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

/**
 * Create a sidebar list item for books.
 * @param {*} book The book object.
 * @param {*} source online or local.
 * @param {*} isActive Render active background.
 * @returns <li> HTML object.
 */
export function createBookListItem(appState, book, source) {
    const li = document.createElement('li');
    const isActive = appState.variables.activeBook?.id === book.id;
    li.className = `flex justify-between items-center cursor-pointer p-1 rounded-lg whitespace-nowrap overflow-hidden text-ellipsis dark:hover:bg-gray-700 dark:text-gray-200  ${isActive ? 'bg-indigo-100 dark:bg-indigo-900 dark:bg-opacity-30' : 'hover:bg-gray-200'}`;
    li.title = `${book.title}`;
    li.ariaLabel = `Book item ${book.title}`;

    const titleSpan = document.createElement('span');
    titleSpan.className = `ms-2 text-xs hide-on-collapse`;
    titleSpan.textContent = book.title;
    li.addEventListener('click', () => {
        appState.functions.setActiveBook({ ...book, source });
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
            appState.functions.renameBook(book.id);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appState.functions.deleteBook(book.id);
        });
    } else { // Online book
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appState.functions.renameOnlineBook(book);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appState.functions.deleteOnlineBook(book.id);
        });
    }

    actionsDiv.appendChild(renameBtn);
    actionsDiv.appendChild(deleteBtn);
    li.appendChild(containerSpan);
    li.appendChild(actionsDiv);
    return li;
}

/**
 * Renders the local book list in the sidebar.
 * @param {object} appState The main appState object.
 */
export function renderLocalBooks(appState) {
    if (appState.variables.localBooks?.length < 1) return; // No need to render an empty list.
    appState.elements.localBookList.innerHTML = '';
    for (const bookId in appState.variables.localBooks) {
        const book = { ...appState.variables.localBooks[bookId], id: bookId };
        const li = createBookListItem(appState, book, 'local');
        appState.elements.localBookList.appendChild(li);
    }
}

/**
 * Renders the local book list in the sidebar.
 * @param {object} appState The main appState object.
 */
export function renderOnlineBooks(appState) {   
    if (appState.variables.onlineBooks.length < 1) return;
    appState.elements.onlineBookList.innerHTML = '';
    appState.variables.onlineBooks.forEach(book => {
        const li = createBookListItem(appState, book, 'online');
        appState.elements.onlineBookList.appendChild(li);
    });
}

/**
 * Renders the local book list in the sidebar.
 * @param {object} appState The main appState object.
 */
export function renderOnlinePodcasts(appState) {
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
                    appState.functions.handleSidebarCollapse();
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

                    (
                    `Delete Podcast: ${podcast.title}?`,
                    'Delete',
                    async () => {
        
                        const result = await appState.functions.deletePodcast(currentUser, podcast.id);
                        if (result.success) showNotification(`Podcast '${podcast.title}' deleted.`, 'success');
                        else showNotification(`Failed to delete podcast: ${result.error}`, 'error');

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

/**
 * Renders one or two PDF pages.
 * @param {object} appState The main appState object.
 * @param {int} num 
 * @param {boolean} skipTextExtraction 
 * @param {boolean} append
 */
export async function renderPage(appState, num, skipTextExtraction = false, append = true) {
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

        canvas.id = `page-${pageNumber}`

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
        appState.variables.pdfTextContent[pageNumber] = textContent;

        if (appState.elements.skipHeadersCheckbox.checked) {
            const parsedTextContent = appState.functions.detectHeadersAndFooters(textContent, canvas.height);
            textContent = parsedTextContent.body;
        }

        return appState.functions.mapTextContent(textContent);
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

/**
 * Render a single text (markdown, HMTL or plain) page.
 * @param {object} appState The main appState object.
 * @param {int} num 
 * @param {boolean} append 
 */
export function renderTextPage(appState, num, append = true) {
    appState.variables.textCurrentPage = num;
    const start = (num - 1) * appState.variables.charsPerPage;
    const end = start + appState.variables.charsPerPage;
    const pageText = appState.variables.fullBookText.substring(start, end);    

    const injectHTML = document.createElement('div');
    injectHTML.innerHTML = appState.functions.parseTextContent(pageText);
    injectHTML.dataset.page = appState.variables.textCurrentPage;

    appState.variables.currentTextPageLength = pageText.length; // Store for editing

    if (append) { appState.elements.textDisplay.appendChild(injectHTML) }
    else { appState.elements.textDisplay.prepend(injectHTML) }

    // Ensure we are in text view mode
    appState.elements.pdfViewerWrapper.classList.add('hidden');
    appState.elements.textboxViewerWrapper.classList.remove('hidden');
}

/**
 * Clears highlights.
 * @param {object} appState The main appState object.
 */
export function clearHighlights(appState) {
    const allWordElements = appState.elements.textDisplay.querySelectorAll('span.highlight');
    allWordElements.forEach(span => span.classList.remove('highlight'));
    
    const highlightLayer = document.getElementById('highlight-layer');
    if (highlightLayer) highlightLayer.innerHTML = '';
}