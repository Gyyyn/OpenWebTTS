import json
import os
import uuid
from bcrypt import hashpw, gensalt, checkpw

class UserManager:
    def __init__(self, users_dir):
        self.users_dir = users_dir
        os.makedirs(users_dir, exist_ok=True)

    def _get_user_file_path(self, username):
        return os.path.join(self.users_dir, f"{username}.json")

    def create_user(self, username, password):
        user_file = self._get_user_file_path(username)
        if os.path.exists(user_file):
            return False, "Username already exists."

        hashed_password = hashpw(password.encode('utf-8'), gensalt()).decode('utf-8')
        user_data = {
            "username": username,
            "password": hashed_password,
            "books": {},
            "podcasts": {}
        }
        with open(user_file, 'w') as f:
            json.dump(user_data, f, indent=4)
        return True, "User created successfully."

    def authenticate_user(self, username, password):
        user_file = self._get_user_file_path(username)
        if not os.path.exists(user_file):
            return False, "Invalid username or password."

        with open(user_file, 'r') as f:
            user_data = json.load(f)

        if checkpw(password.encode('utf-8'), user_data['password'].encode('utf-8')):
            return True, user_data
        else:
            return False, "Invalid username or password."

    def get_user_data(self, username):
        user_file = self._get_user_file_path(username)
        if os.path.exists(user_file):
            with open(user_file, 'r') as f:
                user_data = json.load(f)
            
            # Migration: Convert books from list to dict if necessary.
            if isinstance(user_data.get('books'), list):
                print(f"Migrating books to new format for user: {username}")
                old_books = user_data.get('books', [])
                user_data['books'] = {str(uuid.uuid4()): book for book in old_books}
                self.save_user_data(username, user_data)

            return user_data
        return None

    def save_user_data(self, username, data):
        user_file = self._get_user_file_path(username)
        with open(user_file, 'w') as f:
            json.dump(data, f, indent=4)

    def add_book(self, username, book_data):
        user_data = self.get_user_data(username) # This ensures data is migrated and correct.
        if user_data:
            book_id = str(uuid.uuid4())
            # 'books' is guaranteed to be a dict here by get_user_data
            user_data.setdefault('books', {})[book_id] = book_data
            self.save_user_data(username, user_data)
            return True, book_id
        return False, None

    def get_books(self, username):
        user_data = self.get_user_data(username) # This ensures data is migrated and correct.
        if user_data:
            books_data = user_data.get('books', {})
            # 'books' is guaranteed to be a dict here.
            return [{**book_data, 'id': book_id} for book_id, book_data in books_data.items()]
        return []

    def get_podcasts(self, username):
        user_data = self.get_user_data(username)
        if user_data:
            podcasts_data = user_data.get('podcasts', {})
            return [{**podcast_data, 'id': podcast_id} for podcast_id, podcast_data in podcasts_data.items()]
        return []

    def delete_book(self, username, book_id):
        user_data = self.get_user_data(username)
        if user_data and book_id in user_data.get('books', {}):
            del user_data['books'][book_id]
            self.save_user_data(username, user_data)
            return True
        return False

    def edit_book(self, username, book_id, new_data):
        user_data = self.get_user_data(username)
        if user_data and book_id in user_data.get('books', {}):
            user_data['books'][book_id].update(new_data)
            self.save_user_data(username, user_data)
            return True
        return False

    def delete_podcast(self, username, podcast_id):
        user_data = self.get_user_data(username)
        if user_data and podcast_id in user_data.get('podcasts', {}):
            # Optional: Delete the audio file from cache as well
            # This requires knowing the audio_url and extracting the filename
            # For now, we only remove the entry from the user's JSON.
            del user_data['podcasts'][podcast_id]
            self.save_user_data(username, user_data)
            return True
        return False

    def add_podcast(self, username, podcast_data):
        user_data = self.get_user_data(username)
        if user_data:
            podcast_id = str(uuid.uuid4())
            user_data.setdefault('podcasts', {})[podcast_id] = podcast_data
            self.save_user_data(username, user_data)
            return True, podcast_id
        return False, None

    def update_podcast(self, username, podcast_id, new_data):
        user_data = self.get_user_data(username)
        if user_data and podcast_id in user_data.get('podcasts', {}):
            user_data['podcasts'][podcast_id].update(new_data)
            self.save_user_data(username, user_data)
            return True
        return False
