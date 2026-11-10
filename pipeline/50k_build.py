"""Offline 50k atlas build (A1-A7) against a deterministic synthetic corpus.

This sandbox has no GPU, no Open Library dumps and no Claude API key, so the
corpus and the embeddings are synthetic: the data contract, lens construction,
calibration, level packing, chunking and eval are real. Swap build_corpus() for
the Open Library + BGE + Claude steps and every downstream stage is unchanged.

Run: python3 pipeline/50k_build.py
"""
from __future__ import annotations

import hashlib
import json
import math
import zlib
from pathlib import Path

import numpy as np

N = 50_000
CHUNK = 1_024
K = 10
PULL = 200
LENSES = ("mix", "closest", "across", "mood", "themes")
DIM = 64
PROJ = 24
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data-50k"

GENRES = [
    ("Fantasy", "#A599E8"), ("Science fiction", "#8DBBE6"), ("Romance", "#E99BB8"),
    ("Mystery", "#E6BC84"), ("Literary", "#86CDB0"), ("Horror", "#D98F8F"),
    ("History", "#98A8E6"), ("Poetry", "#C4B2E4"),
]
MOTIFS = [
    "an outsider takes a job that hides a conspiracy", "a family secret surfaces at a funeral",
    "two rivals cooperate to survive", "a letter arrives decades too late",
    "a debt is called in at the worst moment", "a mentor's advice turns out to be a lie",
    "a quiet town hides one violent night", "a childhood promise is tested",
    "an archive reveals a forged history", "a journey home becomes a reckoning",
    "a witness disappears before the trial", "a marriage rebuilds after a betrayal",
    "an apprentice surpasses a jealous master", "a border crossing forces a choice",
    "an inheritance carries an impossible condition", "a rescue goes wrong",
    "a healer cannot save the person they love", "a map leads somewhere it should not",
    "a rival's success exposes a shared crime", "a second chance arrives with a price",
    "a rumour destroys a reputation overnight", "a rescue party finds the wrong survivor",
    "a mentor disappears mid-sentence", "a debt collector becomes a confidant",
    "a stolen object is returned anonymously", "a diary contradicts the official story",
    "a storm strands strangers with old grudges", "a trial exposes the judge's past",
    "a reunion hides an unspoken diagnosis", "a discovery splits a friendship",
    "a funeral brings an estranged sibling home", "an assistant keeps the receipts",
    "a translator realises the message is a warning", "a caretaker inherits an argument",
    "a neighbour's disappearance reframes a marriage", "a scholarship hides an obligation",
    "an old photograph contradicts a eulogy", "a ceasefire depends on one confession",
    "a ritual is performed for the wrong reason", "a cure works only if someone forgets",
    "a treaty is signed in bad faith", "a witness protection plan fails quietly",
    "a family business hides a second ledger", "a teacher recognises a stolen story",
    "a police report is filed under a false name", "an expedition returns one short",
    "a will names an unexpected heir", "a sanctuary becomes a trap",
    "a heist depends on an old favour", "a reunion reopens a closed investigation",
    "a rumour starts a small war", "an apology arrives too late",
    "a stranger knows the protagonist's childhood", "a friend asks one dangerous favour",
    "a postponed wedding forces a confession", "a case turns on a forgotten receipt",
    "an adopted child searches for an origin", "a rival family offers an alliance",
    "a locked room contains a second door", "a lost sibling returns with a new name",
    "a rescue dog leads to a hidden grave", "a shared secret binds two enemies",
    "a widow requests an impossible errand", "a final interview uncovers a cover-up",
    "a small kindness changes a verdict", "a forged signature unravels a career",
    "a broken clock hides a message", "an old rivalry resurfaces at a wedding",
    "a ship's log contradicts the survivor", "a missing page explains the affair",
    "a neighbour's kindness feels like surveillance", "a public apology is a threat",
    "a promise to a dying friend redirects a life", "a discovery changes a family",
    "a career is traded for a sibling's safety", "a bargain is struck in a corridor",
    "a secret adoption surfaces at the will", "a reunion at a conference goes wrong",
    "an unpaid debt returns as blackmail", "a quiet resignation hides a long plan",
    "a forged passport forces a new identity", "a lost letter reopens an old romance",
    "a mentor's notes reveal a second student", "a storm exposes a hidden cellar",
    "a charity hides a laundering scheme", "a promotion depends on silencing a witness",
    "a family recipe conceals a debt", "a second diary rewrites the first",
    "a witness's memory is gently corrected", "a rescue mission becomes a negotiation",
    "a small town elects the wrong mayor", "a boundary dispute becomes a feud",
    "a will is contested by a stranger", "a borrowed name becomes a life sentence",
]
MOOD_AXES = [("cosy", "dark"), ("light", "heavy"), ("fast", "slow"),
             ("hopeful", "bleak"), ("whimsical", "gritty")]
