#!/usr/bin/env python3
"""Stage 2 — embed every book into a 384-d unit vector.

The text blob is title + author + subjects + description (the same recipe the
sample globe imitates). Uses `BAAI/bge-small-en-v1.5` (or any
sentence-transformers model) and stores a normalised float32 matrix:

    pipeline/out/embeddings.npy   (N, 384)
    pipeline/out/books.json       ordered ids + metadata fields

Already embedded rows are skipped, so this is safe to re-run.

Usage:
    python pipeline/02_embed.py
    python pipeline/02_embed.py --model sentence-transformers/all-MiniLM-L6-v2
"""

from __future__ import annotations

import argparse
import json

import numpy as np

from common import OUT, connect

BATCH = 64


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="BAAI/bge-small-en-v1.5")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    from sentence_transformers import SentenceTransformer

    OUT.mkdir(parents=True, exist_ok=True)
    conn = connect()
    limit = f" LIMIT {args.limit}" if args.limit else ""
    rows = conn.execute(
        f"SELECT work_id, title, author, year, subjects, description, popularity, cover_id "
        f"FROM books ORDER BY popularity DESC{limit}"
    ).fetchall()
    if not rows:
        raise SystemExit("no books cached — run 01_fetch_openlibrary.py first")

    ids = [row[0] for row in rows]
    texts = []
    for work_id, title, author, year, subjects, description, popularity, cover in rows:
        subject_list = json.loads(subjects or "[]")
        blob = " · ".join(
            part
            for part in (
                title or "",
                author or "",
                ", ".join(subject_list[:24]),
                description or "",
            )
            if part
        )
        texts.append(blob)

    print(f"embedding {len(texts):,} books with {args.model}")
    model = SentenceTransformer(args.model)
    vectors = model.encode(
        texts,
        batch_size=BATCH,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True,
    ).astype(np.float32)

    np.save(OUT / "embeddings.npy", vectors)
    (OUT / "books.json").write_text(
        json.dumps(
            [
                {
                    "work_id": row[0],
                    "title": row[1],
                    "author": row[2],
                    "year": row[3],
                    "subjects": json.loads(row[4] or "[]"),
                    "description": row[5],
                    "popularity": row[6],
                    "cover_id": row[7],
                }
                for row in rows
            ],
            separators=(",", ":"),
        )
    )
    conn.execute(
        "INSERT INTO meta (key, value) VALUES ('embedding_model', ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (args.model,),
    )
    conn.commit()
    print(f"wrote {vectors.shape} -> {OUT / 'embeddings.npy'}")


if __name__ == "__main__":
    main()
