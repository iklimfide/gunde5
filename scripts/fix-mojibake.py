#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix UTF-8-as-Latin-1 mojibake in HTML; preserve already-correct Unicode."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TARGETS = [
    ROOT / "istatistikler.html",
    ROOT / "metrikler.html",
    ROOT / "kamikaze.html",
    ROOT / "mudavimler.html",
    ROOT / "sosyal-paylas.html",
    ROOT / "uyeler.html",
    ROOT / "admin" / "inbox" / "index.html",
    ROOT / "hakkinda.html",
    ROOT / "profil.html",
    ROOT / "404.html",
    ROOT / "iletisim.html",
    ROOT / "kvkk.html",
    ROOT / "bulut.html",
]


def fix_mojibake(text: str) -> str:
    result: list[str] = []
    buf: list[str] = []

    def flush() -> None:
        if not buf:
            return
        chunk = "".join(buf)
        buf.clear()
        try:
            result.append(chunk.encode("latin-1").decode("utf-8"))
        except (UnicodeEncodeError, UnicodeDecodeError):
            result.append(chunk)

    for c in text:
        if ord(c) < 256:
            buf.append(c)
        else:
            flush()
            result.append(c)
    flush()
    return "".join(result)


def process(path: Path) -> bool:
    if not path.is_file():
        return False
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
        had_bom = True
    else:
        had_bom = False
    text = raw.decode("utf-8")
    fixed = fix_mojibake(text)
    if fixed == text and not had_bom:
        return False
    path.write_bytes(fixed.encode("utf-8"))
    return True


def main() -> None:
    changed = []
    for path in TARGETS:
        if process(path):
            changed.append(path.relative_to(ROOT))
    for p in sorted(changed):
        print("fixed:", p)
    if not changed:
        print("no changes")


if __name__ == "__main__":
    main()
