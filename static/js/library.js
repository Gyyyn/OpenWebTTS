
/**
 * Generates an HTML grid display for a list of files.
 * @param {Array<Object>} files An array of file objects, each with at least 'name' and 'type'.
 * @returns {HTMLElement} The container div element with the file grid.
 */
export function createFilesGrid(files) {
    const container = document.createElement('div');
    container.id = 'library-file-grid';
    // Apply Tailwind classes for grid styles, and add 'relative' for absolute positioning of the close button
    container.className = 'm-5 file-grid-container grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-5 border border-gray-200 rounded-lg bg-gray-50 shadow-md relative transition-opacity duration-300 ease-in-out';

    if (!files || files.length === 0) {
        const message = document.createElement('p');
        message.textContent = 'No files uploaded yet.';
        message.className = 'text-center col-span-full text-gray-500 py-4'; // Tailwind classes for centering and spanning
        container.appendChild(message);
        return container;
    }

    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = ' cursor-pointer file-grid-item border border-gray-300 rounded-md p-4 text-center bg-white shadow-sm flex flex-col justify-between transition-all duration-200 ease-in-out hover:-translate-y-1 hover:shadow-md';

        // Add a simple icon based on file type
        let icon = '📁'; // Default folder icon
        if (file.type.includes('image')) icon = '🖼️';
        else if (file.type.includes('pdf')) icon = '📄';
        else if (file.type.includes('word') || file.type.includes('document')) icon = '📝';
        else if (file.type.includes('excel') || file.type.includes('spreadsheet')) icon = '📊';
        else if (file.type.includes('presentation')) icon = '💻';
        else if (file.type.includes('video')) icon = '🎬';
        else if (file.type.includes('audio')) icon = '🎵';
        else if (file.type.includes('zip') || file.type.includes('rar')) icon = '📦';
        else if (file.type.includes('code') || file.type.includes('javascript')) icon = '<code>';

        const iconElement = document.createElement('div');
        iconElement.textContent = icon;
        iconElement.className = 'text-4xl mb-2 text-gray-600'; // Tailwind classes for icon size and margin

        const nameElement = document.createElement('p');
        nameElement.textContent = file.name;
        nameElement.className = 'font-bold mt-0 mb-1 break-all text-gray-800'; // Tailwind classes for font, margin, and word break

        const detailsElement = document.createElement('small');
        detailsElement.className = 'text-gray-500 text-xs mt-auto'; // Tailwind classes for color, size, and pushing to bottom

        let detailsText = '';
        if (file.size) detailsText += `Size: ${file.size}`;
        if (file.uploadDate) detailsText += (detailsText ? ' | ' : '') + `Uploaded: ${file.uploadDate}`;
        detailsElement.textContent = detailsText;

        fileItem.appendChild(iconElement);
        fileItem.appendChild(nameElement);
        fileItem.appendChild(detailsElement);

        container.appendChild(fileItem);
    });

    return container;
}