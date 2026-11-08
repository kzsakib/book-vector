# Offline pipeline

Turns book metadata into the binary globe the app loads. Three scripts, a resumable
SQLite cache, and a few numpy arrays.

```
books.sqlite ──▶ embeddings.npy ──▶ positions.bin / attrs.bin / neighbors.bin
   01_fetch         02_embed          03_project_export
                                        └─ clusters.json, meta-*.json, manifest.json
```

Everything lands in `pipeline/out` **and** `public/data`, so a successful run is
immediately visible with `npm run dev`.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r pipeline/requirements.txt
```

`hnswlib` and `hdbscan` need a C++ toolchain (`build-essential` / Xcode CLT) on
first install. `sentence-transformers` will download the embedding model once
(~130 MB for `bge-small-en-v1.5`).

## Stage 1 — fetch (`01_fetch_openlibrary.py`)

```bash
python pipeline/01_fetch_openlibrary.py --target 40000
python pipeline/01_fetch_openlibrary.py --target 40000 --subjects fantasy,history
```

- Pulls from `openlibrary.org/search.json` page by page per subject, storing
  `work_id, title, author, year, subjects, description, popularity, cover`.
- Upserts into `pipeline/.cache/books.sqlite`, so it can be stopped at any time and
  restarted where it left off. Network errors retry with exponential backoff.
- `--sleep` (default 0.4 s) is polite pacing for the public API.
- Popularity is a rough blend of edition count and ratings and is stored 0–255.

**For the real 40k dataset** use the Open Library dumps instead of the API and point
the same `books` schema at them. The monthly `ol_dump_works_*.txt.gz` files contain
`/type/works` JSON lines with subjects and descriptions; a small loader that inserts
into the same table (plus author names from the authors dump) is all that is needed —
stage 2 and 3 only read the table.

## Stage 2 — embed (`02_embed.py`)

```bash
python pipeline/02_embed.py
python pipeline/02_embed.py --model sentence-transformers/all-MiniLM-L6-v2
```

Text per book: `title · author · subjects (first 24) · description`, embedded with
`BAAI/bge-small-en-v1.5` (384-d), L2-normalised, saved as float32
`pipeline/out/embeddings.npy` alongside `books.json` (the row order that all later
stages rely on).

## Stage 3 — project, cluster, export (`03_project_export.py`)

```bash
python pipeline/03_project_export.py
python pipeline/03_project_export.py --neighbors 20 --chunk-size 2000 --min-cluster-size 40
```

1. **Project** — PCA to 50-d, then UMAP to 3-D with `metric="cosine"`,
   `n_neighbors=30`, `min_dist=0.1`. Each point is normalised onto the unit sphere.
2. **Lift** — mean distance to the 8 nearest neighbours is ranked into 0–1 and folded
   into the vector length (`|v| = 1 + 0.012·density`), so crowded regions read as
   raised. The app reads the magnitude back out of `positions.bin`.
3. **Cluster** — HDBSCAN (`min_cluster_size=40`, `cluster_selection_method="eom"`) on the
   *full* embeddings, not the flattened map, so continents reflect real semantic
   similarity. Each continent is named from its top subject terms and tinted with the
   dominant genre's pastel. Noise points (`label = -1`) get the colour of the nearest
   centroid in the app.
4. **Neighbours** — HNSW (`space="cosine"`, `M=32`, `ef_construction=200`) over the
   original embeddings, `k = neighbors + 1`, self dropped. These ids drive the "nearby
   books" list and the arcs.
5. **Export** — quantised positions, packed attrs, neighbour ids, cluster centroids and
   metadata chunks (default 2,000 books per chunk, compact JSON keys).

### Output sizes for 40k books

| File | Size |
| --- | --- |
| `positions.bin` | ~240 KB |
| `attrs.bin` | 160 KB |
| `neighbors.bin` | 3.2 MB (20 ids × 4 B) |
| `meta-*.json` | ~5 MB total, 20 chunks, Brotli to roughly a fifth |
| `clusters.json` | a few KB |

Compress the uploads with Brotli; Vercel and Cloudflare Pages do this
automatically, for R2/S3 enable it on the bucket or pre-compress.

### Tuning

- **Bigger, looser continents:** lower `--min-cluster-size`, raise UMAP `n_neighbors`
  and `min_dist`.
- **More, tighter continents:** raise `--min-cluster-size`, lower `min_dist`.
- **Different map shape:** raise `min_dist` for an even spread, lower it for denser
  islands.
- Re-run stage 3 after changing the embedding model, the dataset, or any parameter —
  neighbour ids and cluster ids must stay in sync with the app's data.
