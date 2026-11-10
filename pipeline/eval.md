# 50k atlas evaluation

Synthetic corpus: these numbers validate the pipeline, lens rules and data contract,
not a real catalogue. Swap `build_corpus()` for Open Library + BGE + Claude and rerun.

| metric | value |
|---|---|
| books | 50,000 |
| positions.bin | 195.3 KB |
| attrs.bin | 683.6 KB |
| strings.bin | 1658.0 KB |
| tags.bin | 3.9 KB |
| one neighbour chunk | 200.0 KB |
| all neighbour chunks | 9.54 MB |
| all details chunks | 8.92 MB |
| across-genre rate (lens 2) | 100.0% |
| best-mix cross-genre share | 45.0% |
| books with a series duplicate in closest | 0 / 600 |
| books with a series duplicate in best mix | 0 / 600 |
| map fidelity recall@10 (vs premise lens) | 0.2% |
| map neighbours in the same genre | 61.4% |
| map nearest-neighbour distance | 0.0010 |
| level offsets | [0, 500, 2000, 7000, 18000, 35000] |
