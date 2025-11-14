
/**
 * Show a temporary notification toast.
 * @param {string} message 
 * @param {string} [type] 
 */
export function showNotification(message, type = 'info') {
    const notificationHistory = JSON.parse(localStorage.getItem('notifications') || '[]');
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        type === 'warning' ? 'bg-yellow-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    
    notification.textContent = message;
    document.body.appendChild(notification);

    notificationHistory.push({ message: message, type: type, time: Date.now() });
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);

    localStorage.setItem('notifications', JSON.stringify(notificationHistory));
}

export function handleSidebarCollapse(appState) {
    const isCollapsed = appState.elements.sidebar.classList.contains('collapsed');
    appState.elements.collapseSidebarButton.classList.toggle('rotate-180');
    appState.elements.collapseSidebarButton.classList.toggle('cursor-[w-resize]');
    appState.elements.collapseSidebarButton.classList.toggle('cursor-[e-resize]');
    appState.elements.sidebar.style.transition = 'transform 0.3s cubic-bezier(1,0,0,1)';

    if (!isCollapsed) appState.elements.sidebar.style.transform = 'translateX(-210px)';
    else appState.elements.sidebar.style.transform = 'translateX(210px)';

    setTimeout(() => {
        appState.elements.sidebar.style.transform = '';
        appState.elements.sidebar.style.transition = '';
        appState.elements.mainDiv.classList.toggle('md:ml-[260px]', isCollapsed);
        appState.elements.mainDiv.classList.toggle('md:ml-[50px]', !isCollapsed);
        appState.elements.sidebar.classList.toggle('collapsed');
    }, 300);
}

/**
 * Generate and render notifications from localStorage.
 * @param {object} appState The main appState object.
 */
export function renderNotifications(appState) {
    const notifications = JSON.parse(localStorage.getItem('notifications')).reverse();
    if (notifications?.length < 0) return;

    // Stop here, since default is already a no notification message.
    if (notifications.length === 0) return;



    const liList = notifications.map(item => `
    <li class="p-4 hover:bg-gray-50">
        <div class="text-sm text-gray-800">${item.message}</div>
        <div class="mt-1 text-xs text-gray-500">${appState.functions.readableUnixTime(item.time)}</div>
    </li>
    `).join('');

    appState.elements.notificationList.innerHTML = liList;
}

/**
 * Update the current user in the sidebar.
 * @param {object} appState The main appState object.
 */
export function updateCurrentUserUI(appState) {
    const userDetails = document.querySelector('#current-user + div');
    
    if (!appState.variables.currentUser) {
        appState.elements.currentUserDisplay.textContent = 'Anonymous';
        userDetails.textContent = 'Not signed in';
        appState.elements.logoutBtn.classList.add('hidden');
        return;
    }

    appState.elements.currentUserDisplay.textContent = appState.variables.currentUser;
    userDetails.textContent = 'Signed in';
    appState.elements.logoutBtn.classList.remove('hidden');
}

/**
 * FSM for the Play/Pause/Generate button.
 * @param {object} appState The main appState object.
 */
export function updatePlayerUI(newState, appState) {
    appState.elements.generateBtnIcon.classList.remove('fa-play', 'fa-pause', 'fa-sync-alt', 'fa-volume-high', 'animate-spin');
    switch (newState) {
        case 'IDLE':
            appState.elements.generateBtn.disabled = false;
            appState.variables.isPlaying = false;
            appState.variables.isPaused = false;
            appState.elements.stopBtn.disabled = false;
            appState.elements.playbackSpeed.disabled = false;
            appState.elements.generateBtnText.textContent = 'Listen';
            appState.elements.generateBtnIcon.classList.add('fa-volume-high');
            break;
        case 'BUFFERING':
            appState.elements.generateBtn.disabled = true;
            appState.variables.isPlaying = false;
            appState.variables.isPaused = false;
            appState.elements.playbackSpeed.disabled = true;
            appState.elements.generateBtnText.textContent = 'Loading';
            appState.elements.generateBtnIcon.classList.add('fa-sync-alt', 'animate-spin');
            break;
        case 'PLAYING':
            appState.elements.generateBtn.disabled = false;
            appState.variables.isPlaying = true;
            appState.variables.isPaused = false;
            appState.elements.playbackSpeed.disabled = false;
            appState.elements.generateBtnText.textContent = 'Pause';
            appState.elements.generateBtnIcon.classList.add('fa-pause');
            break;
        case 'PAUSED':
            appState.elements.generateBtn.disabled = false;
            appState.variables.isPlaying = false;
            appState.variables.isPaused = true;
            appState.elements.playbackSpeed.disabled = false;
            appState.elements.generateBtnText.textContent = 'Play';
            appState.elements.generateBtnIcon.classList.add('fa-play');
            break;
    }
}

/**
 * Updates the voices list.
 * @param {object} appState The main appState object.
 */
