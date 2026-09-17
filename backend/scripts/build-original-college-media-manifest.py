#!/usr/bin/env python3
"""Build a deterministic JSONL source manifest from the December 2024 CSV export."""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse


IMAGE_EXTENSIONS = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"}
VIDEO_HOSTS = {"youtube.com", "www.youtube.com", "youtu.be", "vimeo.com", "www.vimeo.com"}


def clean(value: object) -> str:
    return html.unescape(str(value or "")).strip()


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKD", clean(value))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def safe_url(value: object) -> str:
    candidate = clean(value)
    if not candidate:
        return ""
    try:
        parsed = urlparse(candidate)
    except ValueError:
        return ""
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or not parsed.hostname
        or re.search(r"\s", parsed.netloc)
    ):
        return ""
    return candidate


def is_video(row: dict[str, str], url: str) -> bool:
    gallery_type = normalize(row.get("gallery_type"))
    host = urlparse(url).netloc.lower()
    return "video" in gallery_type or host in VIDEO_HOSTS


def preferred_gallery_url(row: dict[str, str]) -> str:
    for field in ("olds_gallery_url", "gallery_url", "gallery_img", "s3_url"):
        url = safe_url(row.get(field))
        if url and not is_video(row, url):
            return url
    return ""


def preferred_hero_url(row: dict[str, str]) -> str:
    for field in ("old_banner_url", "banner_url", "second_banner_url"):
        url = safe_url(row.get(field))
        if url:
            return url
    return ""


def numeric_sort(value: object) -> tuple[int, str]:
    text = clean(value)
    return (int(text), text) if text.isdigit() else (sys.maxsize, text)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--colleges", required=True, type=Path)
    parser.add_argument("--gallery", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    colleges: dict[str, dict[str, object]] = {}
    with args.colleges.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            legacy_id = clean(row.get("id"))
            if not legacy_id:
                continue
            colleges[legacy_id] = {
                "legacy_id": legacy_id,
                "slug": clean(row.get("clg_slug")),
                "name": clean(row.get("clg_name")),
                "city": clean(row.get("clg_city")),
                "state": clean(row.get("clg_state")),
                "hero_source_url": preferred_hero_url(row),
                "gallery": [],
            }

    gallery_rows = 0
    excluded_rows = 0
    orphan_rows = 0
    seen_by_college: dict[str, set[str]] = defaultdict(set)
    with args.gallery.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            gallery_rows += 1
            legacy_id = clean(row.get("clg_id"))
            college = colleges.get(legacy_id)
            if college is None:
                orphan_rows += 1
                continue
            source_url = preferred_gallery_url(row)
            if not source_url:
                excluded_rows += 1
                continue
            if source_url in seen_by_college[legacy_id]:
                continue
            seen_by_college[legacy_id].add(source_url)
            college["gallery"].append({
                "legacy_gallery_id": clean(row.get("id")),
                "gallery_type": clean(row.get("gallery_type")),
                "source_url": source_url,
            })

    args.output.parent.mkdir(parents=True, exist_ok=True)
    output_rows = 0
    gallery_images = 0
    hero_images = 0
    with args.output.open("w", encoding="utf-8", newline="\n") as handle:
        for college in sorted(colleges.values(), key=lambda row: numeric_sort(row["legacy_id"])):
            college["gallery"].sort(key=lambda row: numeric_sort(row["legacy_gallery_id"]))
            if not college["hero_source_url"] and not college["gallery"]:
                continue
            handle.write(json.dumps(college, ensure_ascii=True, separators=(",", ":")) + "\n")
            output_rows += 1
            hero_images += int(bool(college["hero_source_url"]))
            gallery_images += len(college["gallery"])

    report = {
        "colleges_parsed": len(colleges),
        "colleges_with_media": output_rows,
        "hero_images": hero_images,
        "gallery_rows_scanned": gallery_rows,
        "gallery_images": gallery_images,
        "gallery_rows_excluded": excluded_rows,
        "gallery_rows_orphaned": orphan_rows,
        "output": str(args.output),
    }
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
