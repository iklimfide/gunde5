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
ROUTE_TO_HTML = {
    "/": "/index.html",
    "/podyum": "/podyum.html",
    "/kulis": "/index.html",
    "/profil": "/profil.html",
    "/hakkinda": "/hakkinda.html",
    "/iletisim": "/iletisim.html",
    "/kvkk": "/kvkk.html",
    "/istatistikler": "/istatistikler.html",
    "/metrikler": "/metrikler.html",
    "/mudavimler": "/mudavimler.html",
    "/uyeler": "/uyeler.html",
    "/kamikaze": "/kamikaze.html",
    "/sosyal-paylas": "/sosyal-paylas.html",
    "/og/anasayfa.png": "/api/og",
    "/hikaye-gonder": "/hikaye-gonder.html",
    "/admin/inbox": "/admin/inbox/index.html",
    "/admin/submissions": "/admin/inbox/index.html",
    "/admin/messages": "/admin/inbox/index.html",
    "/bulut": "/bulut.html",
    "/404": "/404.html",
}
HTML_TO_ROUTE = {
    html: route for route, html in ROUTE_TO_HTML.items() if route != "/"
}


def html_path_for_route(raw: str) -> str | None:
    route = ROUTE_TO_HTML.get(raw)
    if route:
        return route

    if raw.endswith(".html"):
        local = raw.lstrip("/")
    else:
        if "." in os.path.basename(raw):
            return None
        local = raw.lstrip("/") + ".html"

    full = os.path.join(ROOT, local.replace("/", os.sep))
    if os.path.isfile(full):
        return "/" + local.replace(os.sep, "/")
    return None


class Gunde5Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _clean_route_for_html(self, raw: str) -> str | None:
        if raw in HTML_TO_ROUTE:
            return HTML_TO_ROUTE[raw]
        if not raw.endswith(".html") or raw.count("/") != 1:
            return None
        if raw == ITIRAF_INDEX:
            return None
        local = raw.lstrip("/")
        full = os.path.join(ROOT, local.replace("/", os.sep))
        if not os.path.isfile(full):
            return None
        return "/" + local[:-5]

    def _redirect_target(self, raw: str, query: str) -> str | None:
        if raw == "/index.html":
            return "/" + query

        if raw in ("/podyum/",):
            return "/podyum" + query

        clean_route = self._clean_route_for_html(raw)
        if clean_route:
            return clean_route + query

        if raw not in ("", "/") and raw.endswith("/"):
            clean = raw.rstrip("/")
            if ITIRAF_RE.match(clean):
                return clean + query
            if html_path_for_route(clean):
                return clean + query

        return None

    def _resolve_path(self) -> tuple[str, bool]:
        """İstek yolunu dosya yoluna çevir. İkinci değer: özel 404 mü."""
        parsed = urlparse(self.path)
        raw = unquote(parsed.path)
        query = ("?" + parsed.query) if parsed.query else ""

        if raw in ("/itiraf", "/itiraf/"):
            return "/404.html" + query, True

        if ITIRAF_RE.match(raw):
            return ITIRAF_INDEX + query, False

        html_path = html_path_for_route(raw)
        if html_path:
            return html_path + query, False

        local = raw.lstrip("/").split("?", 1)[0]
        full = os.path.join(ROOT, local.replace("/", os.sep))
        if os.path.isfile(full):
            return self.path, False
        if os.path.isdir(full):
            index = os.path.join(full, "index.html")
            if os.path.isfile(index):
                return self.path, False

        return "/404.html" + query, True

    def _serve(self):
        parsed = urlparse(self.path)
        raw = unquote(parsed.path)
        query = ("?" + parsed.query) if parsed.query else ""
        redirect = self._redirect_target(raw, query)
        if redirect:
            self.send_response(308)
            self.send_header("Location", redirect)
            self.end_headers()
            return
        self.path, use_404 = self._resolve_path()
        self._gunde5_custom_404 = use_404
        return super().do_GET()

    def do_GET(self):
        return self._serve()

    def do_HEAD(self):
        parsed = urlparse(self.path)
        raw = unquote(parsed.path)
        query = ("?" + parsed.query) if parsed.query else ""
        redirect = self._redirect_target(raw, query)
        if redirect:
            self.send_response(308)
            self.send_header("Location", redirect)
            self.end_headers()
            return
        self.path, use_404 = self._resolve_path()
        self._gunde5_custom_404 = use_404
        return super().do_HEAD()

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
    try:
        httpd = ThreadingHTTPServer(("", port), Gunde5Handler)
    except OSError as err:
        sys.stderr.write(
            "Port %s kullanılamıyor (%s).\n"
            "Baska port: python dev-server.py 8081\n"
            % (port, err)
        )
        sys.exit(1)
    with httpd:
        print("gunde5 dev sunucu: http://localhost:%s/" % port)
        print("  /                           -> index (landing)")
        print("  /podyum                     -> podyum")
        print("  /, /podyum, /profil, /kvkk ...  -> clean route")
        print("  /itiraf/123                 -> yönlendirme (eski link)")
        print("Durdurmak: Ctrl+C  |  Baslat: start-dev.bat veya npm run dev")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nKapatıldı.")


if __name__ == "__main__":
    main()
