#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix UTF-8-as-Latin-1 mojibake in HTML; preserve already-correct Unicode."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TARGETS = sorted(
    p
    for p in ROOT.rglob("*.html")
    if "node_modules" not in p.parts and ".git" not in p.parts
)


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


def decode_text(raw: bytes) -> tuple[str, bool]:
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
        had_bom = True
    else:
        had_bom = False
    try:
        return raw.decode("utf-8"), had_bom
    except UnicodeDecodeError:
        return raw.decode("cp1254"), True


def process(path: Path) -> bool:
    if not path.is_file():
        return False
    raw = path.read_bytes()
    text, reencoded = decode_text(raw)
    fixed = fix_mojibake(text)
    if fixed == text and not reencoded:
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
