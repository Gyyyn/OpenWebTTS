import json
import os
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
            "books": []
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
                return json.load(f)
        return None

    def save_user_data(self, username, data):
        user_file = self._get_user_file_path(username)
        with open(user_file, 'w') as f:
            json.dump(data, f, indent=4)

    def add_book(self, username, book_data):
        user_data = self.get_user_data(username)
        if user_data:
            user_data['books'].append(book_data)
            self.save_user_data(username, user_data)
            return True
        return False

    def get_books(self, username):
        user_data = self.get_user_data(username)
        if user_data:
            return user_data.get('books', [])
        return []