export async function updateVoices(appState) {
    const engine = appState.elements.engineSelect.value;
    appState.elements.voiceSelect.innerHTML = '<option value="">Loading voices...</option>';

    try {
        let endpoint = `/api/voices?engine=${engine}`;
        let apiKey = null;

        if (engine === 'gemini') {
            apiKey = localStorage.getItem('geminiApiKey');
            if (!apiKey) {
                showNotification('Please set your Gemini API Key in the Config page.', 'warn');
                voiceSelect.innerHTML = '<option value="">-- API key needed --</option>';
                return;
            }
            endpoint += `&api_key=${apiKey}`;
        }

        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error('Failed to fetch voices.');
        }
        const voices = await response.json();

        appState.elements.voiceSelect.innerHTML = '';
        if (voices.length === 0) {
            appState.elements.voiceSelect.innerHTML = '<option value="">-- No voices found --</option>';
            return;
        }
        
        if (appState.variables.bookDetectedLang) {
            voices.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const lang = appState.variables.bookDetectedLang.toLowerCase();

                if (aName.includes(lang) && !bName.includes(lang)) {
                    return -1;
                }
                if (!aName.includes(lang) && bName.includes(lang)) {
                    return 1;
                }
                return 0;
            });
        }

        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.id;
            option.textContent = voice.name;
            appState.elements.voiceSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error fetching voices:', error);
        appState.elements.voiceSelect.innerHTML = '<option value="">-- Error loading voices --</option>';
    }
}

/**
 * Updates the current page span.
 * @param {object} appState The main appState object.
 */
export function updateCurrentPage(appState) {
    appState.variables.currentMostVisiblePage = appState.functions.getCurrentMainVisiblePage(appState.variables.currentPageContainer);
    if (!appState.variables.currentMostVisiblePage) return;

    let maxPages = appState.variables.totalTextPages;
    if (appState.variables.pdfDoc) maxPages = appState.variables.pdfDoc.numPages;
    
    // Update the span.
    appState.elements.pageNumSpan.textContent = `Page ${Number.parseInt(appState.variables.currentMostVisiblePage.dataset.page)} of ${Number.parseInt(maxPages)}`;
}

export function updateTextChunkReader(appState) {
    if (!appState.elements.currentChunk) return;

    const currentAudio = appState.variables.audioQueue[appState.variables.currentChunkIndex];

    appState.elements.currentChunkTextSpan.textContent = currentAudio.text.text;
    appState.elements.currentChunk.classList.remove('hidden');
}

/**
 * Show the file dialog with actions.
 * @param {string} title The dialog title.
 * @param {string} actionText The text for the action button.
 * @param {Function} actionCallback The callback for the action button.
 * @param {object} options Misc options: showInput, inputValue.
 * @param {object} appState The main appState object.
 */
export function showBookModal(title, actionText, actionCallback, options = {}, appState) {
    const { showInput = true, inputValue = '' } = options;
    appState.elements.modalTitle.textContent = title;
    appState.elements.modalActionBtn.querySelector('span:first-child').textContent = actionText;
    appState.elements.modalActionBtn.onclick = actionCallback;

    if (showInput) {
        appState.elements.bookTitleInput.value = inputValue;
        appState.elements.bookTitleInput.style.display = 'block';
    } else appState.elements.bookTitleInput.style.display = 'none';

    appState.elements.bookModal.classList.remove('hidden');
}

/**
 * Shows the login dialog.
 * @param {object} appState The main appState object.
 */
export function showLoginModal(appState) {
    appState.elements.loginModal.classList.remove('hidden');
}

/**
 * Hides the login dialog.
 * @param {object} appState The main appState object.
 */
export function hideLoginModal(appState) {
    appState.elements.loginModal.classList.add('hidden');
}

/**
 * Hides the book dialog.
 * @param {object} appState The main appState object.
 */
export function hideBookModal(appState) {
    appState.elements.bookModal.classList.add('hidden');
    appState.elements.bookTitleInput.value = ''; // Clear input on hide
}

/**
 * Shows the files modal.
 * @param {object} appState The main appState object.
 */
export function showFileModal(appState) {
    appState.elements.filePickerModal.classList.remove('hidden');
    // Reset file input
    appState.elements.pdfFileInput.value = '';
}

/**
 * Hides the file modal.
 * @param {object} appState The main appState object.
 */
export function hideFileModal(appState) {
    appState.elements.filePickerModal.classList.add('hidden');
    // Reset file input
    appState.elements.pdfFileInput.value = '';
}

/**
 * Resets the book view after rendering a PDF.
 * @param {object} appState The main appState object.
 */
export function resetPdfView(appState) {
    appState.elements.pdfViewerWrapper.classList.add('hidden');
    appState.elements.textboxViewerWrapper.classList.remove('hidden');
    appState.elements.pdfViewer.innerHTML = '';
    appState.variables.pdfDoc = null;

    // When resetting PDF view, ensure PDF-specific controls are disabled
    appState.elements.zoomInBtn.disabled = true;
    appState.elements.zoomOutBtn.disabled = true;
}

/**
 * Resets the entire book view.
 * @param {object} appState The main appState object.
 */
export function resetBookView(appState) {
    appState.elements.textDisplay.textContent = '';
    appState.elements.currentChunkTextSpan.textContent = '';
    appState.elements.currentChunk.classList.add('hidden');
    appState.elements.bookPageTitle.textContent = 'New Book';
    appState.elements.bookView.classList.add('hidden');
    appState.elements.textboxViewerWrapper.classList.remove('hidden');
    appState.variables.fullBookText = '';
    appState.variables.totalTextPages = 1;
    appState.variables.textCurrentPage = 1;
    appState.elements.pageNumSpan.textContent = '';
}

/**
 * Checks whether to hide or show the empty text overlay.
 * @param {object} appState The main appState object.
 */
export function checkTextContent(appState) {
    if (appState.variables.activeBook.source === 'online') {
        appState.elements.emptyTextOverlay.classList.add('hidden');
        return;
    }

    const hasContent = appState.elements.textDisplay.textContent.trim().length > 0;
    if (hasContent) appState.elements.emptyTextOverlay.classList.add('hidden');
    else appState.elements.emptyTextOverlay.classList.remove('hidden');
}