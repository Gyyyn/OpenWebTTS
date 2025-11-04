
/**
 * Generates an HTML grid display for a list of files.
 * @param {Array<Object>} files An array of file objects, each with at least 'name' and 'type'.
 * @returns {HTMLElement} The container div element with the file grid.
 */
export function createFilesGrid(files) {
    const container = document.createElement('div');
    container.id = 'library-file-grid';
    container.className = 'm-5 file-grid-container grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-5 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700 shadow-md relative transition-opacity duration-300 ease-in-out';

    if (!files || files.length === 0) {
        const message = document.createElement('p');
        message.textContent = 'No files uploaded yet.';
        message.className = 'text-center col-span-full text-gray-500 dark:text-gray-400 py-4';
        container.appendChild(message);
        return container;
    }

    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = ' cursor-pointer file-grid-item rounded-md p-4 text-center dark:bg-gray-800 bg-white shadow-sm flex flex-col justify-between transition-all duration-200 ease-in-out hover:-translate-y-1 hover:shadow-md';

        // Add a simple icon based on file type
        let icon = '📁'; // Default folder icon
        if (file.type.includes('image')) icon = '🖼️';
        else if (file.type.includes('pdf')) icon = `<i class="fas fa-file-pdf"></i>`;
        else if (file.type.includes('word') || file.type.includes('document')) icon = '📝';
        else if (file.type.includes('excel') || file.type.includes('spreadsheet')) icon = '📊';
        else if (file.type.includes('presentation')) icon = '💻';
        else if (file.type.includes('video')) icon = '🎬';
        else if (file.type.includes('audio')) icon = '🎵';
        else if (file.type.includes('zip') || file.type.includes('rar')) icon = '📦';
        else if (file.type.includes('code') || file.type.includes('javascript')) icon = '<code>';

        const iconElement = document.createElement('div');
        iconElement.innerHTML = icon;
        iconElement.className = 'text-4xl mb-2 text-gray-600 dark:text-gray-400';

        const nameElement = document.createElement('p');
        nameElement.textContent = file.name;
        nameElement.className = 'font-bold mt-0 mb-1 break-all text-gray-800 dark:text-gray-200';

        const detailsElement = document.createElement('small');
        detailsElement.className = 'text-gray-500 text-xs mt-auto';

        let detailsText = '';
        if (file.size) detailsText += `Size: ${file.size}`;
        if (file.uploadDate) detailsText += (detailsText ? ' | ' : '') + `Uploaded: ${file.uploadDate}`;
        detailsElement.textContent = detailsText;

        fileItem.addEventListener('click', () => {
            window.open(file.url, '_blank');
        });

        fileItem.appendChild(iconElement);
        fileItem.appendChild(nameElement);
        fileItem.appendChild(detailsElement);

        container.appendChild(fileItem);
    });

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
            id: pdf.id, // Keep the ID for potential future interactions
            url: pdf.content // The URL to fetch the PDF content
        }));

        return createFilesGrid(pdfsForGrid);
    } catch (error) {
        console.error('Error rendering user PDFs:', error);
        const errorContainer = document.createElement('div');
        errorContainer.className = 'm-5 p-5 text-center text-red-500';
        errorContainer.textContent = `Failed to load PDFs: ${error.message}`;
        return errorContainer;
    }
}