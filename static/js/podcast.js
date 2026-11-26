export async function generatePodcast(username, title, text, lang, engine, voice, api_key = null) {
    try {
        const response = await fetch(`/api/users/${username}/podcast`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                text,
                engine,
                lang,
                voice,
                api_key
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to generate audiobook.');
        }

        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Error generating audiobook:', error);
        return { success: false, error: error.message };
    }
}

export async function getPodcasts(username) {
    try {
        const response = await fetch(`/api/users/${username}/podcasts`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch audiobooks.');
        }
        const data = await response.json();
        return { success: true, podcasts: data.podcasts };
    } catch (error) {
        console.error('Error fetching audiobooks:', error);
        return { success: false, error: error.message };
    }
}

export async function deletePodcast(username, podcastId) {
    try {
        const response = await fetch(`/api/users/${username}/podcasts/${podcastId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete audiobook.');
        }

        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Error deleting audiobook:', error);
        return { success: false, error: error.message };
    }
}

export async function getPodcastStatus(username, podcastId) {
    try {
        const response = await fetch(`/api/users/${username}/podcasts/${podcastId}/status`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch audiobook status.');
        }
        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Error fetching audiobook status:', error);
        return { success: false, error: error.message };
    }
}

export async function pausePodcast(username, podcastId) {
    try {
        const response = await fetch(`/api/users/${username}/podcasts/${podcastId}/pause`, {
            method: 'POST',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to pause audiobook.');
        }
        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Error pausing audiobook:', error);
        return { success: false, error: error.message };
    }
}

export async function retryPodcast(username, podcastId) {
    try {
        const response = await fetch(`/api/users/${username}/podcasts/${podcastId}/retry`, {
            method: 'POST',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to resume audiobook.');
        }
        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Error resuming audiobook:', error);
        return { success: false, error: error.message };
    }
}

export async function compressPodcast(username, podcastId) {
    try {
        const response = await fetch(`/api/users/${username}/podcasts/${podcastId}/compress`, {
            method: 'POST',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to compress audiobook.');
        }
        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Error compressing audiobook:', error);
        return { success: false, error: error.message };
    }
}

export function getPodcastDownloadUrl(username, podcastId) {
    return `/api/users/${username}/podcasts/${podcastId}/download`;
}

export async function savePodcastProgress(username, podcastId, progressData) {
    try {
        const response = await fetch(`/api/users/${username}/podcasts/${podcastId}/progress`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(progressData),
        });
        if (!response.ok) return { success: false };
        return { success: true };
    } catch {
        return { success: false };
    }
}

export function sendPodcastProgressBeacon(username, podcastId, progressData) {
    if (!navigator.sendBeacon) return;
    try {
        const blob = new Blob([JSON.stringify(progressData)], { type: 'application/json' });
        navigator.sendBeacon(`/api/users/${username}/podcasts/${podcastId}/progress`, blob);
    } catch {
        // Ignore beacon errors on unload
    }
}