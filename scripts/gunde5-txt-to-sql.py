#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gunde5.txt → planlı itiraflar seed SQL.

Dosya formatı:
  TARİH: 06-06-2026 07:04   (opsiyonel; varsa dosyadaki saat kullanılır)
  BAŞLIK: ...
  RUMUZ: ...
  YAŞ: 32
  CİNSİYET: Erkek | Kadın   (opsiyonel)
  ŞEHİR: İstanbul | Yurtdışı - Berlin
  ...hikaye metni...

Yayın: TARİH yoksa ilk günden itibaren günde 5 hikaye — 07:00 … 07:04 (Europe/Istanbul).

Günlük kullanım (SQL dosyası):
  python scripts/gunde5-txt-to-sql.py "C:\\Users\\iklim\\Downloads\\gunde5.txt"

Doğrudan veritabanına (bir kez service_role ayarla):
  $env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
  python scripts/gunde5-txt-to-sql.py gunde5.txt --ekle

İlk günü değiştirmek için (isteğe bağlı):
  python scripts/gunde5-txt-to-sql.py gunde5.txt --ilk-gun 2026-06-04
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Istanbul")

SEHIR_SLUG = {
    "adana": "adana",
    "ankara": "ankara",
    "izmir": "izmir",
    "bursa": "bursa",
    "antalya": "antalya",
    "trabzon": "trabzon",
    "eskisehir": "eskisehir",
    "istanbul": "istanbul_avrupa",
}

GUN_BASINA = 5
SAAT_DAKIKA = (0, 1, 2, 3, 4)  # 07:00 … 07:04


def norm(s: str) -> str:
    t = s.strip().lower()
    for a, b in [
        ("ı", "i"),
        ("İ", "i"),
        ("i̇", "i"),
        ("ğ", "g"),
        ("ü", "u"),
        ("ş", "s"),
        ("ö", "o"),
        ("ç", "c"),
    ]:
        t = t.replace(a, b)
    return t


def yer_slug(sehir: str) -> str:
    key = norm(sehir)
    if "istanbul" in key:
        return "istanbul_avrupa"
    if key in SEHIR_SLUG:
        return SEHIR_SLUG[key]
    slug = re.sub(r"[^a-z0-9]+", "_", key).strip("_")
    return slug or "ankara"


def yer_ve_yurtdisi(sehir: str) -> tuple[str, str | None]:
    ham = sehir.strip()
    if re.search(r"yurtd", norm(ham), re.I) or re.search(r"yurtdisi", ham, re.I):
        m = re.search(r"[-–]\s*(.+)$", ham)
        return "yurtdisi", (m.group(1).strip() if m else None)
    return yer_slug(ham), None


def parse_tarih_satir(ham: str) -> tuple[str, str] | None:
    """DD-MM-YYYY HH:MM → (ISO, SQL timestamptz literal)."""
    m = re.match(
        r"(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})",
        ham.strip(),
    )
    if not m:
        return None
    gun, ay, yil, saat, dk = m.groups()
    d = date(int(yil), int(ay), int(gun))
    h, mi = int(saat), int(dk)
    iso = f"{d.isoformat()}T{h:02d}:{mi:02d}:00+03:00"
    sql = f"timestamptz '{d.isoformat()} {h:02d}:{mi:02d}:00+03'"
    return iso, sql


def split_blocks(text: str) -> list[str]:
    """Ayraç veya yeni TARİH satırı ile bloklara böl."""
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []
    parts = re.split(
        r"(?:^-{10,}\s*\n|\n(?=TARİH:\s*\d{1,2}-\d{1,2}-\d{4}))",
        text,
        flags=re.MULTILINE,
    )
    return [p.strip() for p in parts if p.strip()]


def cinsiyet_slug(ham: str | None) -> str:
    if not ham:
        return "male"
    k = norm(ham)
    if k in ("kadin", "k", "female", "f"):
        return "female"
    return "male"


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def yarin_istanbul() -> date:
    return (datetime.now(TZ) + timedelta(days=1)).date()


def parse_ilk_gun(s: str) -> date:
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Geçersiz tarih: {s!r} (ör. 2026-06-04 veya 04-06-2026)")


