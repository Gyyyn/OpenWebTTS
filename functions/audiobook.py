import json
import os
import re
import threading
import time
import wave
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Dict, List, Optional, Tuple


CHAPTER_HEADING_RE = re.compile(
    r'^(?:'
    r'(?:chapter|cap[íi]tulo|part|parte|section|se[cç][ãa]o|book|livro)\s+(?:\d+|[ivxlcdm]+)\b[^\n]*'
    r'|#{1,3}\s+[^\n]+'
    r')$',
    re.IGNORECASE | re.MULTILINE,
)


def split_text_into_chunks(text: str, max_chars: int = 800) -> List[str]:
    """Split text into TTS-friendly chunks along paragraph, sentence, and word boundaries."""
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    paragraphs = [p.strip() for p in re.split(r'\n\s*\n+', cleaned) if p.strip()]
    chunks: List[str] = []
    current = ""

    def _flush_current():
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    def _split_long_unit(unit: str) -> List[str]:
        """Split a unit exceeding max_chars by sentences, then words."""
        sentences = [s.strip() for s in re.split(r'(?<=[.!?…])\s+', unit) if s.strip()]
        out: List[str] = []
        buf = ""
        for sent in sentences:
            if len(sent) > max_chars:
                if buf:
                    out.append(buf.strip())
                    buf = ""
                words = sent.split()
                wbuf = ""
                for w in words:
                    if len(wbuf) + len(w) + 1 <= max_chars:
                        wbuf = f"{wbuf} {w}".strip()
                    else:
                        if wbuf:
                            out.append(wbuf)
                        wbuf = w
                if wbuf:
                    out.append(wbuf)
            elif len(buf) + len(sent) + 1 <= max_chars:
                buf = f"{buf} {sent}".strip()
            else:
                if buf:
                    out.append(buf.strip())
                buf = sent
        if buf:
            out.append(buf.strip())
        return out

    for para in paragraphs:
        if len(para) > max_chars:
            _flush_current()
            chunks.extend(_split_long_unit(para))
        elif len(current) + len(para) + 2 <= max_chars:
            current = f"{current}\n\n{para}".strip() if current else para
        else:
            _flush_current()
            current = para

    _flush_current()
    return chunks


