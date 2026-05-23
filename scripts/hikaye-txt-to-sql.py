#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hikayeler.txt → Supabase INSERT SQL (kulis bot hikayeleri)

Dosya formatı (örnek):
  [HİKAYE 1]
  Rumuz: SigortacıFırlama
  Yaş / Şehir: 46 Yaş • İstanbul (♂)
  ...hikaye metni...

Kullanım:
  python scripts/hikaye-txt-to-sql.py hikayeler.txt
  python scripts/hikaye-txt-to-sql.py hikayeler.txt -o supabase/seed-yeni.sql
  python scripts/hikaye-txt-to-sql.py "C:\\Users\\iklim\\Downloads\\hikayeler.txt"
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Türkçe şehir adı → yasadigi_yer slug (gunde5-profil.js ile uyumlu)
SEHIR_SLUG = {
    "adana": "adana",
    "ankara": "ankara",
    "izmir": "izmir",
    "bursa": "bursa",
    "antalya": "antalya",
    "istanbul": "istanbul_avrupa",
    "i̇stanbul": "istanbul_avrupa",
    "istanbul avrupa": "istanbul_avrupa",
    "istanbul anadolu": "istanbul_anadolu",
    "i̇stanbul avrupa": "istanbul_avrupa",
    "i̇stanbul anadolu": "istanbul_anadolu",
}


def norm(s: str) -> str:
    return (
        s.strip()
        .lower()
        .replace("ı", "i")
        .replace("İ", "i")
        .replace("ğ", "g")
        .replace("ü", "u")
        .replace("ş", "s")
        .replace("ö", "o")
        .replace("ç", "c")
    )


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def yer_slug(sehir_ham: str) -> str:
    key = norm(sehir_ham)
    if key in SEHIR_SLUG:
        return SEHIR_SLUG[key]
    # Diğer iller: boşluk → alt çizgi
    slug = re.sub(r"[^a-z0-9]+", "_", key).strip("_")
    return slug or "ankara"


def parse_meta(line: str) -> tuple[int, str, str, str | None]:
    """Yaş / Şehir: 46 Yaş • İstanbul (♂) (Sene: 2002)"""
    age_m = re.search(r"(\d+)\s*Yaş", line, re.I)
    if not age_m:
        raise ValueError("Yaş bulunamadı: " + line)
    age = int(age_m.group(1))

    if "♀" in line or re.search(r"\(K\)", line):
        gender = "female"
    elif "♂" in line or re.search(r"\(E\)", line):
        gender = "male"
    else:
        gender = "male"

    sehir_m = re.search(r"•\s*([^(•]+?)\s*\(", line)
    if not sehir_m:
        sehir_m = re.search(r"•\s*(.+)$", line)
    sehir = (sehir_m.group(1).strip() if sehir_m else "ankara").split("(")[0].strip()
    yer = yer_slug(sehir)

    yurtdisi = None
    if norm(sehir) == "yurtdisi" or "yurtdışı" in sehir.lower():
        yer = "yurtdisi"
        ym = re.search(r"yurtd[ıi]ş[ıi]\s*[•·-]?\s*([^(]+)", line, re.I)
        yurtdisi = ym.group(1).strip() if ym else None

    return age, gender, yer, yurtdisi


def parse_file(text: str) -> list[dict]:
    blocks = re.split(r"\[HİKAYE\s+\d+\]\s*\n?", text, flags=re.I)
    stories = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        lines = block.splitlines()
        if not lines:
            continue

        rumuz = None
        meta_line = None
        body_start = 0

        for i, line in enumerate(lines):
            if re.match(r"^\s*Rumuz\s*:", line, re.I):
                rumuz = re.sub(r"^\s*Rumuz\s*:\s*", "", line, flags=re.I).strip()
            elif re.match(r"^\s*Yaş\s*/\s*Şehir\s*:", line, re.I):
                meta_line = line
                body_start = i + 1
                break

        if not rumuz or not meta_line:
            print(f"Uyarı: atlanan blok (rumuz/meta eksik)", file=sys.stderr)
            continue

        age, gender, yer, yurtdisi = parse_meta(meta_line)
        body = "\n".join(lines[body_start:]).strip()
        if not body:
            print(f"Uyarı: boş hikaye — {rumuz}", file=sys.stderr)
            continue

        stories.append(
            {
                "username": rumuz,
                "age": age,
                "gender": gender,
                "yasadigi_yer": yer,
                "yurtdisi_sehir": yurtdisi,
                "hikaye": body,
            }
        )
    return stories


def render_sql(stories: list[dict], baslik: str) -> str:
    if not stories:
        return "-- Hikaye bulunamadı.\n"

    rows = []
    for s in stories:
        yurtdisi = "null::varchar"
        if s["yurtdisi_sehir"]:
            yurtdisi = "'" + sql_escape(s["yurtdisi_sehir"]) + "'"
        hikaye = sql_escape(s["hikaye"])
        rows.append(
            f"    (\n"
            f"      '{sql_escape(s['username'])}',\n"
            f"      {s['age']},\n"
            f"      '{s['gender']}',\n"
            f"      '{sql_escape(s['yasadigi_yer'])}',\n"
            f"      {yurtdisi},\n"
            f"      '{hikaye}'\n"
            f"    )"
        )

    joined = ",\n".join(rows)
    return f"""-- {baslik}
-- Supabase SQL Editor'da çalıştırın. Aynı rumuz+metin varsa eklenmez.

insert into public.itiraflar (
  user_id,
  username,
  age,
  gender,
  yasadigi_yer,
  yurtdisi_sehir,
  content_short,
  content_full,
  status,
  is_gizli
)
select
  null,
  v.username,
  v.age,
  v.gender,
  v.yasadigi_yer,
  v.yurtdisi_sehir,
  case
    when char_length(v.hikaye) <= 140 then v.hikaye
    else left(v.hikaye, 137) || '...'
  end,
  v.hikaye,
  'kulis',
  false
from (
  values
{joined}
) as v(username, age, gender, yasadigi_yer, yurtdisi_sehir, hikaye)
where not exists (
  select 1 from public.itiraflar i
  where i.username = v.username
    and i.content_full = v.hikaye
    and i.silindi_at is null
);
"""


def main() -> int:
    ap = argparse.ArgumentParser(description="hikayeler.txt → Supabase kulis seed SQL")
    ap.add_argument("dosya", type=Path, help="hikayeler.txt yolu")
    ap.add_argument(
        "-o",
        "--output",
        type=Path,
        help="SQL dosyası (yoksa stdout)",
    )
    args = ap.parse_args()

    if not args.dosya.is_file():
        print(f"Dosya bulunamadı: {args.dosya}", file=sys.stderr)
        return 1

    text = args.dosya.read_text(encoding="utf-8")
    stories = parse_file(text)
    sql = render_sql(stories, f"{len(stories)} hikaye — {args.dosya.name}")

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(sql, encoding="utf-8")
        print(f"Yazıldı: {args.output} ({len(stories)} hikaye)", file=sys.stderr)
    else:
        sys.stdout.write(sql)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
