"""Local guest-only preview. Uses the real template and modules; no production database."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import re
import argparse

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / 'src/main/resources/static'

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript'}
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in ('/game', '/game/', '/'):
            content = (ROOT / 'src/main/resources/templates/game/index.html').read_text(encoding='utf-8')
            content = re.sub(r'th:(href|src)="@\{([^}(]+)\(v=([^)]*)\)\}"', r'\1="\2?v=\3"', content)
            content = re.sub(r'th:(href|src)="@\{([^}]+)\}"', r'\1="\2"', content)
            content = content.replace('<header th:replace="~{fragments/layout :: header}"></header>', '<header style="padding:16px 0;font:12px sans-serif;color:#637369">同生零食铺 / 本地试玩</header>')
            self.send_bytes(content.encode('utf-8'), 'text/html; charset=utf-8')
        elif path == '/api/auth/me':
            self.send_bytes(b'{"user":null}', 'application/json')
        elif path == '/api/game/save':
            self.send_error(401)
        else:
            super().do_GET()

    def send_bytes(self, data, mime):
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    print(f'Guest preview: http://127.0.0.1:{args.port}/game', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
