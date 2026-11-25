/**
 * Content Preview on Hover Module
 * Manages floating popover previews for books and library items.
 */

let previewCard = null;
let hoverTimeout = null;
let currentTarget = null;

const HOVER_DELAY_MS = 250;

/**
 * Ensures the singleton preview card element exists in the DOM.
 */
function ensurePreviewCard() {
    if (previewCard) return previewCard;

    previewCard = document.createElement('div');
    previewCard.id = 'content-hover-preview';
    previewCard.className = [
        'fixed z-50 pointer-events-none transition-all duration-150 ease-out opacity-0 scale-95',
        'w-72 max-w-[90vw] p-3.5 rounded-xl shadow-2xl backdrop-blur-md',
        'bg-white/95 dark:bg-gray-800/95 border border-indigo-100 dark:border-gray-700',
        'text-gray-800 dark:text-gray-200 hidden'
    ].join(' ');

    previewCard.innerHTML = `
        <div class="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700/80">
            <div class="flex items-center gap-2 overflow-hidden">
                <span id="preview-icon" class="text-indigo-500 dark:text-indigo-400 text-sm flex-shrink-0"></span>
                <h4 id="preview-title" class="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate"></h4>
            </div>
            <span id="preview-badge" class="px-1.5 py-0.5 text-[10px] font-medium rounded uppercase bg-indigo-50 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex-shrink-0"></span>
        </div>
        <div id="preview-meta" class="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 mb-2">
            <span id="preview-progress" class="flex items-center gap-1"></span>
            <span id="preview-details" class="truncate"></span>
        </div>
        <div class="relative bg-gray-50/70 dark:bg-gray-900/50 rounded-lg p-2.5 border border-gray-100/80 dark:border-gray-800">
            <p id="preview-snippet" class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-4 break-words font-sans italic"></p>
        </div>
    `;

    document.body.appendChild(previewCard);
    return previewCard;
}

/**
 * Calculates coordinates to place the preview popover smartly relative to target.
 * Prefers right side (for sidebar), falls back to top/bottom/left if overflowing viewport.
 */
function positionPreview(targetRect, popoverElem) {
    const margin = 12;
    const popWidth = popoverElem.offsetWidth || 288; // 18rem ~ 288px
    const popHeight = popoverElem.offsetHeight || 150;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = targetRect.right + margin;
    let top = targetRect.top + (targetRect.height / 2) - (popHeight / 2);

    // If it overflows right (e.g., in library grid), try placing it to the left or above
    if (left + popWidth > viewportWidth - margin) {
        if (targetRect.left - popWidth - margin > margin) {
            left = targetRect.left - popWidth - margin;
        } else {
            // Place below or above centered
            left = Math.max(margin, Math.min(viewportWidth - popWidth - margin, targetRect.left));
            top = targetRect.bottom + margin;
        }
    }

    // Clamp vertical position within viewport bounds
    if (top + popHeight > viewportHeight - margin) {
        top = viewportHeight - popHeight - margin;
    }
    if (top < margin) {
        top = margin;
    }

    popoverElem.style.left = `${Math.round(left)}px`;
    popoverElem.style.top = `${Math.round(top)}px`;
}

/**
 * Shows the preview popover for given data and anchor element.
 * @param {HTMLElement} targetEl Anchor element
 * @param {Object} data Preview details
 */
export function showContentPreview(targetEl, data = {}) {
    currentTarget = targetEl;
    clearTimeout(hoverTimeout);

    hoverTimeout = setTimeout(() => {
        if (currentTarget !== targetEl) return;

        const card = ensurePreviewCard();
        const iconEl = card.querySelector('#preview-icon');
        const titleEl = card.querySelector('#preview-title');
        const badgeEl = card.querySelector('#preview-badge');
        const progressEl = card.querySelector('#preview-progress');
        const detailsEl = card.querySelector('#preview-details');
        const snippetEl = card.querySelector('#preview-snippet');

        iconEl.innerHTML = data.iconHtml || '<i class="fas fa-book"></i>';
        titleEl.textContent = data.title || 'Untitled';
        badgeEl.textContent = data.badge || (data.isPdf ? 'PDF' : 'Text');

        if (data.progress) {
            progressEl.innerHTML = `<i class="fas fa-bookmark text-[10px]"></i> ${data.progress}`;
            progressEl.classList.remove('hidden');
        } else {
            progressEl.classList.add('hidden');
        }

        if (data.details) {
            detailsEl.textContent = data.details;
            detailsEl.classList.remove('hidden');
        } else {
            detailsEl.classList.add('hidden');
        }

        snippetEl.textContent = data.snippet
            ? `“${data.snippet}”`
            : 'No text preview available for this item.';

        card.classList.remove('hidden');
        card.style.display = 'block';

        const rect = targetEl.getBoundingClientRect();
        positionPreview(rect, card);

        // Animate entrance
        requestAnimationFrame(() => {
            card.classList.remove('opacity-0', 'scale-95');
            card.classList.add('opacity-100', 'scale-100');
        });
    }, HOVER_DELAY_MS);
}

/**
 * Hides and closes the preview popover immediately or clears hover timer.
 */
export function hideContentPreview() {
    clearTimeout(hoverTimeout);
    currentTarget = null;

    if (previewCard && !previewCard.classList.contains('hidden')) {
        previewCard.classList.remove('opacity-100', 'scale-100');
        previewCard.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            if (!currentTarget && previewCard) {
                previewCard.classList.add('hidden');
                previewCard.style.display = 'none';
            }
        }, 150);
    }
}

/**
 * Attaches hover preview event listeners to a target element.
 * @param {HTMLElement} element DOM Element to attach listeners to
 * @param {Function|Object} dataProvider Callback or object returning preview data
 */
export function attachContentPreview(element, dataProvider) {
    if (!element) return;

    element.addEventListener('mouseenter', () => {
        const data = typeof dataProvider === 'function' ? dataProvider() : dataProvider;
        if (data) {
            showContentPreview(element, data);
        }
    });

    element.addEventListener('mouseleave', () => {
        hideContentPreview();
    });

    element.addEventListener('focus', () => {
        const data = typeof dataProvider === 'function' ? dataProvider() : dataProvider;
        if (data) {
            showContentPreview(element, data);
        }
    });

    element.addEventListener('blur', () => {
        hideContentPreview();
    });
}
