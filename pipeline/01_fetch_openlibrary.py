#!/usr/bin/env python3
"""Stage 1 — collect book metadata from Open Library into a resumable SQLite cache.

Two supported inputs:

  * the Open Library monthly dumps (recommended for 40k+ books), or
  * the search API, which this script uses by default for a smaller sample.

Every write is cached, so stopping and restarting never loses progress and the
API is only asked for rows that are missing.

Usage:
    python pipeline/01_fetch_openlibrary.py --target 40000
    python pipeline/01_fetch_openlibrary.py --target 40000 --subjects fantasy,history
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from common import connect, genre_for

SEARCH = "https://openlibrary.org/search.json"
USER_AGENT = "book-similarity-machine/1.0 (offline dataset build)"
SUBJECTS = [
    "fantasy",
    "science_fiction",
    "romance",
    "mystery",
    "literary_fiction",
    "horror",
    "history",
    "poetry",
    "biography",
    "adventure",
    "philosophy",
    "psychology",
]


def fetch_json(url: str, retries: int = 4) -> dict:
    for attempt in range(retries):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            if attempt == retries - 1:
                raise
            wait = 2**attempt
            print(f"  retrying in {wait}s ({error})")
            time.sleep(wait)
    return {}


def store(conn, doc: dict) -> bool:
    work_id = doc.get("key")
    title = (doc.get("title") or "").strip()
    if not work_id or not title:
        return False

    authors = doc.get("author_name") or []
    subjects = list(doc.get("subject") or [])[:24]
    first_publish = doc.get("first_publish_year")
    edition_count = int(doc.get("edition_count") or 0)
    ratings = float(doc.get("ratings_average") or 0)
    ratings_count = int(doc.get("ratings_count") or 0)
    popularity = int(min(255, edition_count * 4 + ratings_count / 12 + ratings * 6))
    cover = doc.get("cover_i")

    description = ""
    first_sentence = doc.get("first_sentence")
    if isinstance(first_sentence, list):
        first_sentence = first_sentence[0] if first_sentence else ""
    if isinstance(first_sentence, str):
        description = first_sentence.strip()

    conn.execute(
        """
        INSERT INTO books (work_id, title, author, year, subjects, description,
                           popularity, cover_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(work_id) DO UPDATE SET
            title=excluded.title,
            author=excluded.author,
            year=excluded.year,
            subjects=excluded.subjects,
            description=excluded.description,
            popularity=MAX(books.popularity, excluded.popularity),
            cover_id=COALESCE(excluded.cover_id, books.cover_id)
        """,
        (
            work_id,
            title,
            authors[0] if authors else "",
            first_publish if isinstance(first_publish, int) else None,
            json.dumps(subjects),
            description,
            popularity,
            f"https://covers.openlibrary.org/b/id/{cover}-M.jpg" if cover else None,
        ),
    )
    return True


def already(conn) -> int:
    return int(conn.execute("SELECT COUNT(*) FROM books").fetchone()[0])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=20000)
    parser.add_argument("--subjects", default=",".join(SUBJECTS))
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--sleep", type=float, default=0.4)
    args = parser.parse_args()

    conn = connect()
    total = already(conn)
    print(f"cache holds {total:,} books")

    for subject in [s for s in args.subjects.split(",") if s]:
        page = 1
        while total < args.target:
            query = urllib.parse.urlencode(
                {
                    "q": f"subject:{subject}",
                    "fields": (
                        "key,title,author_name,first_publish_year,subject,"
                        "edition_count,ratings_average,ratings_count,cover_i,first_sentence"
                    ),
                    "limit": args.page_size,
                    "page": page,
                }
            )
            payload = fetch_json(f"{SEARCH}?{query}")
            docs = payload.get("docs") or []
            if not docs:
                break
            written = 0
            for doc in docs:
                if store(conn, doc):
                    written += 1
            conn.commit()
            total = already(conn)
            print(f"  {subject} page {page}: +{written} (total {total:,})")
            if written == 0:
                break
            page += 1
            time.sleep(args.sleep)

    genre_rows = conn.execute("SELECT work_id, subjects FROM books").fetchall()
    for work_id, subjects_json in genre_rows:
        subjects = json.loads(subjects_json or "[]")
        conn.execute(
            "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (f"genre:{work_id}", str(genre_for(subjects))),
        )
    conn.commit()

    print(f"done — {total:,} books cached at pipeline/.cache/books.sqlite")


if __name__ == "__main__":
    main()
