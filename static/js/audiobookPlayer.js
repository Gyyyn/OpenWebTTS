import { getPodcastDownloadUrl, savePodcastProgress, sendPodcastProgressBeacon } from './podcast.js';

const STORAGE_PREFIX = 'audiobook-progress-';
const SAVE_INTERVAL_MS = 5000;

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
        return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function getSavedAudiobookProgress(podcast) {
    let local = null;
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${podcast.id}`);
        if (raw) local = JSON.parse(raw);
    } catch {
        local = null;
    }

    const remote = podcast?.listening_progress || null;
    if (local && remote) {
        return (local.last_played_at || 0) >= (remote.last_played_at || 0) ? local : remote;
    }
    return remote || local || null;
}

class AudiobookPlayer {
    constructor() {
        this.audio = new Audio();
        this.audio.preload = 'metadata';

        this.appState = null;
        this.podcast = null;
        this.chapters = [];
        this.chapterIndex = 0;
        this.pendingSeekSec = 0;
        this.playbackRate = 1.0;
        this.lastSavedAt = 0;
        this.initialized = false;
    }

    isPlaying() {
        return Boolean(this.audio && !this.audio.paused);
    }

    pause() {
        if (this.audio && !this.audio.paused) {
            this.audio.pause();
        }
    }

    init(appState) {
        this.appState = appState;
        if (this.initialized) return;
        this.initialized = true;

        this.bar = document.getElementById('audiobook-player-bar');
        this.titleEl = document.getElementById('ab-player-title');
        this.chapterLabelEl = document.getElementById('ab-player-chapter');
        this.playPauseBtn = document.getElementById('ab-play-pause-btn');
        this.back15Btn = document.getElementById('ab-back-15-btn');
        this.fwd30Btn = document.getElementById('ab-fwd-30-btn');
        this.prevChBtn = document.getElementById('ab-prev-ch-btn');
        this.nextChBtn = document.getElementById('ab-next-ch-btn');
        this.seekSlider = document.getElementById('ab-seek-slider');
        this.timeCurrentEl = document.getElementById('ab-time-current');
        this.timeTotalEl = document.getElementById('ab-time-total');
        this.speedSelect = document.getElementById('ab-speed-select');
        this.chaptersBtn = document.getElementById('ab-chapters-btn');
        this.chaptersPopover = document.getElementById('ab-chapters-popover');
        this.chaptersList = document.getElementById('ab-chapters-list');
        this.sleepBtn = document.getElementById('ab-sleep-btn');
        this.downloadBtn = document.getElementById('ab-download-btn');
        this.closeBtn = document.getElementById('ab-close-btn');

        if (!this.bar) return;

        this.playPauseBtn?.addEventListener('click', () => this.togglePlay());
        this.back15Btn?.addEventListener('click', () => this.seekRelative(-15));
        this.fwd30Btn?.addEventListener('click', () => this.seekRelative(30));
        this.prevChBtn?.addEventListener('click', () => this.loadChapter(this.chapterIndex - 1, true, 0));
        this.nextChBtn?.addEventListener('click', () => this.loadChapter(this.chapterIndex + 1, true, 0));

        this.seekSlider?.addEventListener('input', () => {
            if (!Number.isFinite(this.audio.duration)) return;
            const target = (Number(this.seekSlider.value) / 100) * this.audio.duration;
            this.audio.currentTime = target;
            if (this.timeCurrentEl) this.timeCurrentEl.textContent = formatTime(target);
        });

        this.seekSlider?.addEventListener('change', () => this.persistProgress(true));

        this.speedSelect?.addEventListener('change', () => {
            const rate = parseFloat(this.speedSelect.value) || 1.0;
            this.playbackRate = rate;
            this.audio.playbackRate = rate;
            this.persistProgress(true);
        });

        this.chaptersBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.chaptersPopover?.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (
                this.chaptersPopover &&
                !this.chaptersPopover.classList.contains('hidden') &&
                !this.chaptersPopover.contains(e.target) &&
                !this.chaptersBtn?.contains(e.target)
            ) {
                this.chaptersPopover.classList.add('hidden');
            }
        });

        this.sleepBtn?.addEventListener('click', () => {
            this.appState?.functions?.openSleepTimerModal?.();
        });

        this.downloadBtn?.addEventListener('click', () => {
            const username = this.appState?.variables?.currentUser;
            if (!username || !this.podcast) return;
            window.open(getPodcastDownloadUrl(username, this.podcast.id), '_blank');
        });

        this.closeBtn?.addEventListener('click', () => {
            this.audio.pause();
            this.persistProgress(true);
            this.bar.classList.add('hidden');
            this.chaptersPopover?.classList.add('hidden');
            if (!this.appState?.variables?.isPlaying) {
                this.appState?.functions?.clearSleepTimer?.();
            }
        });

        this.audio.addEventListener('loadedmetadata', () => {
            if (this.pendingSeekSec > 0 && Number.isFinite(this.audio.duration)) {
                this.audio.currentTime = Math.min(this.pendingSeekSec, Math.max(0, this.audio.duration - 1));
                this.pendingSeekSec = 0;
            }
            this.audio.playbackRate = this.playbackRate;
            this.updateTimeUI();
        });

        this.audio.addEventListener('timeupdate', () => {
            this.updateTimeUI();
            if (Date.now() - this.lastSavedAt >= SAVE_INTERVAL_MS) {
                this.persistProgress(false);
            }
        });

        this.audio.addEventListener('play', () => {
            this.updatePlayPauseIcon();
            this.appState?.functions?.startActiveSleepTimer?.();
        });
        this.audio.addEventListener('pause', () => {
            this.updatePlayPauseIcon();
            this.persistProgress(true);
        });

        this.audio.addEventListener('ended', () => {
            if (this.chapterIndex + 1 < this.chapters.length) {
                this.loadChapter(this.chapterIndex + 1, true, 0);
            } else {
                this.updatePlayPauseIcon();
                this.persistProgress(true, true);
                this.appState?.functions?.showNotification?.(`Finished '${this.podcast?.title}'!`, 'success');
            }
        });

        window.addEventListener('beforeunload', () => {
            if (!this.podcast) return;
            const username = this.appState?.variables?.currentUser;
            if (!username) return;
            const payload = this.buildProgressPayload(false);
            this.saveLocalProgress(payload);
            sendPodcastProgressBeacon(username, this.podcast.id, payload);
        });
    }

    open(podcast, autoPlay = true) {
        if (!podcast) return;
        this.podcast = podcast;

        const readyChapters = (podcast.chapters || []).filter(ch => ch.audio_url);
        this.chapters = readyChapters.length > 0
            ? readyChapters
            : (podcast.audio_url ? [{ index: 0, title: podcast.title, audio_url: podcast.audio_url, duration_sec: podcast.duration_sec || 0 }] : []);

        if (this.chapters.length === 0) {
            this.appState?.functions?.showNotification?.('No audio chapters are ready yet.', 'warning');
            return;
        }

        const saved = getSavedAudiobookProgress(podcast);
        const startIdx = saved && Number.isInteger(saved.chapter_index)
            ? Math.max(0, Math.min(saved.chapter_index, this.chapters.length - 1))
            : 0;
        const startPos = saved && typeof saved.position_sec === 'number' ? saved.position_sec : 0;
        this.playbackRate = saved && typeof saved.playback_rate === 'number' ? saved.playback_rate : 1.0;

        if (this.speedSelect) this.speedSelect.value = String(this.playbackRate);
        if (this.titleEl) this.titleEl.textContent = podcast.title;

        this.bar?.classList.remove('hidden');
        this.renderChaptersList();
        this.loadChapter(startIdx, autoPlay, startPos);
    }

    loadChapter(idx, autoPlay = true, seekSec = 0) {
        if (idx < 0 || idx >= this.chapters.length) return;

        // Pause other inline <audio> elements
        document.querySelectorAll('audio').forEach(el => {
            if (el !== this.audio && !el.paused) el.pause();
        });

        this.chapterIndex = idx;
        const ch = this.chapters[idx];
        this.pendingSeekSec = seekSec || 0;
        this.audio.src = ch.audio_url;
        this.audio.playbackRate = this.playbackRate;

        if (this.chapterLabelEl) {
            this.chapterLabelEl.textContent = this.chapters.length > 1
                ? `${ch.title} (${idx + 1}/${this.chapters.length})`
                : ch.title;
        }

        if (this.prevChBtn) this.prevChBtn.disabled = idx === 0;
        if (this.nextChBtn) this.nextChBtn.disabled = idx >= this.chapters.length - 1;

        this.renderChaptersList();
        this.updateMediaSession();

        if (autoPlay) {
            this.audio.play().catch(() => {});
        }
        this.persistProgress(true);
    }

    togglePlay() {
        if (this.audio.paused) {
            this.audio.play().catch(() => {});
        } else {
            this.audio.pause();
        }
    }

    seekRelative(deltaSec) {
        if (!Number.isFinite(this.audio.duration)) return;
        const next = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + deltaSec));
        this.audio.currentTime = next;
        this.updateTimeUI();
        this.persistProgress(true);
    }

    updatePlayPauseIcon() {
        if (!this.playPauseBtn) return;
        this.playPauseBtn.innerHTML = this.audio.paused
            ? '<i class="fas fa-play"></i>'
            : '<i class="fas fa-pause"></i>';
    }

    updateTimeUI() {
        const cur = this.audio.currentTime || 0;
        const dur = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
        if (this.seekSlider) {
            this.seekSlider.value = dur > 0 ? String((cur / dur) * 100) : '0';
        }
        if (this.timeCurrentEl) this.timeCurrentEl.textContent = formatTime(cur);
        if (this.timeTotalEl) this.timeTotalEl.textContent = formatTime(dur);
    }

    renderChaptersList() {
        if (!this.chaptersList) return;
        this.chaptersList.innerHTML = '';
        this.chapters.forEach((ch, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isActive = idx === this.chapterIndex;
            btn.className = `w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                isActive
                    ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 font-semibold'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
            }`;
            const titleSpan = document.createElement('span');
            titleSpan.className = 'truncate pr-2';
            titleSpan.textContent = `${idx + 1}. ${ch.title}`;

            const durSpan = document.createElement('span');
            durSpan.className = 'text-[11px] text-gray-500 dark:text-gray-400 shrink-0';
            durSpan.textContent = ch.duration_sec ? formatTime(ch.duration_sec) : '';

            btn.appendChild(titleSpan);
            btn.appendChild(durSpan);
            btn.addEventListener('click', () => {
                this.loadChapter(idx, true, 0);
                this.chaptersPopover?.classList.add('hidden');
            });
            this.chaptersList.appendChild(btn);
        });
    }

    buildProgressPayload(completed = false) {
        return {
            chapter_index: this.chapterIndex,
            position_sec: Math.round((this.audio.currentTime || 0) * 10) / 10,
            duration_sec: Number.isFinite(this.audio.duration) ? Math.round(this.audio.duration * 10) / 10 : null,
            playback_rate: this.playbackRate,
            completed: Boolean(completed),
            last_played_at: Date.now() / 1000,
        };
    }

    saveLocalProgress(payload) {
        if (!this.podcast) return;
        try {
            localStorage.setItem(`${STORAGE_PREFIX}${this.podcast.id}`, JSON.stringify(payload));
        } catch {
            // Ignore quota errors
        }
        this.podcast.listening_progress = payload;
    }

    async persistProgress(force = false, completed = false) {
        if (!this.podcast) return;
        if (!force && Date.now() - this.lastSavedAt < SAVE_INTERVAL_MS) return;

        this.lastSavedAt = Date.now();
        const payload = this.buildProgressPayload(completed);
        this.saveLocalProgress(payload);

        const username = this.appState?.variables?.currentUser;
        if (username) {
            await savePodcastProgress(username, this.podcast.id, payload);
        }
    }

    updateMediaSession() {
        if (!('mediaSession' in navigator) || !this.podcast) return;
        const ch = this.chapters[this.chapterIndex];
        navigator.mediaSession.metadata = new MediaMetadata({
            title: ch?.title || this.podcast.title,
            album: this.podcast.title,
            artist: 'OpenWebTTS Audiobook',
        });
        navigator.mediaSession.setActionHandler('play', () => this.audio.play());
        navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
        navigator.mediaSession.setActionHandler('seekbackward', () => this.seekRelative(-15));
        navigator.mediaSession.setActionHandler('seekforward', () => this.seekRelative(30));
        navigator.mediaSession.setActionHandler('previoustrack', () => this.loadChapter(this.chapterIndex - 1, true, 0));
        navigator.mediaSession.setActionHandler('nexttrack', () => this.loadChapter(this.chapterIndex + 1, true, 0));
    }
}

export const audiobookPlayer = new AudiobookPlayer();
