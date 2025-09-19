/**
 * -- helpers.js
 * --
 * -- Functions that don't need page context.
 *
 */

export function checkPhraseSimilarity(str1, str2, strictness = 0.85) {
    // Normalize: lowercase, trim, collapse whitespace, remove trailing punctuation
    const normalize = s => s
        .toLowerCase()
        .replace(/\s+/g, ' ')           // collapse whitespace
        .trim()
        .replace(/[!?.,"';:]+$/, '');   // remove trailing punctuation

    const a = normalize(str1);
    const b = normalize(str2);

    // Tokenize by splitting on spaces
    const tokensA = a.split(' ').filter(t => t.length > 0);
    const tokensB = b.split(' ').filter(t => t.length > 0);

    if (tokensA.length === 0 && tokensB.length === 0) return true;
    if (tokensA.length === 0 || tokensB.length === 0) return false;

    // Weight function: emphasize middle (sine curve from 1 to 2 and back to 1)
    const weight = (index, total) => {
        if (total <= 1) return 1;
        const pos = index / (total - 1); // 0 to 1
        return 1 + Math.sin(Math.PI * pos); // peaks at 2 in the middle
    };

    // Assign weights to tokens in A
    const weightedA = tokensA.map((token, i) => ({
        token,
        weight: weight(i, tokensA.length)
    }));

    // Total weight of A (denominator)
    const totalWeightA = weightedA.reduce((sum, item) => sum + item.weight, 0);

    // Compute weighted overlap: for each weighted token in A, if it exists in B, add its weight
    let matchedWeight = 0;
    const setB = new Set(tokensB); // for fast lookup

    for (const { token, weight } of weightedA) {
        if (setB.has(token)) {
        matchedWeight += weight;
        }
    }

    // Similarity ratio: matched weight / total weight of A
    const similarity = matchedWeight / totalWeightA;

    return similarity >= strictness;
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