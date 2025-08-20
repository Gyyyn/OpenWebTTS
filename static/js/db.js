const DB_NAME = 'OpenWebTTS';
const DB_VERSION = 1;
const STORE_NAME = 'books';

let db;

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject('IndexedDB error');
        };
    });
}

export async function savePdf(id, pdfData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ id, pdf: pdfData });

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            console.error('Failed to save PDF:', event.target.error);
            reject('Failed to save PDF');
        };
    });
}

export async function loadPdf(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = (event) => {
            if (event.target.result) {
                resolve(event.target.result.pdf);
            } else {
                resolve(null);
            }
        };

        request.onerror = (event) => {
            console.error('Failed to load PDF:', event.target.error);
            reject('Failed to load PDF');
        };
    });
}

export async function deletePdf(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            console.error('Failed to delete PDF:', event.target.error);
            reject('Failed to delete PDF');
        };
    });
}
