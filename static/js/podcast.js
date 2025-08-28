import { generateSpeech } from "./speechGen.js";

export async function generatePodcast(username, title, text, engine, voice, api_key = null) {
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
                voice,
                api_key
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to generate podcast.');
        }

        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Error generating podcast:', error);
        return { success: false, error: error.message };
    }
}

export async function getPodcasts(username) {
    try {
        const response = await fetch(`/api/users/${username}/podcasts`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch podcasts.');
        }
        const data = await response.json();
        return { success: true, podcasts: data.podcasts };
    } catch (error) {
        console.error('Error fetching podcasts:', error);
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
            throw new Error(errorData.detail || 'Failed to delete podcast.');
        }

        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Error deleting podcast:', error);
        return { success: false, error: error.message };
    }
}

export function getPodcastById(params) {
    
}