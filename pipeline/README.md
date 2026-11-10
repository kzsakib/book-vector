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

---

## 50k build — `50k_build.py`

The production scale target: 50,000 books, five neighbour lenses, chunked binaries
and an eval report, in one run (~35 s, numpy only).

```bash
python3 pipeline/50k_build.py        # writes public/data-50k/ and pipeline/eval.md
```

**What is real here:** the data contract and every stage after it — candidate
generation, the five-lens construction (best mix via RRF with a cross-genre floor
and a same-subgenre cap, closest with series dedupe, across genres, mood, themes),
bridge entropy, the six popularity levels, the 1,024-book neighbour chunks,
256-book detail shards, hashed immutable filenames, `manifest.json`, and the eval.

**What is synthetic:** the corpus and the embeddings. This environment has no GPU,
no Open Library dumps and no Claude API key, so `build_corpus()` generates a
deterministic 50k catalogue and hashed feature atoms stand in for BGE embeddings
and Claude-rewritten genre-free premises. To run it for real, replace
`build_corpus()` / `build_embeddings()` with the stages above (fetch → BGE-base →
Claude premise rewrite); nothing downstream changes.

### Output contract (`public/data-50k/`)

| file | bytes |
|---|---|
| `positions.bin` | 4 B/book (uint16 lon, lat) |
| `attrs.bin` | 14 B/book (genre, sub, cluster, era, pop, year, level, bridge, 5 mood) |
| `tags.bin` | newline-separated tag vocabulary, 512 entries |
| `strings.bin` + `strings.idx` | titles and authors, lazy-loaded |
| `neighbors-<n>.bin` | 200 B/book: 5 lenses × 10 ids (u16), strengths (u8), flags (u8) |
| `details-<n>.json` | 256 books per shard, lazy-loaded |
| `levels.json` | reveal order (level, then popularity) |
| `clusters.json` | continent id, name, colour, count |
| `manifest.json` | logical name → SHA-1(6) hashed filename, plus byte sizes |

Every file is written in book-id order; `levels.json` carries the draw order.

### Measured (synthetic corpus, see `pipeline/eval.md`)

positions 195 KB · attrs 684 KB · one neighbour chunk 200 KB · 49 chunks 9.5 MB ·
strings 1.66 MB (lazy) · details 8.9 MB (lazy) · across-genres lens 100 %
cross-genre · 0 series duplicates in closest and in the best mix · 61 % of map
neighbours in the same genre.

Boot payload is positions + attrs + levels + manifest ≈ 0.9 MB, which leaves the
2 MB boot budget intact with strings and details deferred.
