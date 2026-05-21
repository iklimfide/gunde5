#!/usr/bin/env python3
"""gunde5 — yerel statik sunucu (/itiraf ve özel 404 için rewrite)."""
from __future__ import annotations

import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
ITIRAF_INDEX = "/itiraf/index.html"
ITIRAF_RE = re.compile(r"^/itiraf/(\d+)/?$")


class Gunde5Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _resolve_path(self) -> tuple[str, bool]:
        """İstek yolunu dosya yoluna çevir. İkinci değer: özel 404 mü."""
        raw = unquote(urlparse(self.path).path)
        query = ("?" + urlparse(self.path).query) if urlparse(self.path).query else ""

        if raw in ("/itiraf", "/itiraf/"):
            return "/404.html" + query, True

        if ITIRAF_RE.match(raw):
            return ITIRAF_INDEX + query, False

        if raw in ("", "/"):
            return "/index.html" + query, False

        local = raw.lstrip("/").split("?", 1)[0]
        full = os.path.join(ROOT, local.replace("/", os.sep))
        if os.path.isfile(full):
            return self.path, False
        if os.path.isdir(full):
            index = os.path.join(full, "index.html")
            if os.path.isfile(index):
                return self.path, False

        return "/404.html" + query, True

    def do_GET(self):
        self.path, use_404 = self._resolve_path()
        self._gunde5_custom_404 = use_404
        return super().do_GET()

    def send_response(self, code, message=None):
        if getattr(self, "_gunde5_custom_404", False):
            code = 404
            self._gunde5_custom_404 = False
        return super().send_response(code, message)


def main() -> None:
    port = 8080
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    os.chdir(ROOT)
    with ThreadingHTTPServer(("", port), Gunde5Handler) as httpd:
        print("gunde5 dev sunucu: http://localhost:%s/" % port)
        print("  /itiraf      -> giyotin 404 veya yönlendirme")
        print("  /itiraf/123  -> itiraf sayfası")
        print("  /kamikaze/   -> yönetim paneli")
        print("Durdurmak için Ctrl+C")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nKapatıldı.")


if __name__ == "__main__":
    main()
