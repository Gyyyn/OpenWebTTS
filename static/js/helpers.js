/**
 * -- helpers.js
 * --
 * -- Functions that don't need page context.
 *
 */

/**
 * Calculates the similarity between two strings and checks if it meets a minimum percentage.
 * Similarity is determined using the Levenshtein distance.
 *
 * @param {string} stringA The first string.
 * @param {string} stringB The second string.
 * @param {number} minPercentage The minimum required similarity percentage (e.g., 80 for 80%).
 * @returns {boolean} Returns true if stringA is at least X percent similar to stringB.
 */
export function isSimilar(stringA, stringB, minPercentage) {
    // Handle invalid percentage input
    if (minPercentage < 0 || minPercentage > 100) {
        throw new Error("Percentage must be between 0 and 100.");
    }

    // Find the length of the longer string
    const maxLength = Math.max(stringA.length, stringB.length);

    // If both strings are empty, they are 100% similar
    if (maxLength === 0) {
        return true;
    }

    // Calculate the Levenshtein distance between the strings
    const distance = levenshteinDistance(stringA, stringB);

    // Convert the distance to a similarity percentage
    const similarity = (1 - distance / maxLength) * 100;

    // Check if the similarity meets the minimum requirement
    return similarity >= minPercentage;
    }

    /**
     * A helper function to calculate the Levenshtein distance between two strings.
     * This is the number of edits needed to change one string into the other.
     * @param {string} str1 The first string.
     * @param {string} str2 The second string.
     * @returns {number} The edit distance.
     */
    function levenshteinDistance(str1 = '', str2 = '') {
    // Create a 2D array to store distances
    const track = Array(str2.length + 1).fill(null).map(() =>
        Array(str1.length + 1).fill(null)
    );

    // Initialize the first row and column of the matrix
    for (let i = 0; i <= str1.length; i++) {
        track[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
        track[j][0] = j;
    }

    // Fill the rest of the matrix
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
            track[j][i - 1] + 1, // Deletion
            track[j - 1][i] + 1, // Insertion
            track[j - 1][i - 1] + indicator, // Substitution
        );
        }
    }

    // The final distance is in the bottom-right cell
    return track[str2.length][str1.length];
}

/**
 * Processes a string by repeatedly checking its similarity against a reference string.
 * If not similar, it splits the string in half and retries, until the string
 * is 3 words or less, or until it is found to be similar.
 * @param {string} initialString The string to start with.
 * @param {string} comparisonString The string to compare against.
 * @param {number} minPercentage The similarity threshold.
 * @returns {string} The final resulting string.
 */
export function checkPhraseSimilarity(initialString, comparisonString, minPercentage) {
    let currentString = initialString;

    // We use a while loop that checks the word count on each iteration
    while (currentString.split(' ').length > 3) {
        if (isSimilar(currentString, comparisonString, minPercentage)) {
        break; // Exit the loop if similarity is met
        } else {
        const words = currentString.split(' ');
        const midPoint = Math.floor(words.length / 2);
        
        // Keep the first half of the words
        currentString = words.slice(0, midPoint).join(' ');
        }
    }

    if (currentString.split(' ').length <= 3) {
        return false;
    }

    return true;
}

/**
 * Detects header and footer text items from PDF text extraction data.
 * @param {Object} pdfData - The JSON object with "items" array
 * @param {number} pageHeight - Height of the page (you may need to infer or pass it)
 * @returns {Object} { headers: [], footers: [], body: [] }
 */
export function detectHeadersAndFooters(pdfData, pageHeight = 842) {
    // If pageHeight is unknown, try to infer from max y + font height
    if (!pageHeight) {
        const maxY = Math.max(...pdfData.items.map(item => item.transform[5] || 0));
        pageHeight = maxY + 50; // rough estimate
    }

    const HEADER_THRESHOLD = 0.85 * pageHeight;
    const FOOTER_THRESHOLD = 0.15 * pageHeight;

    // Helper: Check if string looks like a page number or citation
    function isLikelyFooterText(str) {
        const strTrim = str.trim();
        // Page numbers: "20", "Page 3", "p. 5", "- 3 -"
        const pageNumberPatterns = [
        /^\d+$/, // just a number
        /^Page\s+\d+$/i,
        /^p\.\s*\d+$/i,
        /^-\s*\d+\s*-\s*$/,
        ];
        // Citation patterns: "70.", "71. Author (1999)"
        const citationPattern = /^\d+\.\s*/;

        return (
        pageNumberPatterns.some(p => p.test(strTrim)) ||
        citationPattern.test(strTrim)
        );
    }

    // Keep the same original structure.
    const headers = { items: [] };
    const footers = { items: [] };
    const body = { items: [] };

    for (const item of pdfData.items) {
        const y = item.transform[5]; // y position from bottom
        const fontSize = item.height;

        // Skip empty strings
        if (!item.str.trim()) continue;

        let isHeader = false;
        let isFooter = false;

        // Only a number/single character  → likely header
        if (!isNaN(parseInt(item.str, 10))) {
            isHeader = true;
        }

        if (item.str.length === 1) {
            isHeader = true;
        }

        // Small font + high position → likely header
        if ( (fontSize < 10) && (y > HEADER_THRESHOLD) ) {
            isHeader = true;
        }

        // Small font + low position → likely footer
        if ( (fontSize < 10) &&  (y < FOOTER_THRESHOLD) ) {
            isFooter = true;
        }

        // Content pattern
        if (isLikelyFooterText(item.str)) {
            isFooter = true;
        }

        // Assign
        if (isHeader) {
            headers.items.push(item);
        } else if (isFooter) {
            footers.items.push(item);
        } else {
            body.items.push(item);
        }
    }

    return { headers, footers, body };
}

export function findRepeatedFooters(multiPageItems, pageHeight = 842) {
    const allFooters = multiPageItems.flatMap(page => 
        detectHeadersAndFooters(page, pageHeight).footers.map(item => item.str.trim())
    );

    const freq = {};
    for (const text of allFooters) {
        freq[text] = (freq[text] || 0) + 1;
    }

    // Return texts appearing on > 50% of pages
    const threshold = multiPageItems.length / 2;
    return Object.keys(freq).filter(text => freq[text] > threshold);
}

export async function getAllPdfText(pdf, options={}) {

    const maxPages = pdf.numPages;
    let countPromises = []; // collecting all page promises

    for (var j = 1; j <= maxPages; j++) {

      const page = await pdf.getPage(j);
      const textContent = await page.getTextContent();
      let parsedTextContent = textContent;            
        
        if (options.skipHeadersNFooters && options.canvasHeight) {
            parsedTextContent = detectHeadersAndFooters(textContent, options.canvasHeight);
            countPromises.push(parsedTextContent.body.items.map(function (s) { return s.str; }).join('')); // value page text
        } else {
            countPromises.push(parsedTextContent.items.map(function (s) { return s.str; }).join('')); // value page text
        }

    }

    var parsedOutputText = countPromises.join('').trim();
    return parsedOutputText;
}

export function setBodyFont(prefs) {

    if (!prefs) {
        prefs = JSON.parse(localStorage.getItem('prefs') || '{}');
    }

    const fontStyle = prefs.accessibleFontEnabled ? prefs.accessibleFontStyle : 'Merriweather';
    document.body.style.fontFamily = `${fontStyle}, var(--default-font-family)`;
}