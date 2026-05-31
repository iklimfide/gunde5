# -*- coding: utf-8 -*-
"""Public üye Katıl/Giriş ve auth overlay kaldırır (bulut.html hariç)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = {"bulut.html"}

AUTH_BTNS = re.compile(
    r"\n\s*<div class=\"header-auth-btns\" id=\"headerAuthBtns\">.*?</div>\n",
    re.DOTALL,
)

AUTH_OVERLAY = re.compile(
    r"\n\s*<div id=\"authOverlay\" class=\"auth-overlay\"[\s\S]*?\n\s*</div>\n\n",
)

AUTH_INLINE = re.compile(
    r"\n\s*function doldurYilSecenekleri\(\)[\s\S]*?\n\s*async function girisYap\(\)[\s\S]*?\n\s*\}\n",
)

AUTH_REMNANT = re.compile(
    r"\n\s*function openAuthModal\(mode\)[\s\S]*?\n\s*\}\n\n(\s*Gunde5DB)",
)

AUTH_REMNANT_SCRIPT = re.compile(
    r"\n\s*function openAuthModal\(mode\)[\s\S]*?\n\s*\}\n\n(\s*</script>)",
)

ORPHAN_NAV = re.compile(
    r"\n<span>Anasayfa</span>\s*\n\s*</a>\s*\n\s*<a href=\"/podyum\" class=\"nav-item active\">[\s\S]*?</div>\s*\n",
)

OPEN_AUTH_HOME = re.compile(
    r"function openAuthModal\(\)\s*\{\s*window\.location\.href = '/?';\s*\}",
)

OPEN_AUTH_STUB = (
    "\n        function openAuthModal() {\n"
    "            window.location.href = '/bulut';\n"
    "        }\n"
)


def main():
    for path in sorted(ROOT.glob("*.html")):
        if path.name in SKIP:
            continue
        text = path.read_text(encoding="utf-8")
        orig = text
        text = AUTH_BTNS.sub("\n", text)
        text = AUTH_OVERLAY.sub("\n\n", text)
        text = AUTH_INLINE.sub("\n", text)
        text = AUTH_REMNANT.sub(r"\n\n\1", text)
        text = AUTH_REMNANT_SCRIPT.sub(r"\n\n\1", text)
        text = ORPHAN_NAV.sub("\n", text)
        text = OPEN_AUTH_HOME.sub(
            "function openAuthModal() { window.location.href = '/bulut'; }",
            text,
        )
        if path.name in ("hikaye-gonder.html", "kamikaze.html") and "function openAuthModal" not in text:
            text = text.replace(
                "function guncelleHeaderOturum()",
                OPEN_AUTH_STUB + "\n        function guncelleHeaderOturum()",
                1,
            )
        if text != orig:
            path.write_text(text, encoding="utf-8")
            print("updated", path.name)
        else:
            print("no change", path.name)


if __name__ == "__main__":
    main()