TITLE_A = ["The", "A", "Last", "First", "Hidden", "Quiet", "Borrowed", "Broken", "Small", "Long"]
TITLE_B = ["House", "Garden", "Letter", "Winter", "Archive", "Kitchen", "Harbour", "Orchard",
           "Library", "Bridge", "Station", "Island", "Market", "Chapel", "Engine", "Harvest",
           "Wedding", "Funeral", "Trial", "Promise", "Debt", "Passage", "Ledger", "Signal"]
TITLE_C = ["of Salt", "of Glass", "of Ash", "of Snow", "of Fire", "of Rain", "of Dust",
           "of Light", "of Silence", "of Stone", "and Bone", "and Honey"]
FIRST = ["Ada", "Nora", "Iris", "Jonah", "Mira", "Elias", "Talia", "Samir", "Ruth", "Clara",
         "Felix", "Ines", "Omar", "June", "Leo", "Nadia", "Pavel", "Rosa", "Theo", "Yara"]
LAST = ["Petrov", "Lindqvist", "Nakamura", "Ferreira", "Okafor", "Rossi", "Haddad", "Novak",
        "Silva", "Meyer", "Kaur", "Bauer", "Costa", "Ibrahim", "Larsen", "Moreau"]


def stable_hash(text: str) -> int:
    return zlib.crc32(text.encode()) & 0xFFFFFFFF


