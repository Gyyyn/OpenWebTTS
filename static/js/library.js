import { attachContentPreview } from './preview.js';

// Suggested famous books from Project Gutenberg to teach users about file importing
const GUTENBERG_SUGGESTIONS = [
    {
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        format: 'EPUB',
        downloadUrl: 'https://www.gutenberg.org/ebooks/1342.epub3.images',
        description: 'A romantic novel following the turbulent relationship between Elizabeth Bennet and Fitzwilliam Darcy.'
    },
    {
        title: 'Frankenstein',
        author: 'Mary Shelley',
        format: 'EPUB',
        downloadUrl: 'https://www.gutenberg.org/ebooks/84.epub3.images',
        description: 'The story of Victor Frankenstein, a young scientist who creates a sapient creature in an unorthodox scientific experiment.'
    },
    {
        title: "Alice's Adventures in Wonderland",
        author: 'Lewis Carroll',
        format: 'EPUB',
        downloadUrl: 'https://www.gutenberg.org/ebooks/11.epub3.images',
        description: 'A young girl named Alice falls through a rabbit hole into a fantasy world of anthropomorphic creatures.'
    },
    {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        format: 'EPUB',
        downloadUrl: 'https://www.gutenberg.org/ebooks/64317.epub3.images',
        description: 'The tragic story of Jay Gatsby, a self-made millionaire, and his pursuit of Daisy Buchanan in 1920s America.'
    },
    {
        title: 'The Adventures of Sherlock Holmes',
        author: 'Arthur Conan Doyle',
        format: 'EPUB',
        downloadUrl: 'https://www.gutenberg.org/ebooks/1661.epub3.images',
        description: 'A collection of twelve short stories featuring Sherlock Holmes and Dr. Watson solving complex Victorian mysteries.'
    },
    {
        title: 'Dracula',
        author: 'Bram Stoker',
        format: 'EPUB',
        downloadUrl: 'https://www.gutenberg.org/ebooks/345.epub3.images',
        description: 'The classic Gothic horror novel of Count Dracula’s attempt to move from Transylvania to England.'
    }
];

function getFileIconHtml(type = '') {
    if (type.includes('image')) return '<i class="fas fa-image"></i>';
    if (type.includes('pdf')) return '<i class="fas fa-file-pdf"></i>';
    if (type.includes('word') || type.includes('document')) return '<i class="fas fa-file-word"></i>';
    if (type.includes('excel') || type.includes('spreadsheet')) return '<i class="fas fa-file-excel"></i>';
    if (type.includes('presentation')) return '<i class="fas fa-file-powerpoint"></i>';
    if (type.includes('video')) return '<i class="fas fa-file-video"></i>';
    if (type.includes('audio')) return '<i class="fas fa-file-audio"></i>';
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return '<i class="fas fa-file-archive"></i>';
    if (type.includes('code') || type.includes('javascript')) return '<i class="fas fa-file-code"></i>';
    if (type.includes('epub') || type.includes('book')) return '<i class="fas fa-book"></i>';
    return '<i class="fas fa-file"></i>';
}

/**
 * Generates a responsive card grid for file or book items.
 * @param {Array<Object>} items Array of items with title/name, subtitle/author/details, and action/url/downloadUrl.
 * @param {Object} [options] Optional configuration.
 * @param {string} [options.emptyMessage='No items available.'] Message shown when items is empty.
 * @param {string} [options.gridClass] Custom grid classes.
 * @returns {HTMLElement}
 */
export function createFileGrid(items, options = {}) {
    const {
        emptyMessage = 'No items available.',
        gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4'
    } = options;

    const grid = document.createElement('div');
    grid.className = gridClass;

    if (!items || items.length === 0) {
        const message = document.createElement('p');
        message.textContent = emptyMessage;
        message.className = 'text-center col-span-full text-gray-500 dark:text-gray-400 py-4';
        grid.appendChild(message);
        return grid;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-all duration-200';

        const infoDiv = document.createElement('div');

        const iconDiv = document.createElement('div');
        iconDiv.className = 'text-indigo-500 dark:text-indigo-400 text-2xl mb-2';
        iconDiv.innerHTML = item.iconHtml || getFileIconHtml(item.type);

        const itemTitle = document.createElement('h4');
        itemTitle.className = 'font-bold text-sm text-gray-800 dark:text-gray-200 mb-1 break-words';
        itemTitle.textContent = item.title ?? item.name ?? 'Untitled';

        const itemSubtitle = document.createElement('p');
        itemSubtitle.className = 'text-xs text-gray-500 dark:text-gray-400 mb-3';
        itemSubtitle.textContent = item.subtitle ?? item.author ?? item.details ?? '';

        infoDiv.appendChild(iconDiv);
        infoDiv.appendChild(itemTitle);
        if (itemSubtitle.textContent) {
            infoDiv.appendChild(itemSubtitle);
        }

        card.appendChild(infoDiv);

        if (item.downloadUrl) {
            const dlBtn = document.createElement('a');
            dlBtn.href = item.downloadUrl;
            dlBtn.download = '';
            dlBtn.className = 'inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/70 border border-indigo-200 dark:border-indigo-700 transition-colors duration-150';
            dlBtn.innerHTML = `<i class="fas fa-download"></i> ${item.actionLabel || `Download ${item.format || 'File'}`}`;
            card.appendChild(dlBtn);
        } else if (item.url) {
            const openBtn = document.createElement('a');
            openBtn.href = item.url;
            openBtn.target = '_blank';
            openBtn.rel = 'noopener noreferrer';
            openBtn.className = 'inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/70 border border-indigo-200 dark:border-indigo-700 transition-colors duration-150';
            openBtn.innerHTML = `<i class="fas fa-external-link-alt"></i> ${item.actionLabel || 'Open File'}`;
            card.appendChild(openBtn);
        }

        // Attach content preview on card hover
        attachContentPreview(card, () => {
            return {
                title: item.title ?? item.name ?? 'File',
                badge: item.format || (item.type ? item.type.split('/').pop().toUpperCase() : 'FILE'),
                iconHtml: item.iconHtml || getFileIconHtml(item.type),
                details: item.subtitle ?? item.author ?? '',
                progress: item.downloadUrl ? 'Ready to download' : 'Uploaded document',
                snippet: item.description || item.snippet || `Click to download or open "${item.title ?? item.name}". Import into OpenWebTTS to read and synthesize speech.`
            };
        });

        grid.appendChild(card);
    });

    return grid;
}

