# 50k atlas evaluation

Synthetic corpus: these numbers validate the pipeline, lens rules and data contract,
not a real catalogue. Swap `build_corpus()` for Open Library + BGE + Claude and rerun.

| metric | value |
|---|---|
| books | 50,000 |
| positions.bin | 195.3 KB |
| attrs.bin | 683.6 KB |
| strings.bin | 1657.7 KB |
| tags.bin | 3.9 KB |
| one neighbour chunk | 200.0 KB |
| all neighbour chunks | 9.54 MB |
| all details chunks | 9.11 MB |
| across-genre rate (lens 2) | 100.0% |
| best-mix cross-genre share | 63.9% |
| books with a series duplicate in closest | 0 / 600 |
| books with a series duplicate in best mix | 0 / 600 |
| premise-neighbour recall@10 (3-D layout, no UMAP) | 0.0% |
| map neighbours in the same genre | 91.7% |
| map nearest-neighbour distance | 0.0009 |
| level offsets | [0, 500, 2000, 7000, 18000, 35000] |
