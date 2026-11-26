import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import tempfile
import threading
import time
import uuid
from typing import Dict, Optional, Tuple
from bcrypt import hashpw, gensalt, checkpw

class UserManager:
    def __init__(self, users_dir: str, secret_key: Optional[str] = None):
        self.users_dir = users_dir
        self.secret_key = secret_key or "default-openwebtts-secret-key"
        self._revoked_tokens = set()
        self._lock = threading.RLock()
        os.makedirs(users_dir, exist_ok=True)

    def _get_user_folder(self, username: str, create: bool = False) -> str:
        user_hash = hashlib.sha256(username.encode('utf-8')).hexdigest()
        user_folder = os.path.join(self.users_dir, user_hash)
        if create:
            os.makedirs(user_folder, exist_ok=True)
        return user_folder

    def _get_user_file_path(self, username: str, create: bool = False) -> str:
        user_folder = self._get_user_folder(username, create=create)
        return os.path.join(user_folder, "user_data.json")

    def user_exists(self, username: str) -> bool:
        if not username or not isinstance(username, str):
            return False
        user_file = self._get_user_file_path(username, create=False)
        return os.path.exists(user_file)

    def validate_username(self, username: str) -> Tuple[bool, str]:
        if not username or not isinstance(username, str):
            return False, "Username cannot be empty."
        username = username.strip()
        if len(username) < 1 or len(username) > 64:
            return False, "Username must be between 1 and 64 characters."
        if not re.match(r'^[a-zA-Z0-9_\-\.@+]+$', username):
            return False, "Username contains invalid characters."
        return True, ""

    def save_pdf_to_user_folder(self, username: str, filename: str, pdf_content: bytes) -> str:
        if not self.user_exists(username):
            raise ValueError("User not found.")

        user_folder = os.path.abspath(self._get_user_folder(username, create=True))
        sanitized_filename = os.path.basename(filename)
        if not sanitized_filename or sanitized_filename in ('.', '..'):
            raise ValueError("Invalid filename.")

        pdf_path = os.path.abspath(os.path.join(user_folder, sanitized_filename))
        if not pdf_path.startswith(user_folder + os.sep):
            raise ValueError("Path traversal detected.")

        with open(pdf_path, "wb") as f:
            f.write(pdf_content)

        return pdf_path

    def create_user(self, username: str, password: str) -> Tuple[bool, str]:
        is_valid, err_msg = self.validate_username(username)
        if not is_valid:
            return False, err_msg

        username = username.strip()
        if not password or len(password) < 1:
            return False, "Password cannot be empty."

        with self._lock:
            user_file = self._get_user_file_path(username, create=False)
            if os.path.exists(user_file):
                return False, "Username already exists."

            # Only create directory when user actually doesn't exist yet
            user_file = self._get_user_file_path(username, create=True)
            hashed_password = hashpw(password.encode('utf-8'), gensalt()).decode('utf-8')
            user_data = {
                "username": username,
                "password": hashed_password,
                "books": {},
                "podcasts": {}
            }
            self.save_user_data(username, user_data)
            return True, "User created successfully."

    def authenticate_user(self, username: str, password: str) -> Tuple[bool, any]:
        if not username or not isinstance(username, str) or not password:
            return False, "Invalid username or password."

        username = username.strip()
        user_file = self._get_user_file_path(username, create=False)
        if not os.path.exists(user_file):
            return False, "Invalid username or password."

        try:
            with open(user_file, 'r', encoding='utf-8') as f:
                user_data = json.load(f)

            if checkpw(password.encode('utf-8'), user_data['password'].encode('utf-8')):
                return True, user_data
            else:
                return False, "Invalid username or password."
        except Exception:
            return False, "Invalid username or password."

    def get_user_data(self, username: str) -> Optional[dict]:
        if not username:
            return None
        with self._lock:
            user_file = self._get_user_file_path(username, create=False)
            if os.path.exists(user_file):
                with open(user_file, 'r', encoding='utf-8') as f:
                    user_data = json.load(f)

                # Migration: Convert books from list to dict if necessary.
                if isinstance(user_data.get('books'), list):
                    print(f"Migrating books to new format for user: {username}")
                    old_books = user_data.get('books', [])
                    user_data['books'] = {str(uuid.uuid4()): book for book in old_books}
                    self.save_user_data(username, user_data)

                return user_data
            return None

    def save_user_data(self, username: str, data: dict):
        with self._lock:
            user_folder = self._get_user_folder(username, create=True)
            user_file = os.path.join(user_folder, "user_data.json")
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(
                    mode='w',
                    encoding='utf-8',
                    dir=user_folder,
                    delete=False,
                    prefix='.user_data_',
                    suffix='.tmp'
                ) as tmp_f:
                    tmp_path = tmp_f.name
                    json.dump(data, tmp_f, indent=4)
                    tmp_f.flush()
                    os.fsync(tmp_f.fileno())
                os.replace(tmp_path, user_file)
            except Exception:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.unlink(tmp_path)
                    except OSError:
                        pass
                raise

    def add_book(self, username: str, book_data: dict) -> Tuple[bool, Optional[str]]:
        with self._lock:
            user_data = self.get_user_data(username)
            if user_data:
                book_id = str(uuid.uuid4())
                user_data.setdefault('books', {})[book_id] = book_data
                self.save_user_data(username, user_data)
                return True, book_id
            return False, None

    def get_books(self, username: str) -> list:
        user_data = self.get_user_data(username)
        if user_data:
            books_data = user_data.get('books', {})
            return [{**book_data, 'id': book_id} for book_id, book_data in books_data.items()]
        return []

    def get_podcasts(self, username: str) -> list:
        user_data = self.get_user_data(username)
        if user_data:
            podcasts_data = user_data.get('podcasts', {})
            return [{**podcast_data, 'id': podcast_id} for podcast_id, podcast_data in podcasts_data.items()]
        return []

    def get_pdf_books(self, username: str) -> list:
        user_data = self.get_user_data(username)
        if user_data:
            books_data = user_data.get('books', {})
            pdf_books = []
            for book_id, book_data in books_data.items():
                if book_data.get('is_pdf') is True:
                    pdf_books.append({**book_data, 'id': book_id})
            return pdf_books
        return []

    def delete_book(self, username: str, book_id: str) -> bool:
        with self._lock:
            user_data = self.get_user_data(username)
            if user_data and book_id in user_data.get('books', {}):
                del user_data['books'][book_id]
                self.save_user_data(username, user_data)
                return True
            return False

    def edit_book(self, username: str, book_id: str, new_data: dict) -> bool:
        with self._lock:
            user_data = self.get_user_data(username)
            if user_data and book_id in user_data.get('books', {}):
                user_data['books'][book_id].update(new_data)
                self.save_user_data(username, user_data)
                return True
            return False

    def delete_podcast(self, username: str, podcast_id: str) -> bool:
        with self._lock:
            user_data = self.get_user_data(username)
            if user_data and podcast_id in user_data.get('podcasts', {}):
                del user_data['podcasts'][podcast_id]
                self.save_user_data(username, user_data)
                return True
            return False

    def add_podcast(self, username: str, podcast_data: dict) -> Tuple[bool, Optional[str]]:
        with self._lock:
            user_data = self.get_user_data(username)
            if user_data:
                podcast_id = str(uuid.uuid4())
                user_data.setdefault('podcasts', {})[podcast_id] = podcast_data
                self.save_user_data(username, user_data)
                return True, podcast_id
            return False, None

    def update_podcast(self, username: str, podcast_id: str, new_data: dict) -> bool:
        with self._lock:
            user_data = self.get_user_data(username)
            if user_data and podcast_id in user_data.get('podcasts', {}):
                user_data['podcasts'][podcast_id].update(new_data)
                self.save_user_data(username, user_data)
                return True
            return False

    def create_session(self, username: str, expires_in_seconds: int = 7 * 86400) -> str:
        issued_at = int(time.time())
        expires_at = issued_at + expires_in_seconds
        nonce = secrets.token_hex(8)
        payload_data = f"{username}:{issued_at}:{expires_at}:{nonce}"
        signature = hmac.new(
            self.secret_key.encode('utf-8'),
            payload_data.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        raw = f"{payload_data}:{signature}"
        return base64.urlsafe_b64encode(raw.encode('utf-8')).decode('utf-8')

    def verify_session(self, token: str) -> Optional[str]:
        if not token or token in self._revoked_tokens:
            return None
        try:
            raw = base64.urlsafe_b64decode(token.encode('utf-8')).decode('utf-8')
            parts = raw.split(":")
            if len(parts) != 5:
                return None
            username, issued_at_str, expires_at_str, nonce, signature = parts
            expires_at = int(expires_at_str)
            if time.time() > expires_at:
                return None
            payload_data = f"{username}:{issued_at_str}:{expires_at_str}:{nonce}"
            expected_sig = hmac.new(
                self.secret_key.encode('utf-8'),
                payload_data.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(signature, expected_sig):
                return None
            return username
        except Exception:
            return None

    def revoke_session(self, token: str) -> bool:
        if token:
            self._revoked_tokens.add(token)
            return True
        return False