/**
 * Creates the Project Gutenberg suggestions section explaining how to import books.
 * @returns {HTMLElement} The suggestions container element.
 */
function createGutenbergSection() {
    const section = document.createElement('div');
    section.className = 'col-span-full mt-6 pt-6 border-t border-gray-200 dark:border-gray-700';

    // Section header
    const header = document.createElement('div');
    header.className = 'mb-4';

    const title = document.createElement('h3');
    title.className = 'text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2';
    title.innerHTML = '<i class="fas fa-book-open text-indigo-500"></i> Suggested Free Classics (Project Gutenberg)';

    const guideText = document.createElement('p');
    guideText.className = 'text-sm text-gray-600 dark:text-gray-400 mt-1';
    guideText.innerHTML = 'Download an EPUB below to try importing books into OpenWebTTS! Once downloaded, click <strong>"New Book"</strong> in the sidebar, open the <strong>Import</strong> button, and choose your downloaded file.';

    header.appendChild(title);
    header.appendChild(guideText);
    section.appendChild(header);

    // Suggestions grid using the shared createFileGrid helper
    const suggestionItems = GUTENBERG_SUGGESTIONS.map(book => ({
        title: book.title,
        subtitle: book.author,
        type: 'book',
        format: book.format,
        downloadUrl: book.downloadUrl,
        description: book.description
    }));

    section.appendChild(
        createFileGrid(suggestionItems, {
            emptyMessage: 'No suggested books available.',
            gridClass: 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 mb-5'
        })
    );

    // Footer with link to Project Gutenberg
    const footer = document.createElement('div');
    footer.className = 'text-center text-xs text-gray-500 dark:text-gray-400 py-2';
    footer.innerHTML = `Explore over 70,000 free eBooks at <a href="https://www.gutenberg.org" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">Project Gutenberg <i class="fas fa-external-link-alt text-[10px]"></i></a>.`;
    section.appendChild(footer);

    return section;
}

/**
 * Generates an HTML grid display for a list of files plus Project Gutenberg suggestions.
 * @param {Array<Object>} files An array of file objects, each with at least 'name' and 'type'.
 * @returns {HTMLElement} The container div element with the file grid.
 */
export function createUserFiles(files) {
    const container = document.createElement('div');
    container.id = 'library-file-grid';
    container.className = 'm-5 file-grid-container p-5 relative transition-opacity duration-300 ease-in-out';

    const fileItems = (files || []).map(file => {
        const detailParts = [];
        if (file.size) detailParts.push(`Size: ${file.size}`);
        if (file.uploadDate) detailParts.push(`Uploaded: ${file.uploadDate}`);

        return {
            title: file.name,
            subtitle: detailParts.join(' | '),
            type: file.type || '',
            url: file.url
        };
    });

    container.appendChild(
        createFileGrid(fileItems, {
            emptyMessage: 'No files uploaded yet.'
        })
    );

    // Append Project Gutenberg suggestions section
    container.appendChild(createGutenbergSection());

    return container;
}

/**
 * Fetches and renders a grid display of PDFs for the current user.
 * @param {string} currentUser The username of the currently logged-in user.
 * @returns {Promise<HTMLElement>} A promise that resolves to the container div element with the PDF grid.
 */
export async function renderUserPdfs(currentUser) {
    try {
        const response = await fetch(`/api/users/${currentUser}/pdfs`);
        if (!response.ok) {
            throw new Error(`Failed to fetch user PDFs: ${response.statusText}`);
        }
        const data = await response.json();

        const pdfsForGrid = data.pdfs.map(pdf => ({
            name: pdf.title,
            type: 'application/pdf',
            id: pdf.id,
            url: pdf.content
        }));

        return createUserFiles(pdfsForGrid);
    } catch (error) {
        console.error('Error rendering user PDFs:', error);
        const errorContainer = document.createElement('div');
        errorContainer.className = 'm-5 p-5 text-center text-red-500';
        errorContainer.textContent = `Failed to load PDFs: ${error.message}`;
        return errorContainer;
    }
}