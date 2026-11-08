"""Shared helpers for the Book Similarity Machine offline pipeline.

The pipeline turns book metadata into the four artefacts the web app loads:

    public/data/positions.bin    Uint16 LE xyz per book (unit sphere +
                                 density lift encoded in the vector length)
    public/data/attrs.bin        Uint8 genre, Uint8 popularity, Uint16 LE year
    public/data/neighbors.bin    Uint32 LE ids, K per book
    public/data/clusters.json    continent centroids, names and colours
    public/data/meta-*.json      title/author/year/subjects chunks

Genre ids must match the `genres` array written into manifest.json.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / ".cache"
OUT = ROOT / "pipeline" / "out"
PUBLIC_DATA = ROOT / "public" / "data"

DB_PATH = CACHE / "books.sqlite"

GENRES = [
    {"id": "fantasy", "name": "Fantasy", "color": "#B9AEF0"},
    {"id": "scifi", "name": "Science fiction", "color": "#A9CDF0"},
    {"id": "romance", "name": "Romance", "color": "#F2B6CC"},
    {"id": "mystery", "name": "Mystery", "color": "#F5CFA0"},
    {"id": "literary", "name": "Literary", "color": "#A8DCC3"},
    {"id": "horror", "name": "Horror", "color": "#E3A6A6"},
    {"id": "history", "name": "History", "color": "#B8C6F0"},
    {"id": "poetry", "name": "Poetry", "color": "#D6C8EB"},
]

# Open Library subject fragments -> genre bucket.
GENRE_KEYWORDS = {
    0: ("fantasy", "magic", "dragons", "fairy tales", "folklore"),
    1: ("science fiction", "space", "robots", "cyberpunk", "future"),
    2: ("romance", "love stories", "courtship", "marriage"),
    3: ("mystery", "detective", "crime", "thriller", "suspense"),
    4: ("literary", "fiction", "modernism", "short stories"),
    5: ("horror", "ghost", "gothic", "supernatural"),
    6: ("history", "biography", "civilization", "war", "ancient"),
    7: ("poetry", "poems", "verse", "sonnets"),
}


def connect() -> sqlite3.Connection:
    CACHE.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS books (
            work_id     TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            author      TEXT,
            year        INTEGER,
            subjects    TEXT,
            description TEXT,
            popularity  INTEGER DEFAULT 0,
            cover_id    TEXT,
            embedded    INTEGER DEFAULT 0
        )
        """
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)"
    )
    conn.commit()
    return conn


def genre_for(subjects: list[str]) -> int:
    text = " ".join(subjects).lower()
    scores = {genre: 0 for genre in GENRE_KEYWORDS}
    for genre, keywords in GENRE_KEYWORDS.items():
        scores[genre] = sum(2 if keyword in text else 0 for keyword in keywords)
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else 4


def normalise_rows(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms


def write_positions(path: Path, unit_xyz: np.ndarray, lift: np.ndarray) -> None:
    """Quantise unit vectors to Uint16, folding a small density lift into |v|."""
    vectors = unit_xyz * (1.0 + lift.reshape(-1, 1))
    quantised = np.clip((vectors + 1.0) / 2.0 * 65535.0, 0, 65535).round().astype("<u2")
    quantised.tofile(path)


def write_attrs(path: Path, genre: np.ndarray, popularity: np.ndarray, year: np.ndarray) -> None:
    count = genre.shape[0]
    buf = np.zeros((count, 4), dtype=np.uint8)
    buf[:, 0] = genre.astype(np.uint8)
    buf[:, 1] = np.clip(popularity, 0, 255).astype(np.uint8)
    years = np.clip(year, 0, 65535).astype("<u2")
    out = np.zeros(count * 4, dtype=np.uint8)
    out[0::4] = buf[:, 0]
    out[1::4] = buf[:, 1]
    out[2::4] = years.astype(np.uint8)
    out[3::4] = (years >> 8).astype(np.uint8)
    out.tofile(path)


def write_neighbors(path: Path, ids: np.ndarray) -> None:
    ids.astype("<u4").tofile(path)


def write_meta_chunks(rows: list[dict], chunk_size: int, out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    chunks = 0
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        path = out_dir / f"meta-{chunks}.json"
        path.write_text(json.dumps(chunk, separators=(",", ":")))
        chunks += 1
    return chunks


def write_manifest(path: Path, count: int, chunks: int, chunk_size: int, neighbors: int) -> None:
    manifest = {
        "version": 1,
        "generatedAt": "1970-01-01T00:00:00.000Z",
        "source": "open library",
        "count": count,
        "chunkSize": chunk_size,
        "chunks": chunks,
        "neighbors": neighbors,
        "sphereRadius": 2,
        "genres": GENRES,
    }
    path.write_text(json.dumps(manifest, indent=2))
