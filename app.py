import os
import uvicorn
import argparse
import threading
import time
import socket

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# Import config and router
from config import STATIC_DIR, DATA_DIR
from functions.routes import router
from functions.openai_api import openai_api_router

# --- FastAPI Setup ---
app = FastAPI()
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(router)
app.include_router(openai_api_router)

# --- Main Execution ---
def _find_free_port(preferred_port: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", preferred_port))
            return preferred_port
        except OSError:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenWebTTS server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind the server to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind the server to")
    parser.add_argument("--desktop", action="store_true", help="Launch as a desktop app using a webview")
    parser.add_argument("--debug", action="store_true", help="Toggle various debug features")
    args = parser.parse_args()

    host = args.host
    port = _find_free_port(args.port)

    if not args.desktop:
        print("Starting OpenWebTTS server...")
        print(f"Access the UI at http://{host}:{port}")
        uvicorn.run(app, host=host, port=port)
    else:
        try:
            import webview
        except Exception as e:
            print("pywebview is required for desktop mode. Install with: pip install pywebview")
            raise

        print("Starting OpenWebTTS server in desktop mode...")
        config = uvicorn.Config(app, host=host, port=port, log_level="info")
        server = uvicorn.Server(config)

        server_thread = threading.Thread(target=server.run, daemon=True)
        server_thread.start()

        # Wait briefly for the server to start
        for _ in range(50):
            if getattr(server, "started", False):
                break
            time.sleep(0.1)

        url = f"http://{host}:{port}"
        print(f"Opening desktop window at {url}")

        server_debug = False

        if (args.debug == "true"):
            server_debug = True

        try:
            window = webview.create_window("OpenWebTTS", url, width=1280, height=900, resizable=True, text_select=True, fullscreen=False)
            window.icon = f"{DATA_DIR}maskable_icon_x128.png"

            webview.start(debug=server_debug, private_mode=False)
        finally:
            # Signal server to exit and wait a moment
            try:
                server.should_exit = True
            except Exception:
                pass
            time.sleep(0.2)