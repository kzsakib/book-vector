# Book Similarity Machine

A light-mode, neumorphic globe where **every book is a raised clay bump**. Similar
books sit close together, genres form continents, and you explore by rotating,
zooming, searching and clicking.

Built in the spirit of [Movie Map](https://github.com/kzsakib) — same idea, different
medium: 40,000 films become 40,000 books on a sphere.

- **Stack:** Vite · React · TypeScript · Tailwind v4 · Zustand · three.js via
  `@react-three/fiber` + drei · Web Workers
- **Data:** one binary globe + streamed metadata chunks, produced by an offline
  Python pipeline (`sentence-transformers` → UMAP → HDBSCAN → HNSW)
- **Ships runnable:** a deterministic ~2,000-book sample dataset is generated on
  `predev` / `prebuild`, so there is no pipeline step to run first.

## Quick start

```bash
npm install
npm run dev     # generates public/data if missing, then serves the app
```

Then drag to rotate, scroll/pinch to zoom, hover for a title, click a bump for the
detail panel and its soft arcs, double-click a continent to fly to it.

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + production build (regenerates the sample data)
npm run data:sample # regenerate the sample dataset by hand
```

The sample dataset is synthetic but deterministic: seeded titles, authors, years,
subjects and neighbour lists laid out over 17 continents in 8 genres. Real data
comes from the pipeline below; the app does not care which one it loads.

## How it works

```
                 ┌──────────────────────────────┐
   manifest.json │ count, genres, chunk layout  │  fetched first (+ clusters.json)
                 └──────────────┬───────────────┘
                                ▼
              positions.bin · attrs.bin · neighbors.bin
                                ▼
                 meta-0.json … meta-n.json (streamed)
```

`src/data/load.ts` streams in that order. The empty globe with continent labels is
on screen immediately; positions arrive next; metadata chunks land one at a time
and are fed to the search worker as they arrive, so coverage grows without a
reload.

### Front-end structure

| Path | Role |
| --- | --- |
| `src/components/GlobeScene.tsx` | lazy-loaded canvas, lights, clay sphere, controls, fly-to rig, DPR guard |
| `src/components/BookInstances.tsx` | one `InstancedMesh` for all domes + point-sprite LOD + per-instance alpha |
| `src/components/ClusterLabels.tsx` | letterpress continent names, faded by facing |
| `src/components/ArcLinks.tsx` | soft arcs from the selected book to its 10 nearest |
| `src/components/Picking.tsx` | pointer → ray → worker kd-tree; hover/click/double-click |
| `src/components/Header.tsx` | search pill, genre pills, era filters |
| `src/components/StatsPanel.tsx` | book/continent counts, filter result count, load progress |
| `src/components/GenreLegend.tsx` | genre key, doubles as a filter |
| `src/components/DetailPanel.tsx` | selected book, subjects, "Show nearby" list |
| `src/workers/atlas.worker.ts` | kd-tree picking, MiniSearch index, neighbour lookups |
| `src/store/atlas.ts` | Zustand dataset + filters + selection + per-instance alpha |
| `src/data/format.ts` | binary decoders, bump sizing, era matching |

### Rendering & performance decisions

- **One draw call for the bumps.** All books share a low-poly dome geometry in a
  single `InstancedMesh`; per-book colour comes from `instanceColor`, size from
  popularity. Instances behind the globe are collapsed in the vertex shader.
- **LOD.** Above ~5.1 camera distance the same data renders as shaded point sprites
  (one shader, culled by facing); closer in, real dome geometry swaps back with
  hysteresis so it never flickers.
- **Picking off the GPU.** A kd-tree over bump centres lives in the worker; the
  ray test also rejects the far hemisphere, so hover costs nothing per frame.
- **Search & neighbours in the worker.** MiniSearch over titles/authors/subjects and
  precomputed HNSW ids. Filtering only rewrites a per-instance alpha attribute —
  the scene is never rebuilt.
- **`frameloop="demand"`.** Frames are requested on interaction, damping, fly-to or
  auto-rotation only. `devicePixelRatio` is capped at 2 and stepped down if the
  measured frame rate drops under 45 fps.
- **Progressive, code-split.** The 3D scene is a separate chunk; the initial payload
  is the shell plus a few KB of manifest. Covers (when present) use `loading="lazy"`
  with a clay placeholder and the book's initials.
- **Reduced motion.** `prefers-reduced-motion` disables auto-rotation and damping and
  makes fly-to instant.

## Data format

`public/data`, produced by `scripts/generate-sample.mjs` or the pipeline:

| File | Layout |
| --- | --- |
| `manifest.json` | `count`, `chunkSize`, `chunks`, `neighbors`, `sphereRadius`, `genres[]` |
| `clusters.json` | continent `id`, `name`, `genre`, `color`, `count`, `terms`, `centroid` |
| `positions.bin` | `count × 3 × uint16` LE — `(v/65535)*2-1`; vector length carries the density lift |
| `attrs.bin` | `count × 4 bytes` — `uint8 genre`, `uint8 popularity`, `uint16 LE year` |
| `neighbors.bin` | `count × K × uint32` LE — neighbour ids, K=20 |
| `meta-N.json` | `[{ t, a, y, g, p, s[], c? }]` per book chunk |

Genre ids index `manifest.genres`. `c` is an optional cover URL.

## Full dataset pipeline

The three Python scripts in [`/pipeline`](pipeline/README.md) turn an Open Library
dump into the files above:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt

python pipeline/01_fetch_openlibrary.py --target 40000
python pipeline/02_embed.py                                  # bge-small-en-v1.5, 384-d
python pipeline/03_project_export.py --neighbors 20 --chunk-size 2000
```

That writes into `public/data` (and `pipeline/out`), replacing the sample. UMAP,
HDBSCAN and HNSW parameters are documented in [`pipeline/README.md`](pipeline/README.md).

## Hosting

**Vercel** — import the repo; the defaults in `vercel.json` build `dist/`. Sample data
is generated during the build.

**Cloudflare Pages** — build command `npm run build`, output `dist/`. `public/_headers`
sets cache + CORS rules for `/data/*`.

**Data on a CDN (R2/S3)** — upload `public/data` with Brotli, set
`Cache-Control: public, max-age=300, stale-while-revalidate=86400` and
`Access-Control-Allow-Origin: *`, then change the base in `src/data/format.ts`
(`dataUrl`) to the bucket URL. Filenames are stable, so keep the cache window short
or version the directory (`data/v3/...`).

## Notes & limitations

- The bundled sample is synthetic (no real titles/authors); it exists so the app runs
  without downloading dumps. Cover imagery in the sample is a generated clay
  placeholder, not a real cover.
- Clusters use HDBSCAN on the full embeddings; noise points fall back to their
  nearest continent for colouring.
- Neighbour lists are precomputed once — re-run stage 3 after changing the embedding
  model or the dataset.