def yayin_zamanlari(story_count: int, ilk_gun: date) -> list[tuple[str, str]]:
    """(created_at ISO, SQL timestamptz literal)"""
    out: list[tuple[str, str]] = []
    for i in range(story_count):
        gun = ilk_gun + timedelta(days=i // GUN_BASINA)
        dk = SAAT_DAKIKA[i % GUN_BASINA]
        iso = f"{gun.isoformat()}T07:{dk:02d}:00+03:00"
        sql = f"timestamptz '{gun.isoformat()} 07:{dk:02d}:00+03'"
        out.append((iso, sql))
    return out


def short_text(t: str) -> str:
    return t if len(t) <= 140 else t[:137] + "..."


def load_supabase_env() -> tuple[str, str]:
    url = os.environ.get("GUNDE5_SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if url and key:
        return url.rstrip("/"), key

    cfg = Path(__file__).resolve().parents[1] / "js" / "gunde5-config.js"
    if cfg.is_file():
        text = cfg.read_text(encoding="utf-8")
        if not url:
            m = re.search(r"GUNDE5_SUPABASE_URL\s*=\s*['\"]([^'\"]+)['\"]", text)
            if m:
                url = m.group(1).strip()
    if not url:
        url = "https://rimhuhdbqazbhuorsnll.supabase.co"
    return url.rstrip("/"), key


def supabase_request(
    url: str,
    key: str,
    method: str,
    path: str,
    *,
    query: dict[str, str] | None = None,
    body: object | None = None,
) -> tuple[int, object]:
    q = f"?{urllib.parse.urlencode(query)}" if query else ""
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if method == "POST":
        headers["Prefer"] = "return=representation"
    req = urllib.request.Request(
        f"{url}/rest/v1/{path}{q}",
        method=method,
        headers=headers,
    )
    if body is not None:
        req.data = json.dumps(body).encode("utf-8")
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read().decode("utf-8")
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {e.code}: {err}") from e


def mevcut_mu(url: str, key: str, baslik: str, created_at: str) -> bool:
    status, rows = supabase_request(
        url,
        key,
        "GET",
        "itiraflar",
        query={
            "select": "id",
            "baslik": f"eq.{baslik}",
            "created_at": f"eq.{created_at}",
            "silindi_at": "is.null",
            "limit": "1",
        },
    )
    return status == 200 and isinstance(rows, list) and len(rows) > 0


def veritabanina_ekle(url: str, key: str, stories: list[dict]) -> None:
    for s in stories:
        baslik = s["baslik"]
        created_at = s["created_at"]
        if mevcut_mu(url, key, baslik, created_at):
            print(f"Atlandı (zaten var): {baslik} @ {created_at}", file=sys.stderr)
            continue
        tam = s["hikaye"]
        body = {
            "user_id": None,
            "username": s["username"],
            "age": s["age"],
            "gender": s["gender"],
            "yasadigi_yer": s["yasadigi_yer"],
            "baslik": baslik,
            "content_full": tam,
            "content_short": short_text(tam),
            "status": "kulis",
            "is_gizli": False,
            "created_at": created_at,
        }
        if s.get("yurtdisi_sehir"):
            body["yurtdisi_sehir"] = s["yurtdisi_sehir"]
        _, row = supabase_request(
            url,
            key,
            "POST",
            "itiraflar",
            query={"select": "id,baslik,created_at"},
            body=body,
        )
        rid = row[0]["id"] if isinstance(row, list) and row else "?"
        print(f"Eklendi: {baslik} (id {rid}) @ {created_at}", file=sys.stderr)


def parse_file(text: str) -> list[dict]:
    stories: list[dict] = []
    for block in split_blocks(text):
        if not re.search(r"BAŞLIK\s*:", block, re.I):
            continue

        fields: dict[str, str] = {}
        for key, pat in [
            ("tarih", r"TARİH:\s*(.+?)(?:\r?\n|$)"),
            ("baslik", r"BAŞLIK:\s*(.+?)(?:\r?\n|$)"),
            ("rumuz", r"RUMUZ:\s*(.+?)(?:\r?\n|$)"),
            ("yas", r"YAŞ:\s*(\d+)"),
            ("cinsiyet", r"CİNSİYET:\s*(.+?)(?:\r?\n|$)"),
            ("sehir", r"ŞEHİR:\s*(.+?)(?:\r?\n|$)"),
        ]:
            m = re.search(pat, block, re.I)
            if m:
                fields[key] = m.group(1).strip()

        if not all(k in fields for k in ("baslik", "rumuz", "yas", "sehir")):
            print("Uyarı: eksik alan, blok atlandı", file=sys.stderr)
            continue

        parts = re.split(r"ŞEHİR:.*(?:\r?\n)", block, maxsplit=1, flags=re.I)
        body = parts[1].strip() if len(parts) > 1 else ""
        if not body:
            print(f"Uyarı: boş metin — {fields['baslik']}", file=sys.stderr)
            continue

        yer, yurtdisi = yer_ve_yurtdisi(fields["sehir"])
        row: dict = {
            "username": fields["rumuz"],
            "age": int(fields["yas"]),
            "gender": cinsiyet_slug(fields.get("cinsiyet")),
            "yasadigi_yer": yer,
            "yurtdisi_sehir": yurtdisi,
            "baslik": fields["baslik"],
            "hikaye": body,
        }
        if fields.get("tarih"):
            parsed = parse_tarih_satir(fields["tarih"])
            if parsed:
                row["created_at"], row["yayin_at_sql"] = parsed
            else:
                print(f"Uyarı: geçersiz TARİH — {fields['baslik']}: {fields['tarih']}", file=sys.stderr)
        stories.append(row)
    return stories


def zamanlari_ata(stories: list[dict], ilk_gun: date) -> None:
    eksik = [s for s in stories if "created_at" not in s]
    if not eksik:
        return
    if len(eksik) < len(stories):
        print(
            "Uyarı: bazı bloklarda TARİH yok; eksikler otomatik slot alıyor.",
            file=sys.stderr,
        )
    zamanlar = yayin_zamanlari(len(eksik), ilk_gun)
    for s, (iso, sql_lit) in zip(eksik, zamanlar):
        s["created_at"] = iso
        s["yayin_at_sql"] = sql_lit


def render_sql(stories: list[dict], baslik: str) -> str:
    if not stories:
        return "-- Hikaye bulunamadı.\n"

    rows = []
    for s in stories:
        hikaye = sql_escape(s["hikaye"])
        yurtdisi = "null::varchar"
        if s.get("yurtdisi_sehir"):
            yurtdisi = f"'{sql_escape(s['yurtdisi_sehir'])}'"
        rows.append(
            f"    (\n"
            f"      '{sql_escape(s['username'])}',\n"
            f"      {s['age']},\n"
            f"      '{s['gender']}',\n"
            f"      '{sql_escape(s['yasadigi_yer'])}',\n"
            f"      {yurtdisi},\n"
            f"      '{sql_escape(s['baslik'])}',\n"
            f"      '{hikaye}',\n"
            f"      {s['yayin_at_sql']}\n"
            f"    )"
        )

    joined = ",\n".join(rows)
    return f"""-- {baslik}
-- created_at gelene kadar anasayfada görünmez. Supabase SQL Editor'da bir kez Run.

insert into public.itiraflar (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
  yurtdisi_sehir,
  baslik,
  content_short,
  content_full,
  status,
  is_gizli,
  created_at
)
select
  null,
  v.username,
  v.age,
  v.gender,
  v.yasadigi_yer,
  v.yurtdisi_sehir,
  v.baslik,
  case
    when char_length(v.hikaye) <= 140 then v.hikaye
    else left(v.hikaye, 137) || '...'
  end,
  v.hikaye,
  'kulis',
  false,
  v.yayin_at
from (
  values
{joined}
) as v(username, age, gender, yasadigi_yer, yurtdisi_sehir, baslik, hikaye, yayin_at)
where not exists (
  select 1
  from public.itiraflar i
  where i.baslik = v.baslik
    and i.created_at = v.yayin_at
    and i.silindi_at is null
);
"""


def main() -> int:
    ap = argparse.ArgumentParser(
        description="gunde5.txt → planlı itiraflar SQL (tarih dosyada değil)"
    )
    ap.add_argument(
        "dosya",
        type=Path,
        nargs="?",
        default=Path("gunde5.txt"),
        help="gunde5.txt (varsayılan: ./gunde5.txt)",
    )
    ap.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("supabase/seed-gunde5.sql"),
        help="Çıktı SQL (varsayılan: supabase/seed-gunde5.sql)",
    )
    ap.add_argument(
        "--ilk-gun",
        metavar="TARIH",
        help="İlk yayın günü (YYYY-MM-DD veya DD-MM-YYYY). Verilmezse yarın (İstanbul).",
    )
    ap.add_argument(
        "--ekle",
        action="store_true",
        help="SQL yerine doğrudan Supabase itiraflar tablosuna yaz (SUPABASE_SERVICE_ROLE_KEY gerekir)",
    )
    ap.add_argument(
        "--no-sql",
        action="store_true",
        help="--ekle ile: seed SQL dosyası üretme",
    )
    args = ap.parse_args()

    if not args.dosya.is_file():
        print(f"Dosya bulunamadı: {args.dosya}", file=sys.stderr)
        return 1

    ilk_gun = parse_ilk_gun(args.ilk_gun) if args.ilk_gun else yarin_istanbul()
    text = args.dosya.read_text(encoding="utf-8")
    stories = parse_file(text)
    if not stories:
        print("Hikaye bulunamadı.", file=sys.stderr)
        return 1

    zamanlari_ata(stories, ilk_gun)

    tarihler = sorted(date.fromisoformat(s["created_at"][:10]) for s in stories)
    ozet = (
        f"{len(stories)} planlı hikaye — {args.dosya.name} — "
        f"{tarihler[0].isoformat()} … {tarihler[-1].isoformat()} (dosya TARİH / 07:00–07:04)"
    )

    if args.ekle:
        url, key = load_supabase_env()
        if not key:
            print(
                "SUPABASE_SERVICE_ROLE_KEY tanımlı değil.\n"
                "Supabase Dashboard → Settings → API → service_role (secret)\n"
                "PowerShell: $env:SUPABASE_SERVICE_ROLE_KEY = \"eyJ...\"",
                file=sys.stderr,
            )
            return 1
        try:
            veritabanina_ekle(url, key, stories)
        except RuntimeError as e:
            print(str(e), file=sys.stderr)
            return 1
        print(f"Bitti: {len(stories)} hikaye işlendi (ilk gün {ilk_gun})", file=sys.stderr)

    if not args.ekle or not args.no_sql:
        sql = render_sql(stories, ozet)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(sql, encoding="utf-8")
        print(
            f"Yazıldı: {args.output} ({len(stories)} hikaye, "
            f"{tarihler[0].isoformat()} … {tarihler[-1].isoformat()})",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