def split_into_chapters(
    text: str,
    max_chapter_chars: int = 12000,
    max_chunk_chars: int = 800,
) -> List[Dict]:
    """
    Split a full book text into chapters and TTS chunks.
    Returns a list of dicts: [{"index": 0, "title": "...", "chunks": [...]}]
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    matches = list(CHAPTER_HEADING_RE.finditer(cleaned))
    raw_sections: List[Tuple[str, str]] = []

    if matches:
        # Include any preface/front-matter before the first detected heading
        if matches[0].start() > 0:
            preface = cleaned[:matches[0].start()].strip()
            if preface:
                raw_sections.append(("Introduction", preface))

        for i, match in enumerate(matches):
            title = match.group(0).lstrip('#').strip()
            start = match.end()
            end = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned)
            body = cleaned[start:end].strip()
            section_text = f"{title}.\n\n{body}" if body else title
            raw_sections.append((title[:80], section_text))
    else:
        raw_sections.append(("Part 1", cleaned))

    chapters: List[Dict] = []
    for base_title, section_text in raw_sections:
        chunks = split_text_into_chunks(section_text, max_chars=max_chunk_chars)
        if not chunks:
            continue

        # Sub-split oversized chapters so individual audio files stay manageable
        sub_groups: List[List[str]] = []
        cur_group: List[str] = []
        cur_len = 0
        for ch in chunks:
            if cur_group and cur_len + len(ch) > max_chapter_chars:
                sub_groups.append(cur_group)
                cur_group = [ch]
                cur_len = len(ch)
            else:
                cur_group.append(ch)
                cur_len += len(ch)
        if cur_group:
            sub_groups.append(cur_group)

        for part_idx, group in enumerate(sub_groups):
            if len(sub_groups) == 1:
                title = base_title
            elif base_title.startswith("Part ") and len(raw_sections) == 1:
                title = f"Part {part_idx + 1}"
            else:
                title = f"{base_title} ({part_idx + 1}/{len(sub_groups)})"

            chapters.append({
                "index": len(chapters),
                "title": title,
                "chunks": group,
            })

    return chapters


def concatenate_wav_files(input_paths: List[str], output_path: str) -> float:
    """
    Concatenate WAV files into output_path and return total duration in seconds.
    Uses stdlib wave when parameters match, falling back to pydub for heterogeneous formats.
    """
    valid_paths = [p for p in input_paths if os.path.exists(p) and os.path.getsize(p) > 44]
    if not valid_paths:
        raise ValueError("No valid audio chunks to concatenate.")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    tmp_output = f"{output_path}.tmp.wav"

    try:
        # Fast path: stdlib wave when all chunks share sample rate / channels / sample width
        with wave.open(valid_paths[0], "rb") as first_wav:
            params = first_wav.getparams()
            base_fmt = (params.nchannels, params.sampwidth, params.framerate)

        same_format = True
        for path in valid_paths[1:]:
            with wave.open(path, "rb") as w:
                if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != base_fmt:
                    same_format = False
                    break

        if same_format:
            total_frames = 0
            with wave.open(tmp_output, "wb") as out_wav:
                out_wav.setnchannels(base_fmt[0])
                out_wav.setsampwidth(base_fmt[1])
                out_wav.setframerate(base_fmt[2])
                for path in valid_paths:
                    with wave.open(path, "rb") as in_wav:
                        frames = in_wav.readframes(in_wav.getnframes())
                        out_wav.writeframes(frames)
                        total_frames += in_wav.getnframes()
            os.replace(tmp_output, output_path)
            return round(total_frames / float(base_fmt[2]), 2) if base_fmt[2] else 0.0

        # Fallback: pydub handles resampling / channel normalization
        from pydub import AudioSegment
        combined = AudioSegment.empty()
        for path in valid_paths:
            combined += AudioSegment.from_file(path)
        combined.export(tmp_output, format="wav")
        os.replace(tmp_output, output_path)
        return round(len(combined) / 1000.0, 2)
    except Exception:
        if os.path.exists(tmp_output):
            try:
                os.unlink(tmp_output)
            except OSError:
                pass
        raise


class AudiobookWorker:
    """Background single-worker queue for resumable, chunked audiobook synthesis."""

    def __init__(
        self,
        audio_cache_dir: str,
        user_manager,
        synthesize_fn: Callable[[dict, str], None],
    ):
        self.audio_cache_dir = audio_cache_dir
        self.user_manager = user_manager
        self.synthesize_fn = synthesize_fn
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="audiobook-worker")
        self._lock = threading.Lock()
        self._pause_flags: Dict[Tuple[str, str], threading.Event] = {}
        self._active_jobs: Dict[Tuple[str, str], bool] = {}

    def get_podcast_dir(self, podcast_id: str) -> str:
        return os.path.join(self.audio_cache_dir, "podcasts", podcast_id)

    def get_manifest_path(self, podcast_id: str) -> str:
        return os.path.join(self.get_podcast_dir(podcast_id), "manifest.json")

    def save_manifest(self, podcast_id: str, manifest: dict) -> None:
        podcast_dir = self.get_podcast_dir(podcast_id)
        os.makedirs(podcast_dir, exist_ok=True)
        manifest_path = self.get_manifest_path(podcast_id)
        tmp_path = f"{manifest_path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
        os.replace(tmp_path, manifest_path)

    def load_manifest(self, podcast_id: str) -> Optional[dict]:
        manifest_path = self.get_manifest_path(podcast_id)
        if not os.path.exists(manifest_path):
            return None
        with open(manifest_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def is_job_active(self, username: str, podcast_id: str) -> bool:
        with self._lock:
            return self._active_jobs.get((username, podcast_id), False)

    def request_pause(self, username: str, podcast_id: str) -> bool:
        key = (username, podcast_id)
        with self._lock:
            flag = self._pause_flags.get(key)
            if flag is not None:
                flag.set()
                return True
            return False

    def enqueue(self, username: str, podcast_id: str) -> bool:
        key = (username, podcast_id)
        with self._lock:
            if self._active_jobs.get(key):
                return False
            pause_event = threading.Event()
            self._pause_flags[key] = pause_event
            self._active_jobs[key] = True

        self._executor.submit(self._run_job, username, podcast_id, pause_event)
        return True

    def _run_job(self, username: str, podcast_id: str, pause_event: threading.Event) -> None:
        key = (username, podcast_id)
        try:
            manifest = self.load_manifest(podcast_id)
            if not manifest:
                raise RuntimeError("Audiobook manifest not found.")

            chapters = manifest.get("chapters", [])
            total_chunks = sum(len(ch.get("chunks", [])) for ch in chapters)
            if total_chunks == 0:
                raise RuntimeError("Audiobook has no text chunks to synthesize.")

            podcast_dir = self.get_podcast_dir(podcast_id)
            chunks_dir = os.path.join(podcast_dir, "chunks")
            os.makedirs(chunks_dir, exist_ok=True)

            self.user_manager.update_podcast(username, podcast_id, {
                "status": "generating",
                "error": None,
            })

            completed_chunks = 0
            chapter_summaries: List[dict] = []

            # Count already-completed chunks up front for accurate resume progress
            for ch in chapters:
                ch_idx = ch["index"]
                ch_chunks = ch.get("chunks", [])
                ch_done = 0
                for ck_idx in range(len(ch_chunks)):
                    ck_path = os.path.join(chunks_dir, f"ch_{ch_idx:03d}_ck_{ck_idx:04d}.wav")
                    if os.path.exists(ck_path) and os.path.getsize(ck_path) > 44:
                        ch_done += 1
                completed_chunks += ch_done
                ch_out_path = os.path.join(podcast_dir, f"chapter_{ch_idx:03d}.wav")
                ch_ready = os.path.exists(ch_out_path) and os.path.getsize(ch_out_path) > 44
                chapter_summaries.append({
                    "index": ch_idx,
                    "title": ch["title"],
                    "status": "ready" if ch_ready else "pending",
                    "audio_url": f"/static/audio_cache/podcasts/{podcast_id}/chapter_{ch_idx:03d}.wav" if ch_ready else None,
                    "duration_sec": ch.get("duration_sec", 0.0),
                    "chunks_total": len(ch_chunks),
                    "chunks_done": ch_done,
                })

            for ch in chapters:
                ch_idx = ch["index"]
                ch_chunks = ch.get("chunks", [])
                ch_chunk_paths: List[str] = []

                if pause_event.is_set():
                    self.user_manager.update_podcast(username, podcast_id, {
                        "status": "paused",
                        "chapters": chapter_summaries,
                        "progress": {
                            "completed_chunks": completed_chunks,
                            "total_chunks": total_chunks,
                            "percent": round((completed_chunks / total_chunks) * 100, 1),
                            "current_chapter": ch_idx + 1,
                            "total_chapters": len(chapters),
                            "current_chapter_title": ch["title"],
                        },
                    })
                    return

                chapter_summaries[ch_idx]["status"] = "generating"

                for ck_idx, chunk_text in enumerate(ch_chunks):
                    if pause_event.is_set():
                        self.user_manager.update_podcast(username, podcast_id, {
                            "status": "paused",
                            "chapters": chapter_summaries,
                            "progress": {
                                "completed_chunks": completed_chunks,
                                "total_chunks": total_chunks,
                                "percent": round((completed_chunks / total_chunks) * 100, 1),
                                "current_chapter": ch_idx + 1,
                                "total_chapters": len(chapters),
                                "current_chapter_title": ch["title"],
                            },
                        })
                        return

                    ck_path = os.path.join(chunks_dir, f"ch_{ch_idx:03d}_ck_{ck_idx:04d}.wav")
                    ch_chunk_paths.append(ck_path)

                    if not (os.path.exists(ck_path) and os.path.getsize(ck_path) > 44):
                        tmp_ck_path = os.path.join(chunks_dir, f"ch_{ch_idx:03d}_ck_{ck_idx:04d}.tmp.wav")
                        req_payload = {
                            "engine": manifest["engine"],
                            "voice": manifest["voice"],
                            "lang": manifest.get("lang") or "en",
                            "text": chunk_text,
                            "api_key": manifest.get("api_key"),
                        }
                        self.synthesize_fn(req_payload, tmp_ck_path)
                        if os.path.exists(tmp_ck_path):
                            os.replace(tmp_ck_path, ck_path)
                        completed_chunks += 1
                        chapter_summaries[ch_idx]["chunks_done"] += 1

                    self.user_manager.update_podcast(username, podcast_id, {
                        "chapters": chapter_summaries,
                        "progress": {
                            "completed_chunks": completed_chunks,
                            "total_chunks": total_chunks,
                            "percent": round((completed_chunks / total_chunks) * 100, 1),
                            "current_chapter": ch_idx + 1,
                            "total_chapters": len(chapters),
                            "current_chapter_title": ch["title"],
                        },
                    })

                # Assemble chapter WAV
                ch_out_path = os.path.join(podcast_dir, f"chapter_{ch_idx:03d}.wav")
                if not (os.path.exists(ch_out_path) and os.path.getsize(ch_out_path) > 44):
                    duration_sec = concatenate_wav_files(ch_chunk_paths, ch_out_path)
                else:
                    duration_sec = chapter_summaries[ch_idx].get("duration_sec", 0.0)

                ch_url = f"/static/audio_cache/podcasts/{podcast_id}/chapter_{ch_idx:03d}.wav"
                chapter_summaries[ch_idx]["status"] = "ready"
                chapter_summaries[ch_idx]["audio_url"] = ch_url
                chapter_summaries[ch_idx]["duration_sec"] = duration_sec
                ch["duration_sec"] = duration_sec
                self.save_manifest(podcast_id, manifest)

            first_audio_url = chapter_summaries[0]["audio_url"] if chapter_summaries else None
            total_duration = round(sum(c.get("duration_sec", 0.0) for c in chapter_summaries), 2)

            self.user_manager.update_podcast(username, podcast_id, {
                "status": "ready",
                "audio_url": first_audio_url,
                "duration_sec": total_duration,
                "chapters": chapter_summaries,
                "progress": {
                    "completed_chunks": total_chunks,
                    "total_chunks": total_chunks,
                    "percent": 100.0,
                    "current_chapter": len(chapters),
                    "total_chapters": len(chapters),
                    "current_chapter_title": chapters[-1]["title"] if chapters else "",
                },
                "updated_at": time.time(),
            })
        except Exception as e:
            print(f"Error generating audiobook {username}/{podcast_id}: {e}")
            self.user_manager.update_podcast(username, podcast_id, {
                "status": "failed",
                "error": str(e),
            })
        finally:
            with self._lock:
                self._active_jobs.pop(key, None)
                self._pause_flags.pop(key, None)


def recover_interrupted_jobs(users_dir: str, user_manager) -> int:
    """Mark any in-progress audiobook jobs as paused after a server restart."""
    if not os.path.exists(users_dir):
        return 0

    recovered = 0
    for entry in os.listdir(users_dir):
        user_file = os.path.join(users_dir, entry, "user_data.json")
        if not os.path.isfile(user_file):
            continue
        try:
            with open(user_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            username = data.get("username")
            podcasts = data.get("podcasts", {})
            if not username or not isinstance(podcasts, dict):
                continue
            for pid, pdata in podcasts.items():
                if pdata.get("status") in ("generating", "queued"):
                    user_manager.update_podcast(username, pid, {
                        "status": "paused",
                        "error": "Interrupted by server restart. Click Resume to continue.",
                    })
                    recovered += 1
        except Exception as e:
            print(f"Failed to recover audiobook state from {user_file}: {e}")
    return recovered
