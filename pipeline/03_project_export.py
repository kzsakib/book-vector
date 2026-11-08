#!/usr/bin/env python3
"""Stage 3 — project to the globe, cluster, and export the binary artefacts.

Steps
  1. PCA + UMAP (cosine) to 3-D, then normalise every point onto the unit sphere
     and lift crowded areas slightly by local density.
  2. HDBSCAN over the full 384-d embedding (not the flattened map) gives
     continents; each is named from its top subject terms and tinted from its
     genre.
  3. HNSW over the original embeddings precomputes the 20 nearest neighbours
     that the app draws arcs to.

Outputs go to both pipeline/out and public/data (manifest, clusters,
positions.bin, attrs.bin, neighbors.bin, meta-*.json).

Usage:
    python pipeline/03_project_export.py
    python pipeline/03_project_export.py --neighbors 20 --chunk-size 2000
"""

from __future__ import annotations

import argparse
import json
from collections import Counter

import numpy as np

from common import (
    GENRES,
    OUT,
    PUBLIC_DATA,
    genre_for,
    normalise_rows,
    write_attrs,
    write_manifest,
    write_meta_chunks,
    write_neighbors,
    write_positions,
)

# Subject terms that describe the shape of a continent, not its genre.
STEP = 0.012


def local_density(points: np.ndarray, k: int = 8) -> np.ndarray:
    """Mean cosine-ish distance to the k nearest points, normalised to 0..1."""
    from sklearn.neighbors import NearestNeighbors

    neighbours = NearestNeighbors(n_neighbors=k + 1, metric="euclidean").fit(points)
    distances, _ = neighbours.kneighbors(points)
    mean = distances[:, 1:].mean(axis=1)
    ranked = np.argsort(np.argsort(mean)).astype(np.float32)
    return ranked / max(1, len(ranked) - 1)


def name_clusters(subjects: list[list[str]], labels: np.ndarray) -> dict[int, tuple[str, list[str]]]:
    names: dict[int, tuple[str, list[str]]] = {}
    for label in sorted(set(labels)):
        if label < 0:
            continue
        counter: Counter[str] = Counter()
        for index, cluster in enumerate(labels):
            if cluster != label:
                continue
            counter.update({s.lower() for s in subjects[index] if s})
        terms = [term for term, _ in counter.most_common(3)] or [f"Cluster {label}"]
        title = " · ".join(term.title() for term in terms[:2])
        names[int(label)] = (title, terms)
    return names


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--neighbors", type=int, default=20)
    parser.add_argument("--chunk-size", type=int, default=2000)
    parser.add_argument("--min-cluster-size", type=int, default=40)
    args = parser.parse_args()

    embeddings = np.load(OUT / "embeddings.npy")
    books = json.loads((OUT / "books.json").read_text())
    count = embeddings.shape[0]
    print(f"{count:,} books · {embeddings.shape[1]}-d")

    import umap
    from hdbscan import HDBSCAN
    from sklearn.decomposition import PCA

    reduced = PCA(n_components=min(50, embeddings.shape[1]), random_state=7).fit_transform(
        embeddings
    )
    mapper = umap.UMAP(
        n_components=3,
        metric="cosine",
        n_neighbors=30,
        min_dist=0.1,
        random_state=7,
        verbose=True,
    )
    points = mapper.fit_transform(reduced).astype(np.float32)
    unit = normalise_rows(points)
    lift = local_density(unit) * STEP
    positions = normalise_rows(unit)  # density lift is written into the magnitude

    print("clustering on the full embeddings")
    clusterer = HDBSCAN(
        min_cluster_size=args.min_cluster_size,
        metric="euclidean",
        cluster_selection_method="eom",
    )
    labels = clusterer.fit_predict(embeddings)

    subjects = [book.get("subjects") or [] for book in books]
    genres = np.array([genre_for(s) for s in subjects], dtype=np.uint8)
    names = name_clusters(subjects, labels)

    centroids = {}
    clusters = []
    for cluster_id, (title, terms) in names.items():
        member_index = np.flatnonzero(labels == cluster_id)
        if member_index.size == 0:
            continue
        centroid = normalise_rows(unit[member_index].mean(axis=0, keepdims=True))[0]
        colour = GENRES[int(np.bincount(genres[member_index]).argmax())]["color"]
        centroids[cluster_id] = centroid
        clusters.append(
            {
                "id": cluster_id,
                "name": title,
                "genre": int(np.bincount(genres[member_index]).argmax()),
                "color": colour,
                "count": int(member_index.size),
                "terms": terms,
                "centroid": [round(float(v), 5) for v in centroid],
            }
        )

    print("building HNSW neighbour graph")
    import hnswlib

    index = hnswlib.Index(space="cosine", dim=embeddings.shape[1])
    index.init_index(max_elements=count, ef_construction=200, M=32)
    index.add_items(embeddings, np.arange(count))
    neighbours, _ = index.knn_query(embeddings, k=args.neighbors + 1)
    neighbours = neighbours[:, 1:].astype(np.uint32)  # drop self

    popularity = np.array([int(book.get("popularity") or 0) for book in books])
    popularity = np.clip(popularity, 1, 255).astype(np.uint8)
    years = np.array([int(book.get("year") or 0) for book in books], dtype=np.uint16)

    meta_rows = [
        {
            "t": book["title"],
            "a": book.get("author") or "",
            "y": int(book.get("year") or 0),
            "g": int(genres[i]),
            "p": int(popularity[i]),
            "s": (book.get("subjects") or [])[:6],
            **({"c": book["cover_id"]} if book.get("cover_id") else {}),
        }
        for i, book in enumerate(books)
    ]

    for directory in (OUT, PUBLIC_DATA):
        directory.mkdir(parents=True, exist_ok=True)
        write_positions(directory / "positions.bin", positions, lift)
        write_attrs(directory / "attrs.bin", genres, popularity, years)
        write_neighbors(directory / "neighbors.bin", neighbours)
        chunks = write_meta_chunks(meta_rows, args.chunk_size, directory)
        write_manifest(directory / "manifest.json", count, chunks, args.chunk_size, args.neighbors)
        (directory / "clusters.json").write_text(
            json.dumps(
                {
                    "generatedAt": "1970-01-01T00:00:00.000Z",
                    "radius": 2,
                    "clusters": clusters,
                },
                separators=(",", ":"),
            )
        )

    print(
        f"exported {count:,} books · {len(clusters)} continents · "
        f"{args.neighbors} neighbours each -> {PUBLIC_DATA}"
    )


if __name__ == "__main__":
    main()