def unit(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    n[n == 0] = 1.0
    return (v / n).astype(np.float32)


def build_corpus() -> dict:
    rng = np.random.default_rng(20261110)
    ids = np.arange(N)
    raw = 1.0 / (ids + 50) ** 1.05
    pop = (255 * raw / raw[0]).astype(np.uint8)
    genre = rng.choice(8, N, p=[0.18, 0.14, 0.16, 0.14, 0.12, 0.08, 0.10, 0.08]).astype(np.uint8)
    sub = ((genre * 7 + rng.integers(0, 7, N)) % 60).astype(np.uint8)
    year = np.clip(rng.normal(1985, 34, N), 1800, 2026).astype(np.uint16)
    # Six popularity levels by rank: 500 / 2k / 7k / 18k / 35k / the rest.
    by_pop = np.argsort(-pop, kind="stable")
    level = np.zeros(N, np.uint8)
    level[by_pop] = np.searchsorted([500, 2000, 7000, 18000, 35000],
                                    np.arange(N), side="right").astype(np.uint8)
    titles = [f"{TITLE_A[a]} {TITLE_B[b]} {TITLE_C[c]}" for a, b, c in zip(
        rng.integers(0, len(TITLE_A), N), rng.integers(0, len(TITLE_B), N),
        rng.integers(0, len(TITLE_C), N))]
    authors = [f"{FIRST[i % 20]} {LAST[(i * 7) % 16]}" for i in rng.integers(0, 999, N)]
    series = (ids // rng.integers(2, 5, N)).astype(np.int32)
    tags = np.full((N, 8), -1, dtype=np.int16)
    motifs = np.full((N, 6), -1, dtype=np.int16)
    for i in range(N):
        count = int(rng.integers(4, 9))
        base = int(genre[i]) * 40
        body = np.concatenate([rng.integers(base, base + 40, count),
                               rng.integers(0, 512, 2)])[:8]
        tags[i, : len(body)] = body
        picks = rng.integers(0, len(MOTIFS), int(rng.integers(3, 7)))
        motifs[i, : len(picks)] = picks
    return dict(pop=pop, genre=genre, sub=sub, year=year, level=level, titles=titles,
                authors=authors, series=series, tags=tags, motifs=motifs,
                tag_vocab=[f"tag-{i}" for i in range(512)])


def add_tokens(mat: np.ndarray, row: int, tokens, weight: float) -> None:
    for token in tokens:
        if token is None:
            continue
        h = stable_hash(str(token))
        mat[row, h % DIM] += weight
        mat[row, (h >> 11) % DIM] -= weight * 0.35


def build_embeddings(c: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    full = np.zeros((N, DIM), np.float32)
    premise = np.zeros((N, DIM), np.float32)
    themes = np.zeros((N, DIM), np.float32)
    for i in range(N):
        tags = [c["tag_vocab"][t] for t in c["tags"][i] if t >= 0]
        motifs = [MOTIFS[m] for m in c["motifs"][i] if m >= 0]
        add_tokens(full, i, c["titles"][i].lower().split(), 1.0)
        add_tokens(full, i, [c["authors"][i]], 0.3)
        add_tokens(full, i, [GENRES[c["genre"][i]][0], f"sub-{c['sub'][i]}"], 0.6)
        add_tokens(full, i, tags, 0.8)
        add_tokens(full, i, motifs, 0.45)
        # E_premise sees no genre words at all.
        add_tokens(premise, i, motifs, 1.0)
        add_tokens(premise, i, tags, 0.12)
        add_tokens(themes, i, tags, 1.0)
    return unit(full), unit(premise), unit(themes)


def mood_matrix(c: dict) -> np.ndarray:
    out = np.zeros((N, 5), np.float32)
    for i in range(N):
        ms = [m for m in c["motifs"][i] if m >= 0]
        if not ms:
            continue
        for axis, (lo, _hi) in enumerate(MOOD_AXES):
            out[i, axis] = np.mean([stable_hash(MOTIFS[m] + lo) % 1000 / 1000 for m in ms])
    out -= out.min(0)
    out /= np.maximum(out.max(0), 1e-6)
    return np.round(out * 255).astype(np.uint8)


def topk(sims: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
    part = np.argpartition(-sims, k, axis=1)[:, :k]
    vals = np.take_along_axis(sims, part, 1)
    order = np.argsort(-vals, axis=1)
    return np.take_along_axis(part, order, 1), np.take_along_axis(vals, order, 1)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for stale in OUT.iterdir():
        if stale.is_file():
            stale.unlink()
    c = build_corpus()
    full, premise, themes = build_embeddings(c)
    mood = mood_matrix(c)
    genre = c["genre"].astype(np.int32)
    sub = c["sub"].astype(np.int32)
    pop = c["pop"].astype(np.int32)

    rng = np.random.default_rng(99)
    proj = rng.normal(0, 1, (DIM, PROJ)).astype(np.float32)
    proj = unit(proj)

    # One blocked 50k x 50k pass on the projected premise gives every book a
    # 200-book candidate pool; all five lenses are scored inside that pool.
    low = unit(premise @ proj)
    cand = np.zeros((N, PULL), np.uint16)
    for start in range(0, N, 512):
        stop = min(start + 512, N)
        cand[start:stop] = topk(low[start:stop] @ low.T, PULL)[0]
    cand = cand.astype(np.int64)

    rows = np.arange(N)[:, None]

    def blocked_scores(query: np.ndarray, block: int = 2_000) -> np.ndarray:
        """Cosine of every candidate against its book, in memory-safe blocks."""
        out = np.zeros((N, PULL), np.float32)
        for start in range(0, N, block):
            stop = min(start + block, N)
            out[start:stop] = np.einsum("npd,nd->np", query[cand[start:stop]],
                                        query[start:stop])
        return out

    cf = blocked_scores(full)
    cp = blocked_scores(premise)
    ct = blocked_scores(themes)
    mood_i16 = mood.astype(np.int16)
    cm = -np.abs(mood_i16[cand] - mood_i16[:, None, :]).sum(2).astype(np.float32)

    # Closest: full cosine, one book per series.
    series = c["series"]
    closest = np.zeros((N, K), np.uint16)
    for i in range(N):
        seen, picked = set(), []
        for slot in np.argsort(-cf[i]):
            j = int(cand[i, slot])
            if j == i or series[j] in seen:
                continue
            seen.add(series[j])
            picked.append(j)
            if len(picked) == K:
                break
        closest[i] = picked

    cross = genre[cand] != genre[rows]
    lens_scores = (cf, np.where(cross, cp, -2.0), cm, ct)
    lens_ids = np.zeros((4, N, K), np.uint16)
    lens_str = np.zeros((4, N, K), np.uint8)
    for li, scores in enumerate(lens_scores):
        slots = np.argsort(-scores, axis=1)[:, :K]
        lens_ids[li] = cand[rows, slots]
        raw = np.take_along_axis(scores, slots, 1)
        if li == 2:
            span = max(1e-6, float(raw.max() - raw.min()))
            norm = (raw - raw.min()) / span
        else:
            norm = (raw + 0.15) / 0.9
        lens_str[li] = (np.clip(norm, 0, 1) * 255).astype(np.uint8)

    across_ids, mood_ids, theme_ids = lens_ids[1], lens_ids[2], lens_ids[3]

    # Lens 5: RRF with the cross-genre floor and same-subgenre cap.
    mix = np.zeros((N, K), np.uint16)
    for i in range(N):
        score: dict[int, float] = {}
        for ids in (closest[i], across_ids[i], mood_ids[i], theme_ids[i]):
            for rank, j in enumerate(ids):
                score[int(j)] = score.get(int(j), 0.0) + 1.0 / (61 + rank)
        chosen, cross_count, same, seen_series = [], 0, 0, set()
        for j, _ in sorted(score.items(), key=lambda kv: -kv[1]):
            if len(chosen) == K:
                break
            if series[j] in seen_series:
                continue
            is_cross = genre[j] != genre[i]
            if is_cross and cross_count >= 7:
                continue
            if not is_cross and sub[j] == sub[i] and same >= 3:
                continue
            chosen.append(j)
            seen_series.add(series[j])
            cross_count += is_cross
            same += (not is_cross) and sub[j] == sub[i]
        while len(chosen) < K:
            for j in cand[i]:
                if int(j) not in chosen and series[int(j)] not in seen_series:
                    chosen.append(int(j))
                    seen_series.add(series[int(j)])
                    break
        mix[i] = chosen

    # Bridge: genre entropy across the premise neighbours, 0-255.
    counts = np.zeros((N, 8), np.float32)
    np.add.at(counts, (np.repeat(np.arange(N), K), genre[across_ids].ravel()), 1.0)
    p = counts / K
    with np.errstate(divide="ignore", invalid="ignore"):
        ent = -np.nansum(np.where(p > 0, p * np.log(p), 0.0), axis=1)
    bridge = np.round(255 * ent / math.log(8)).clip(0, 255).astype(np.uint8)

    # Map: a 3-D projection of the premise embedding keeps spoken-of books near
    # each other, then each continent centre pulls its genre together.
    lower = premise - premise.mean(0)
    pc = np.linalg.svd(lower, full_matrices=False)[2][:3]
    raw3 = premise @ pc.T
    p3 = unit(raw3 / np.maximum(raw3.std(0), 1e-9))
    # Eight continent centres spread over the whole sphere (not one ring), so
    # no region of the globe is left bare.
    golden = math.pi * (3 - math.sqrt(5))
    centres = unit(np.stack([
        [math.cos(golden * g) * math.sqrt(max(0.0, 1 - (1 - 2 * (g + 0.5) / 8) ** 2)),
         1 - 2 * (g + 0.5) / 8,
         math.sin(golden * g) * math.sqrt(max(0.0, 1 - (1 - 2 * (g + 0.5) / 8) ** 2))]
        for g in range(8)]))
    # Uniform sphere base + standardised premise projection + genre pull. The
    # uniform base guarantees even dot spacing; neighbour averaging is omitted
    # because it collapses 50k points into near-coincident clusters.
    idx = np.arange(N)
    gy = 1 - (idx / (N - 1)) * 2
    gr = np.sqrt(np.maximum(0, 1 - gy * gy))
    gth = math.pi * (3 - math.sqrt(5)) * idx
    fib = np.stack([np.cos(gth) * gr, gy, np.sin(gth) * gr], 1).astype(np.float32)
    # Uniform samples inside each genre's spherical cap: full coverage of the
    # sphere with coherent continents (no bare patches, no cross-genre smear).
    cap_angle = math.radians(38)
    centre_rows = centres[genre]
    ref = np.array([0.0, 1.0, 0.0], np.float32)
    tangent1 = unit(np.cross(centre_rows, ref) + np.array([0.0, 0.0, 1e-4], np.float32))
    tangent2 = np.cross(centre_rows, tangent1)
    phi = rng.uniform(0, 2 * math.pi, N)
    cos_t = 1 - rng.uniform(0, 1, N) * (1 - math.cos(cap_angle))
    sin_t = np.sqrt(np.maximum(0, 1 - cos_t**2))
    cap = (centre_rows * cos_t[:, None]
           + (tangent1 * np.cos(phi)[:, None] + tangent2 * np.sin(phi)[:, None]) * sin_t[:, None])
    target = unit(cap + 0.10 * p3)
    lon = ((np.arctan2(target[:, 2], target[:, 0]) / (2 * math.pi)) % 1.0 * 65535).astype(np.uint16)
    lat = ((np.arcsin(np.clip(target[:, 1], -1, 1)) / math.pi + 0.5) * 65535).astype(np.uint16)

    order = np.lexsort((-pop, c["level"]))

    def write(name: str, data: bytes) -> tuple[str, int]:
        digest = hashlib.sha1(data).hexdigest()[:6]
        stem, _, ext = name.rpartition(".")
        hashed = f"{stem}.{digest}.{ext}"
        (OUT / hashed).write_bytes(data)
        return hashed, len(data)

    files: dict[str, str] = {}
    sizes: dict[str, int] = {}

    files["positions"], sizes["positions"] = write(
        "positions.bin", np.stack([lon, lat], 1).astype("<u2").tobytes())

    attrs = np.zeros((N, 14), np.uint8)
    attrs[:, 0] = genre
    attrs[:, 1] = sub
    attrs[:, 2] = genre  # cluster id (one continent per genre in this build)
    attrs[:, 3] = 0  # reserved
    attrs[:, 4] = c["pop"]
    attrs[:, 5:7] = c["year"].view(np.uint8).reshape(N, 2)
    attrs[:, 7] = c["level"]
    attrs[:, 8] = bridge
    attrs[:, 9:14] = mood
    files["attrs"], sizes["attrs"] = write("attrs.bin", attrs.tobytes())

    vocab = "\n".join(c["tag_vocab"]).encode()
    files["tags"], sizes["tags"] = write("tags.bin", vocab)

    strings = bytearray()
    offsets = [0]
    for i in range(N):
        strings += f"{c['titles'][i]}\t{c['authors'][i]}\n".encode()
        offsets.append(len(strings))
    files["strings"], sizes["strings"] = write("strings.bin", bytes(strings))
    files["strings_idx"], sizes["strings_idx"] = write(
        "strings.idx", np.array(offsets, dtype="<u4").tobytes())

    # Strength for the mixed lens is the best strength the book had for that id.
    slot_strength = np.zeros((N, PULL), np.uint8)
    for li, scores in enumerate(lens_scores):
        slots = np.argsort(-scores, axis=1)[:, :K]
        np.put_along_axis(slot_strength, slots, lens_str[li], axis=1)
    mix_slot = np.argmax(cand[:, None, :] == mix[:, :, None], axis=2)
    mix_strength = np.take_along_axis(slot_strength, mix_slot, 1)

    # One neighbour file per 1,024 ranks: ids, strength, flags for all five lenses.
    all_ids = np.stack([mix, closest, across_ids, mood_ids, theme_ids], 1).astype("<u2")
    all_strength = np.stack([mix_strength, lens_str[0], lens_str[1], lens_str[2], lens_str[3]], 1)
    lens_flags = np.zeros((N, 5, K), np.uint8)
    lens_flags |= (genre[all_ids] != genre[:, None, None]).astype(np.uint8)
    lens_flags |= (bridge[all_ids] > 128).astype(np.uint8) << 1
    lens_flags |= (c["level"][all_ids] > 2).astype(np.uint8) << 2

    chunk_sizes = []
    chunk_count = 0
    for start in range(0, N, CHUNK):
        stop = min(start + CHUNK, N)
        raw = (all_ids[start:stop].tobytes() + all_strength[start:stop].tobytes()
               + lens_flags[start:stop].tobytes())
        name, size = write(f"neighbors-{chunk_count}.bin", raw)
        files[f"neighbors.{chunk_count}"] = name
        sizes[f"neighbors.{chunk_count}"] = size
        chunk_sizes.append(size)
        chunk_count += 1

    detail_sizes = []
    for start in range(0, N, 256):
        stop = min(start + 256, N)
        payload = [{
            "t": c["titles"][i], "a": c["authors"][i], "y": int(c["year"][i]),
            "g": int(genre[i]),
            "s": [c["tag_vocab"][t] for t in c["tags"][i] if t >= 0][:8],
            "d": MOTIFS[c["motifs"][i][0]] if c["motifs"][i][0] >= 0 else "",
            "b": int(bridge[i]),
        } for i in range(start, stop)]
        raw = json.dumps(payload, separators=(",", ":")).encode()
        name, size = write(f"details-{start // 256}.json", raw)
        files[f"details.{start // 256}"] = name
        sizes[f"details.{start // 256}"] = size
        detail_sizes.append(size)

    (OUT / "levels.json").write_text(json.dumps(
        {"order": order.tolist(),
         "offsets": np.searchsorted(c["level"][order], np.arange(6), side="left").tolist()}))
    clusters = [{"id": g, "name": GENRES[g][0], "colour": GENRES[g][1],
                 "count": int((genre == g).sum())} for g in range(8)]
    (OUT / "clusters.json").write_text(json.dumps({"radius": 2, "clusters": clusters}))
    (OUT / "manifest.json").write_text(json.dumps({
        "version": 2, "count": N, "chunkSize": CHUNK, "k": K, "lenses": list(LENSES),
        "files": files, "bytes": sizes,
        "rankOrder": "id order in every file; levels.json lists the level/popularity order",
        "generatedAt": "2026-11-10",
        "note": "synthetic corpus: replace pipeline build_corpus with Open Library + BGE + Claude",
    }, separators=(",", ":")))

    # ---- app dataset (public/data, the contract src/data/load.ts reads) ----
    APP = ROOT / "public" / "data"
    APP.mkdir(parents=True, exist_ok=True)
    for stale in APP.iterdir():
        if stale.is_file():
            stale.unlink()

    app_k = K
    (APP / "positions.bin").write_bytes(
        np.round((target + 1) * 0.5 * 65535).clip(0, 65535).astype("<u2").tobytes())

    app_attrs = np.zeros((N, 4), np.uint8)
    app_attrs[:, 0] = genre
    app_attrs[:, 1] = c["pop"]
    app_attrs[:, 2:4] = c["year"].view(np.uint8).reshape(N, 2)
    (APP / "attrs.bin").write_bytes(app_attrs.tobytes())
    (APP / "neighbors.bin").write_bytes(mix.astype("<u4").tobytes())

    app_chunk = 500
    for start in range(0, N, app_chunk):
        stop = min(start + app_chunk, N)
        books = [{"t": c["titles"][i], "a": c["authors"][i], "y": int(c["year"][i]),
                  "g": int(genre[i]), "p": int(pop[i]),
                  "s": [c["tag_vocab"][t] for t in c["tags"][i] if t >= 0][:4]}
                 for i in range(start, stop)]
        (APP / f"meta-{start // app_chunk}.json").write_text(
            json.dumps(books, separators=(",", ":")))

    app_clusters = []
    for g in range(8):
        members = np.flatnonzero(genre == g)
        centroid = unit(target[members].mean(0))
        tag_counts = np.bincount(c["tags"][members].ravel()[c["tags"][members].ravel() >= 0],
                                 minlength=512)
        terms = [c["tag_vocab"][t] for t in np.argsort(-tag_counts)[:3]]
        app_clusters.append({
            "id": g, "name": GENRES[g][0], "genre": g, "color": GENRES[g][1],
            "count": int(len(members)), "terms": terms,
            "centroid": [round(float(v), 4) for v in centroid],
        })
    (APP / "clusters.json").write_text(json.dumps(
        {"generatedAt": "2026-11-10", "radius": 2, "clusters": app_clusters}))

    genre_ids = ["fantasy", "scifi", "romance", "mystery", "literary", "horror",
                 "history", "poetry"]
    (APP / "manifest.json").write_text(json.dumps({
        "version": 2,
        "generatedAt": "2026-11-10",
        "source": "synthetic 50k corpus (pipeline/50k_build.py)",
        "count": N, "chunkSize": app_chunk, "chunks": (N + app_chunk - 1) // app_chunk,
        "neighbors": app_k, "sphereRadius": 2,
        "genres": [{"id": genre_ids[g], "name": GENRES[g][0], "color": GENRES[g][1]}
                   for g in range(8)],
    }, separators=(",", ":")))

    # ---- eval -------------------------------------------------------------
    sample = np.random.default_rng(7).choice(N, 600, replace=False)
    across_rate = float(np.mean(genre[across_ids[sample]] != genre[sample][:, None]))
    mix_cross = float(np.mean([np.mean(genre[mix[i]] != genre[i]) for i in sample]))
    dupes_closest = sum(len({series[int(j)] for j in closest[i]}) != K for i in sample)
    dupes = sum(len({series[int(j)] for j in mix[i]}) != K for i in sample)

    latr = np.deg2rad((lat / 65535) * 180 - 90)
    lonr = np.deg2rad((lon / 65535) * 360 - 180)
    xyz_geo = np.stack([np.cos(latr) * np.cos(lonr), np.sin(latr),
                        np.cos(latr) * np.sin(lonr)], 1).astype(np.float32)
    recall, same_genre = [], []
    for i in np.random.default_rng(3).choice(N, 300, replace=False):
        geo = np.argsort(-(xyz_geo @ xyz_geo[i]))[1:11]
        recall.append(len(set(geo.tolist()) & set(across_ids[i].tolist())) / 10)
        same_genre.append(float((genre[geo] == genre[i]).mean()))
    map_recall = float(np.mean(recall))
    geo_nn = float(np.mean(np.sort(1 - xyz_geo[:2000] @ xyz_geo[:2000].T, 1)[:, 1]))
    geo_genre = float(np.mean(same_genre))

    rows_eval = [
        ("books", f"{N:,}"),
        ("positions.bin", f"{sizes['positions'] / 1024:.1f} KB"),
        ("attrs.bin", f"{sizes['attrs'] / 1024:.1f} KB"),
        ("strings.bin", f"{sizes['strings'] / 1024:.1f} KB"),
        ("tags.bin", f"{sizes['tags'] / 1024:.1f} KB"),
        ("one neighbour chunk", f"{chunk_sizes[0] / 1024:.1f} KB"),
        ("all neighbour chunks", f"{sum(chunk_sizes) / 1024 / 1024:.2f} MB"),
        ("all details chunks", f"{sum(detail_sizes) / 1024 / 1024:.2f} MB"),
        ("across-genre rate (lens 2)", f"{across_rate * 100:.1f}%"),
        ("best-mix cross-genre share", f"{mix_cross * 100:.1f}%"),
        ("books with a series duplicate in closest", f"{dupes_closest} / 600"),
        ("books with a series duplicate in best mix", f"{dupes} / 600"),
        ("premise-neighbour recall@10 (3-D layout, no UMAP)", f"{map_recall * 100:.1f}%"),
        ("map neighbours in the same genre", f"{geo_genre * 100:.1f}%"),
        ("map nearest-neighbour distance", f"{geo_nn:.4f}"),
        ("level offsets", str(np.searchsorted(c["level"][order], np.arange(6), side="left").tolist())),
    ]
    lines = ["# 50k atlas evaluation", "",
             "Synthetic corpus: these numbers validate the pipeline, lens rules and data contract,",
             "not a real catalogue. Swap `build_corpus()` for Open Library + BGE + Claude and rerun.", "",
             "| metric | value |", "|---|---|"]
    lines += [f"| {k} | {v} |" for k, v in rows_eval]
    (ROOT / "pipeline" / "eval.md").write_text("\n".join(lines) + "\n")
    print("\n".join(f"{k}: {v}" for k, v in rows_eval))
    print(f"artifacts: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
