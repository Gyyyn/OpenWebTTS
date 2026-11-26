import {
    showBookModal,
    hideBookModal,
    updateCurrentPage
} from "./UI.js";
import {
    attachContentPreview
} from "./preview.js";
import {
    splitTextIntoChunks
} from "./helpers.js";

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
        appState.functions.showNotification(error.message, 'error');
    }

    try {
        const response = await fetch(`/api/users/${appState.variables.currentUser}/books`);
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                appState.variables.currentUser = null;
                sessionStorage.removeItem('currentUser');
                sessionStorage.removeItem('authToken');
                return;
            }
            throw new Error('Failed to fetch online books.');
        }
        const data = await response.json();
        appState.variables.onlineBooks = data.books || [];
    } catch (error) {
        if (typeof showNotification === 'function') {
           appState.functions.showNotification(error.message, 'error');
        } else if (appState.functions?.showNotification) {
            appState.functions.showNotification(error.message, 'error');
        }
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

    // Attach content preview on hover
    attachContentPreview(li, () => {
        let textContent = '';
        let isPdf = Boolean(book.is_pdf);
        const charsPerPage = appState.variables.charsPerPage || 1000;

        if (source === 'local') {
            const localData = appState.variables.localBooks?.[book.id];
            if (localData) {
                textContent = localData.text || '';
                if (localData.pdfId) isPdf = true;
            }
        } else {
            textContent = (typeof book.content === 'string' && !book.is_pdf) ? book.content : '';
        }

        // Clean snippet
        const snippet = textContent ? textContent.replace(/\s+/g, ' ').trim().slice(0, 220) : '';

        // Reading progress calculation
        let progress = '';
        const savedPage = parseInt(localStorage.getItem(`text-page-${book.id}`)) || 1;
        if (textContent.length > 0) {
            const totalPages = Math.max(1, Math.ceil(textContent.length / charsPerPage));
            progress = `Page ${savedPage} of ${totalPages} (${Math.round((savedPage / totalPages) * 100)}%)`;
        } else if (isPdf) {
            progress = 'PDF Document';
        }

        return {
            title: book.title,
            isPdf: isPdf,
            badge: isPdf ? 'PDF' : (source === 'local' ? 'Local' : 'Online'),
            iconHtml: isPdf ? '<i class="fas fa-file-pdf"></i>' : '<i class="fas fa-book"></i>',
            progress: progress,
            details: source === 'local' ? 'Saved locally' : 'Cloud sync',
            snippet: snippet || (isPdf ? 'PDF Document.' : 'Empty document.')
        };
    });

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
            li.ariaLabel = `Audiobook item ${podcast.title}`;

            const mainContentDiv = document.createElement('div');
            mainContentDiv.className = 'flex justify-between items-center whitespace-nowrap overflow-hidden text-ellipsis';
            mainContentDiv.addEventListener('click', () => {

                const playerDiv = li.querySelector(`#podcast-audio-player-${podcast.id}`);

                if (appState.elements.sidebar.classList.contains('collapsed')) {
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
            titleIcon.innerHTML = '<i class="fas fa-headphones"></i>';

            containerSpan.prepend(titleIcon);
            containerSpan.append(titleSpan);

            mainContentDiv.appendChild(containerSpan);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'ps-2 hide-on-collapse flex items-center space-x-2';

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.className = 'hover:text-gray-500';
            deleteBtn.title = 'Delete Audiobook';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                    showBookModal(
                    `Delete Audiobook: ${podcast.title}?`,
                    'Delete',
                    async () => {
        
                        const result = await appState.functions.deletePodcast(appState.variables.currentUser, podcast.id);
                        if (result.success) appState.functions.showNotification(`Audiobook '${podcast.title}' deleted.`, 'success');
                        else appState.functions.showNotification(`Failed to delete audiobook: ${result.error}`, 'error');

                        hideBookModal(appState);

                    },
                    { showInput: false },
                    appState
                );
            });
            actionsDiv.appendChild(deleteBtn);
            mainContentDiv.appendChild(actionsDiv);
            li.appendChild(mainContentDiv);

            // Attach preview for audiobook
            attachContentPreview(li, () => {
                return {
                    title: podcast.title,
                    badge: podcast.status || 'Audiobook',
                    iconHtml: '<i class="fas fa-headphones"></i>',
                    details: `Status: ${podcast.status || 'unknown'}`,
                    progress: podcast.audio_url ? 'Audio ready' : 'Processing audio',
                    snippet: podcast.description || podcast.title || 'Generated audiobook.'
                };
            });

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
                compressBtn.title = 'Compress Audiobook';

                actionsDiv.prepend(compressBtn);

            } else if (podcast.status === 'failed') {

                // Retry Button (TODO)
                const retryBtn = document.createElement('button');
                retryBtn.innerHTML = '<i class="fas fa-repeat"></i>';
                retryBtn.className = 'hover:text-gray-500';
                retryBtn.title = 'Retry Audiobook';

                actionsDiv.prepend(retryBtn);
                
            } else {
                audioPlayerContainer.innerHTML = '<span class="text-gray-500">Audiobook audio not ready.</span>';
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
    appState.functions.updateZoomUI?.(appState);
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
            canvas.width = lastPage.offsetWidth;
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

        if (num + 1 <= appState.variables.pdfDoc.numPages)
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
 * Splits fullBookText into HTML-aware pages targeting charsPerPage characters
 * per page without cutting inside HTML tags or breaking block elements.
 * @param {string} fullBookText
 * @param {number} charsPerPage
 * @returns {Array<{start: number, end: number}>}
 */
export function computeTextPages(fullBookText, charsPerPage = 4000) {
    if (!fullBookText || typeof fullBookText !== 'string') {
        return [{ start: 0, end: 0 }];
    }

    const safeChars = Math.max(1, charsPerPage || 4000);
    const len = fullBookText.length;
    if (len <= safeChars) {
        return [{ start: 0, end: len }];
    }

    const isHtml = /<([a-z][a-z0-9]*)\b[^>]*>/i.test(fullBookText);
    const blockEndRegex = /<\/(?:p|h[1-6]|div|li|blockquote|pre|table|figure|section|article|body)>|<hr\s*\/?>/gi;
    const pages = [];
    let start = 0;

    while (start < len) {
        const target = start + safeChars;
        if (target >= len) {
            pages.push({ start, end: len });
            break;
        }

        let end = -1;

        if (isHtml) {
            // 1. Prefer a block-closing tag in the backward window [minBack, target]
            const minBack = Math.max(start + Math.floor(safeChars * 0.4), start + 1);
            const backSlice = fullBookText.slice(minBack, target);
            blockEndRegex.lastIndex = 0;
            let match;
            let lastBlockEnd = -1;
            while ((match = blockEndRegex.exec(backSlice)) !== null) {
                lastBlockEnd = minBack + match.index + match[0].length;
            }
            if (lastBlockEnd > start) {
                end = lastBlockEnd;
            }

            // 2. If none found behind target, check if target is inside an open <...> tag
            if (end === -1) {
                const lastLt = fullBookText.lastIndexOf('<', target);
                const lastGt = fullBookText.lastIndexOf('>', target);
                if (lastLt > lastGt && lastLt >= start) {
                    if (lastLt > start) {
                        end = lastLt;
                    } else {
                        // Tag starts right at `start` and exceeds charsPerPage; include whole tag
                        const nextGt = fullBookText.indexOf('>', target);
                        end = nextGt !== -1 ? nextGt + 1 : len;
                    }
                }
            }

            // 3. Look slightly ahead for the next block-closing tag if no tag boundary was found
            if (end === -1) {
                const maxAhead = Math.min(len, target + Math.floor(safeChars * 0.5));
                const aheadSlice = fullBookText.slice(target, maxAhead);
                blockEndRegex.lastIndex = 0;
                const aheadMatch = blockEndRegex.exec(aheadSlice);
                if (aheadMatch) {
                    end = target + aheadMatch.index + aheadMatch[0].length;
                }
            }
        }

        // 4. Fallback: snap to whitespace near target (safe outside HTML tags)
        if (end === -1) {
            const minSpaceBack = Math.max(start + Math.floor(safeChars * 0.5), start + 1);
            let spaceIdx = -1;
            for (let i = target; i >= minSpaceBack; i--) {
                const ch = fullBookText[i];
                if (ch === '\n' || ch === ' ' || ch === '\t') {
                    spaceIdx = i + 1;
                    break;
                }
            }
            end = spaceIdx > start ? spaceIdx : target;
        }

        // Final safety: never split inside an HTML tag and always advance
        if (isHtml && end < len) {
            const lt = fullBookText.lastIndexOf('<', end - 1);
            const gt = fullBookText.lastIndexOf('>', end - 1);
            if (lt > gt && lt >= start) {
                if (lt > start) {
                    end = lt;
                } else {
                    const nextGt = fullBookText.indexOf('>', end);
                    end = nextGt !== -1 ? nextGt + 1 : len;
                }
            }
        }

        if (end <= start) {
            end = Math.min(len, target);
        }

        pages.push({ start, end });
        start = end;
    }

    return pages;
}

/**
 * Computes and stores HTML-aware pagination ranges on appState.
 * @param {object} appState The main appState object.
 */
export function paginateBookText(appState) {
    const pages = computeTextPages(appState.variables.fullBookText, appState.variables.charsPerPage);
    appState.variables.textPages = pages;
    appState.variables.totalTextPages = Math.max(1, pages.length);
}

/**
 * Finds the 1-based page number containing charIndex.
 * @param {number} charIndex
 * @param {number} charsPerPage
 * @param {Array<{start: number, end: number}>|null} textPages
 * @returns {number}
 */
function findPageForCharIndex(charIndex, charsPerPage, textPages) {
    if (Array.isArray(textPages) && textPages.length > 0) {
        let lo = 0;
        let hi = textPages.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const page = textPages[mid];
            if (charIndex < page.start) {
                hi = mid - 1;
            } else if (charIndex >= page.end && mid < textPages.length - 1) {
                lo = mid + 1;
            } else {
                return mid + 1;
            }
        }
        return textPages.length;
    }
    return Math.floor(charIndex / Math.max(1, charsPerPage || 4000)) + 1;
}

/**
 * Render a single text (markdown, HMTL or plain) page.
 * @param {object} appState The main appState object.
 * @param {int} num 
 * @param {boolean} append 
 */
export function renderTextPage(appState, num, append = true) {
    appState.variables.textCurrentPage = num;
    const pageRange = appState.variables.textPages?.[num - 1];
    const start = pageRange ? pageRange.start : (num - 1) * appState.variables.charsPerPage;
    const end = pageRange ? pageRange.end : start + appState.variables.charsPerPage;
    const pageText = appState.variables.fullBookText.substring(start, end);    

    const injectHTML = document.createElement('div');
    injectHTML.innerHTML = appState.functions.parseTextContent(pageText);
    injectHTML.dataset.page = appState.variables.textCurrentPage;

    appState.variables.currentTextPageLength = pageText.length; // Store for editing

    if (append) { appState.elements.textDisplay.appendChild(injectHTML) }
    else { appState.elements.textDisplay.prepend(injectHTML) }

    // Ensure we are in text view mode and apply saved text zoom
    appState.elements.pdfViewerWrapper.classList.add('hidden');
    appState.elements.textboxViewerWrapper.classList.remove('hidden');
    appState.elements.textDisplay.style.fontSize = `${appState.variables.textZoom || 100}%`;
    appState.functions.updateZoomUI?.(appState);
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

/**
 * Extracts clean plain text from an HTML fragment string.
 * @param {string} htmlFragment
 * @returns {string}
 */
function stripHtmlToText(htmlFragment) {
    const doc = new DOMParser().parseFromString(htmlFragment, 'text/html');
    return (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts chapter/heading entries with their character offset and page number
 * from the book's full text.
 * @param {string} fullBookText
 * @param {number} charsPerPage
 * @returns {Array<{title: string, level: number, charIndex: number, page: number}>}
 */
export function extractChapters(fullBookText, charsPerPage = 4000, textPages = null) {
    if (!fullBookText || typeof fullBookText !== 'string') return [];

    const chapters = [];
    const safeCharsPerPage = Math.max(1, charsPerPage || 4000);
    const hasHtmlTags = /<([a-z][a-z0-9]*)\b[^>]*>/i.test(fullBookText);

    if (hasHtmlTags) {
        const headingRegex = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
        let match;
        while ((match = headingRegex.exec(fullBookText)) !== null) {
            const title = stripHtmlToText(match[2]);
            if (!title) continue;
            chapters.push({
                title,
                level: Number.parseInt(match[1], 10),
                charIndex: match.index,
                page: findPageForCharIndex(match.index, safeCharsPerPage, textPages)
            });
        }

        // Fallback for EPUBs whose spine documents lack <h1>-<h4> headings
        if (chapters.length === 0) {
            const bodyRegex = /<body\b[^>]*>([\s\S]*?)<\/body>/gi;
            const bodies = [];
            let bodyMatch;
            while ((bodyMatch = bodyRegex.exec(fullBookText)) !== null) {
                const text = stripHtmlToText(bodyMatch[1]);
                if (!text) continue;
                bodies.push({
                    title: text.slice(0, 60) + (text.length > 60 ? '...' : ''),
                    level: 1,
                    charIndex: bodyMatch.index,
                    page: findPageForCharIndex(bodyMatch.index, safeCharsPerPage, textPages)
                });
            }
            if (bodies.length > 1) return bodies;
        }

        return chapters;
    }

    // Markdown heading fallback
    const mdHeadingRegex = /^(#{1,4})\s+(.+)$/gm;
    let mdMatch;
    while ((mdMatch = mdHeadingRegex.exec(fullBookText)) !== null) {
        const title = mdMatch[2].replace(/\s+/g, ' ').trim();
        if (!title) continue;
        chapters.push({
            title,
            level: mdMatch[1].length,
            charIndex: mdMatch.index,
            page: findPageForCharIndex(mdMatch.index, safeCharsPerPage, textPages)
        });
    }

    return chapters;
}

/**
 * Saves finer reading progress (page, scrollRatio, chunkIndex) for the active book.
 * @param {object} appState The main appState object.
 * @param {object} [overrides] Optional fields to override.
 */
export function saveReadingProgress(appState, overrides = {}) {
    const bookId = appState.variables.activeBook?.id;
    if (!bookId || appState.variables.pdfDoc) return;

    const existing = loadReadingProgress(bookId);
    const visiblePage = Number.parseInt(appState.variables.currentMostVisiblePage?.dataset?.page, 10);
    const page = overrides.page ?? (Number.isFinite(visiblePage) ? visiblePage : (appState.variables.textCurrentPage || 1));

    let scrollRatio = overrides.scrollRatio;
    if (typeof scrollRatio !== 'number') {
        const pageEl = appState.elements.textDisplay?.querySelector(`[data-page="${page}"]`);
        if (pageEl && pageEl.offsetHeight > 0) {
            const rawRatio = (window.scrollY - pageEl.offsetTop) / pageEl.offsetHeight;
            scrollRatio = Math.max(0, Math.min(1, Number(rawRatio.toFixed(4))));
        } else {
            scrollRatio = existing.scrollRatio || 0;
        }
    }

    const chunkIndex = typeof overrides.chunkIndex === 'number'
        ? overrides.chunkIndex
        : (page === existing.page ? (existing.chunkIndex || 0) : 0);

    const payload = {
        page,
        scrollRatio,
        chunkIndex,
        updatedAt: Date.now()
    };

    localStorage.setItem(`reading-progress-${bookId}`, JSON.stringify(payload));
    localStorage.setItem(`text-page-${bookId}`, String(page));
}

/**
 * Loads saved reading progress (page, scrollRatio, chunkIndex) for a book.
 * @param {string} bookId
 * @returns {{page: number, scrollRatio: number, chunkIndex: number}}
 */
export function loadReadingProgress(bookId) {
    if (!bookId) return { page: 1, scrollRatio: 0, chunkIndex: 0 };

    try {
        const raw = localStorage.getItem(`reading-progress-${bookId}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                page: Math.max(1, Number.parseInt(parsed.page, 10) || 1),
                scrollRatio: Math.max(0, Math.min(1, Number(parsed.scrollRatio) || 0)),
                chunkIndex: Math.max(0, Number.parseInt(parsed.chunkIndex, 10) || 0)
            };
        }
    } catch (e) {
        console.debug('Failed to parse reading progress:', e);
    }

    const legacyPage = Number.parseInt(localStorage.getItem(`text-page-${bookId}`), 10) || 1;
    return { page: Math.max(1, legacyPage), scrollRatio: 0, chunkIndex: 0 };
}

/**
 * Navigates the text/EPUB reader to a specific chapter.
 * @param {object} appState The main appState object.
 * @param {{title: string, level: number, charIndex: number, page: number}} chapter
 * @returns {{pageEl: Element|null, matchedHeading: Element|null}}
 */
export function goToChapter(appState, chapter) {
    if (!chapter || appState.variables.pdfDoc) return { pageEl: null, matchedHeading: null };

    const targetPage = Math.max(1, Math.min(chapter.page, appState.variables.totalTextPages || 1));
    appState.functions.disconnectUpwardsScroll?.();
    appState.elements.textDisplay.innerHTML = '';

    // Render the preceding page above when targetPage > 1 so upwards infinite
    // scroll starts above the viewport instead of firing immediately.
    if (targetPage > 1) {
        renderTextPage(appState, targetPage - 1, true);
    }
    renderTextPage(appState, targetPage, true);

    const pageEl = appState.elements.textDisplay.querySelector(`[data-page="${targetPage}"]`);
    const targetTitle = chapter.title.toLowerCase();
    const headings = (pageEl || appState.elements.textDisplay).querySelectorAll('h1, h2, h3, h4');
    const matchedHeading = Array.from(headings).find(
        el => el.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === targetTitle
    ) || null;

    const scrollTarget = matchedHeading || pageEl;
    if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }

    updateCurrentPage(appState);
    saveReadingProgress(appState, { page: targetPage, chunkIndex: 0 });

    requestAnimationFrame(() => {
        appState.functions.resetUpwardsScroll?.();
    });

    return { pageEl, matchedHeading };
}

/**
 * Jumps to a chapter and starts TTS playback from that chapter's heading.
 * @param {object} appState The main appState object.
 * @param {{title: string, level: number, charIndex: number, page: number}} chapter
 */
export function playFromChapter(appState, chapter) {
    if (!chapter || appState.variables.pdfDoc) return;

    if (appState.variables.isPlaying || appState.variables.isPaused) {
        appState.functions.stopAudioQueue?.();
    }

    const { pageEl, matchedHeading } = goToChapter(appState, chapter);
    if (!pageEl) return;

    appState.variables.currentMostVisiblePage = pageEl;
    appState.variables.currentReadingPage = pageEl;

    let startChunkIndex = 0;
    const pageText = pageEl.textContent.trim();
    if (matchedHeading && pageText) {
        const headingText = matchedHeading.textContent.trim();
        const headingOffset = headingText ? pageText.indexOf(headingText) : -1;
        if (headingOffset > 0) {
            const chunks = splitTextIntoChunks(pageText);
            let cursor = 0;
            for (let i = 0; i < chunks.length; i++) {
                const chunkEnd = cursor + chunks[i].text.length;
                if (chunkEnd > headingOffset) {
                    startChunkIndex = i;
                    break;
                }
                cursor = chunkEnd + 1;
            }
        }
    }

    appState.functions.startSpeechGeneration?.(startChunkIndex);
}

/**
 * Highlights the active chapter in #chapter-list based on the current visible page.
 * @param {object} appState The main appState object.
 */
export function updateActiveChapter(appState) {
    const chapterList = appState.elements.chapterList;
    const chapters = appState.variables.bookChapters;
    if (!chapterList || !chapters || chapters.length === 0) return;

    const visiblePageAttr = appState.variables.currentMostVisiblePage?.dataset?.page;
    const currentPage = Number.parseInt(visiblePageAttr, 10) || appState.variables.textCurrentPage || 1;

    let activeIndex = 0;
    for (let i = 0; i < chapters.length; i++) {
        if (chapters[i].page <= currentPage) activeIndex = i;
        else break;
    }

    const activeClasses = ['bg-indigo-100', 'dark:bg-indigo-900/40', 'text-indigo-700', 'dark:text-indigo-300', 'font-medium'];
    const inactiveClasses = ['text-gray-700', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-800'];

    const buttons = chapterList.querySelectorAll('button[data-chapter-index]');
    buttons.forEach((btn, idx) => {
        if (idx === activeIndex) {
            btn.classList.add(...activeClasses);
            btn.classList.remove(...inactiveClasses);
            btn.scrollIntoView({ block: 'nearest' });
        } else {
            btn.classList.remove(...activeClasses);
            btn.classList.add(...inactiveClasses);
        }
    });
}

/**
 * Populates the chapter selection box inside #book-info.
 * @param {object} appState The main appState object.
 */
export function renderChapterList(appState) {
    const container = appState.elements.chapterSelectContainer;
    const list = appState.elements.chapterList;
    const countEl = appState.elements.chapterCount;
    if (!container || !list) return;

    list.innerHTML = '';

    if (appState.variables.pdfDoc) {
        appState.variables.bookChapters = [];
        container.classList.add('hidden');
        if (countEl) countEl.textContent = '';
        return;
    }

    const chapters = extractChapters(
        appState.variables.fullBookText,
        appState.variables.charsPerPage,
        appState.variables.textPages
    );
    appState.variables.bookChapters = chapters;

    if (chapters.length === 0) {
        container.classList.add('hidden');
        if (countEl) countEl.textContent = '';
        return;
    }

    container.classList.remove('hidden');
    if (countEl) countEl.textContent = `${chapters.length}`;

    const indentClasses = {
        1: 'pl-2',
        2: 'pl-4',
        3: 'pl-6',
        4: 'pl-8'
    };

    chapters.forEach((chapter, index) => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-1';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.chapterIndex = String(index);
        btn.title = chapter.title;
        btn.className = `flex-1 min-w-0 text-left py-1 pr-2 ${indentClasses[chapter.level] || 'pl-2'} rounded-lg flex items-center justify-between gap-2 transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800`;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'truncate';
        titleSpan.textContent = chapter.title;

        const pageSpan = document.createElement('span');
        pageSpan.className = 'shrink-0 text-[10px] text-gray-400 dark:text-gray-500';
        pageSpan.textContent = `p.${chapter.page}`;

        btn.appendChild(titleSpan);
        btn.appendChild(pageSpan);
        btn.addEventListener('click', () => goToChapter(appState, chapter));

        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.title = `Play from ${chapter.title}`;
        playBtn.ariaLabel = `Play from ${chapter.title}`;
        playBtn.className = 'shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors';
        playBtn.innerHTML = '<i class="fas fa-play text-[10px]"></i>';
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playFromChapter(appState, chapter);
        });

        li.appendChild(btn);
        li.appendChild(playBtn);
        list.appendChild(li);
    });

    updateActiveChapter(appState);
}