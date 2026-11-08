/**
 * Generates the bundled sample dataset (~2,000 books) that ships with the app so it
 * runs without the Python pipeline. Deterministic: the same seed always paints the
 * same globe.
 *
 * Output (public/data):
 *   manifest.json    small, fetched first
 *   clusters.json    continent centroids + names + colours
 *   positions.bin    Uint16 LE xyz per book (unit sphere, magnitude encodes density lift)
 *   attrs.bin        Uint8 genre, Uint8 popularity, Uint16 LE year per book
 *   neighbors.bin    Uint32 LE ids, 20 per book
 *   meta-0..n.json   title/author/year/subjects chunks
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'public', 'data')
const ONLY_IF_MISSING = process.argv.includes('--if-missing')

const SEED = 0x5eed1e55
const TARGET = 2000
const CHUNK = 500
const K = 20
const GENERATED_AT = '2026-11-08T00:00:00.000Z'

const GENRES = [
  { id: 'fantasy', name: 'Fantasy', color: '#B9AEF0' },
  { id: 'scifi', name: 'Science fiction', color: '#A9CDF0' },
  { id: 'romance', name: 'Romance', color: '#F2B6CC' },
  { id: 'mystery', name: 'Mystery', color: '#F5CFA0' },
  { id: 'literary', name: 'Literary', color: '#A8DCC3' },
  { id: 'horror', name: 'Horror', color: '#E3A6A6' },
  { id: 'history', name: 'History', color: '#B8C6F0' },
  { id: 'poetry', name: 'Poetry', color: '#D6C8EB' },
]

const CLUSTERS = [
  {
    name: 'Epic Fantasy',
    genre: 'fantasy',
    count: 160,
    spread: 0.2,
    years: [1975, 2022],
    adj: ['Crownless', 'Ember', 'Thorned', 'Oathbound', 'Gilded', 'Last', 'Storm', 'Wandering'],
    nouns: ['Crown', 'Oath', 'Kingdom', 'Throne', 'Sword', 'Covenant', 'Tower', 'Ember'],
    places: ['Ashen Vale', 'Highmoor', 'the Salt Coast', 'the Broken Isles'],
    subjects: ['epic fantasy', 'quests', 'royal intrigue', 'magic systems', 'dragons', 'wars', 'prophecy'],
  },
  {
    name: 'Folk & Fairy Tales',
    genre: 'fantasy',
    count: 100,
    spread: 0.16,
    years: [1850, 2018],
    adj: ['Little', 'Wild', 'Golden', 'Stolen', 'Hungry', 'Gentle'],
    nouns: ['Fox', 'Hound', 'Lantern', 'Hedge', 'Maid', 'Hare', 'Well', 'Winter'],
    places: ['the Black Forest', 'the Fens', 'a Village', 'the Old Road'],
    subjects: ['fairy tales', 'folklore', 'myth', 'retellings', 'nature', 'villages', 'wonder'],
  },
  {
    name: 'Space Opera',
    genre: 'scifi',
    count: 160,
    spread: 0.19,
    years: [1965, 2024],
    adj: ['Fallen', 'Distant', 'Radiant', 'Silent', 'Iron', 'Far', 'Golden'],
    nouns: ['Empire', 'Fleet', 'Station', 'Sun', 'Cartographer', 'Armada', 'Horizon', 'Colony'],
    places: ['the Outer Ring', 'Kepler Reach', 'the Long Orbit', 'Vega Station'],
    subjects: ['space opera', 'galactic empires', 'starships', 'first contact', 'colonisation', 'aliens', 'war'],
  },
  {
    name: 'Cyberpunk',
    genre: 'scifi',
    count: 120,
    spread: 0.16,
    years: [1980, 2025],
    adj: ['Neon', 'Chrome', 'Static', 'Wire', 'Zero', 'Midnight', 'Ghost'],
    nouns: ['City', 'Signal', 'Protocol', 'Ghost', 'Circuit', 'Sector', 'Rain', 'Stack'],
    places: ['Sector Nine', 'the Sprawl', 'Neon Harbour', 'the Undercity'],
    subjects: ['cyberpunk', 'artificial intelligence', 'hacking', 'corporate power', 'virtual reality', 'dystopia', 'surveillance'],
  },
  {
    name: 'Hard Science Fiction',
    genre: 'scifi',
    count: 80,
    spread: 0.15,
    years: [1970, 2024],
    adj: ['Cold', 'Exact', 'Deep', 'Quiet', 'Strange', 'Slow'],
    nouns: ['Equation', 'Orbit', 'Engine', 'Sea', 'Signal', 'Archive', 'Probe', 'Field'],
    places: ['Europa', 'the Belt', 'Titan', 'the Lagrange Point'],
    subjects: ['hard science fiction', 'physics', 'space exploration', 'astronomy', 'engineering', 'aliens', 'time'],
  },
  {
    name: 'Regency Romance',
    genre: 'romance',
    count: 150,
    spread: 0.15,
    years: [1790, 1935],
    adj: ['Wayward', 'Reluctant', 'Scandalous', 'Borrowed', 'Quiet', 'Wicked'],
    nouns: ['Duke', 'Season', 'Proposal', 'Letter', 'Estate', 'Match', 'Ball', 'Promise'],
    places: ['Bath', 'Mayfair', 'the Country Estate', 'London'],
    subjects: ['regency romance', 'courtship', 'aristocracy', 'marriage', 'manners', 'letters', 'family'],
  },
  {
    name: 'Contemporary Romance',
    genre: 'romance',
    count: 170,
    spread: 0.17,
    years: [1985, 2025],
    adj: ['Second', 'Sweet', 'Honest', 'Summer', 'Almost', 'Unexpected'],
    nouns: ['Summer', 'Bakery', 'Reunion', 'Weekend', 'Apartment', 'Wedding', 'Coast', 'Promise'],
    places: ['the Coast', 'Brooklyn', 'a Small Town', 'Lisbon'],
    subjects: ['contemporary romance', 'friends to lovers', 'second chances', 'small towns', 'food', 'family', 'careers'],
  },
  {
    name: 'Cosy Mystery',
    genre: 'mystery',
    count: 130,
    spread: 0.15,
    years: [1920, 2025],
    adj: ['Missing', 'Quiet', 'Curious', 'Borrowed', 'Tea', 'Clever'],
    nouns: ['Librarian', 'Vicar', 'Garden', 'Recipe', 'Letter', 'Inn', 'Quilt', 'Cat'],
    places: ['a Cathedral Town', 'the Village Green', 'an Island', 'the Bookshop'],
    subjects: ['cosy mystery', 'amateur detectives', 'villages', 'baking', 'secrets', 'friendship', 'England'],
  },
  {
    name: 'Noir & Thriller',
    genre: 'mystery',
    count: 170,
    spread: 0.18,
    years: [1930, 2025],
    adj: ['Cold', 'Last', 'Crooked', 'Dead', 'Grey', 'Silent', 'Bitter'],
    nouns: ['Detective', 'Night', 'Debt', 'Witness', 'Alibi', 'Case', 'City', 'Stranger'],
    places: ['the Docks', 'Los Angeles', 'the Tenth Precinct', 'a Border Town'],
    subjects: ['noir', 'crime', 'investigation', 'murder', 'corruption', 'suspense', 'detectives'],
  },
  {
    name: 'Modernist Fiction',
    genre: 'literary',
    count: 130,
    spread: 0.15,
    years: [1910, 1995],
    adj: ['Quiet', 'Restless', 'Interior', 'Plain', 'Late', 'Small'],
    nouns: ['Room', 'Voice', 'Window', 'Passage', 'Hour', 'Family', 'Letter', 'Dream'],
    places: ['Dublin', 'Paris', 'the Suburbs', 'a Boarding House'],
    subjects: ['modernism', 'stream of consciousness', 'memory', 'interiority', 'urban life', 'time', 'identity'],
  },
  {
    name: 'Family Sagas',
    genre: 'literary',
    count: 120,
    spread: 0.17,
    years: [1945, 2025],
    adj: ['Long', 'House', 'Salt', 'Bitter', 'Inherited', 'Distant'],
    nouns: ['House', 'Orchard', 'Generation', 'Harvest', 'Mill', 'Table', 'Inheritance', 'River'],
    places: ['the Valley', 'a Farm', 'the Old Mill', 'the Coast'],
    subjects: ['family sagas', 'generations', 'inheritance', 'rural life', 'migration', 'secrets', 'home'],
  },
  {
    name: 'Gothic Horror',
    genre: 'horror',
    count: 100,
    spread: 0.15,
    years: [1790, 2010],
    adj: ['Haunted', 'Pale', 'Silent', 'Bleeding', 'Grey', 'Locked'],
    nouns: ['House', 'Portrait', 'Abbey', 'Garden', 'Bride', 'Curse', 'Cellar', 'Fog'],
    places: ['the Moors', 'Blackwater Abbey', 'a Cliffside House', 'the Ruined Chapel'],
    subjects: ['gothic', 'hauntings', 'mansions', 'the supernatural', 'secrets', 'Victorian', 'ghosts'],
  },
  {
    name: 'Cosmic Horror',
    genre: 'horror',
    count: 70,
    spread: 0.15,
    years: [1900, 2024],
    adj: ['Nameless', 'Vast', 'Frozen', 'Hollow', 'Unquiet', 'Deep'],
    nouns: ['Thing', 'Abyss', 'Expedition', 'Tide', 'Void', 'Signal', 'Ritual', 'Deep'],
    places: ['the Antarctic', 'a Fishing Village', 'the Deep', 'the Observatory'],
    subjects: ['cosmic horror', 'the unknown', 'madness', 'expeditions', 'cultists', 'existential dread', 'monsters'],
  },
  {
    name: 'Ancient World',
    genre: 'history',
    count: 110,
    spread: 0.16,
    years: [1960, 2024],
    adj: ['First', 'Lost', 'Bronze', 'Roman', 'Forgotten', 'Distant'],
    nouns: ['Empire', 'Legion', 'City', 'Republic', 'Road', 'Chronicle', 'Tide', 'Archive'],
    places: ['Carthage', 'the Aegean', 'Pompeii', 'the Nile Delta'],
    subjects: ['ancient history', 'Rome', 'empires', 'archaeology', 'trade', 'warfare', 'archives'],
  },
  {
    name: 'Lives & Letters',
    genre: 'history',
    count: 90,
    spread: 0.16,
    years: [1950, 2025],
    adj: ['Private', 'Unfinished', 'Selected', 'Restless', 'Ordinary', 'Late'],
    nouns: ['Letters', 'Life', 'Diaries', 'Years', 'Portrait', 'Journals', 'Memoir', 'Circle'],
    places: ['Vienna', 'the Archive', 'a Country House', 'Berlin'],
    subjects: ['biography', 'diaries', 'letters', 'twentieth century', 'artists', 'politics', 'memory'],
  },
  {
    name: 'Nature Verse',
    genre: 'poetry',
    count: 60,
    spread: 0.14,
    years: [1800, 2000],
    adj: ['Small', 'Green', 'Winter', 'Bright', 'Slow', 'Wild'],
    nouns: ['Field', 'Bird', 'Rain', 'Garden', 'Season', 'River', 'Leaf', 'Light'],
    places: ['the Meadow', 'a Lakeshore', 'the Wood', 'the Orchard'],
    subjects: ['nature poetry', 'seasons', 'landscape', 'birds', 'rural life', 'lyric', 'stillness'],
  },
  {
    name: 'Modern Poetry',
    genre: 'poetry',
    count: 80,
    spread: 0.15,
    years: [1950, 2025],
    adj: ['Blue', 'Fractured', 'Afternoon', 'Ordinary', 'Bright', 'Other'],
    nouns: ['Hour', 'Body', 'City', 'Window', 'Song', 'Language', 'Mouth', 'Weather'],
    places: ['the City', 'a Kitchen', 'the Coast', 'a Hotel Room'],
    subjects: ['modern poetry', 'experimental form', 'city life', 'love', 'grief', 'language', 'fragments'],
  },
]

const FIRST = [
  'Ada', 'Mira', 'Eleanor', 'Jonas', 'Ines', 'Theo', 'Ruth', 'Samir', 'Nora', 'Luca',
  'Yara', 'Ellis', 'Maeve', 'Tomas', 'Priya', 'Hugo', 'Signe', 'Amara', 'Felix', 'Dara',
  'June', 'Oskar', 'Leila', 'Rafael', 'Edith', 'Kai', 'Marisol', 'Anton', 'Nadia', 'Wren',
  'Clara', 'Idris', 'Hana', 'Soren', 'Alma', 'Dmitri', 'Saoirse', 'Mateo', 'Iris', 'Bo',
  'Talia', 'Emil', 'Rosa', 'Nils', 'Anouk', 'Cyrus', 'Lena', 'Kwame', 'Vera', 'August',
]
const LAST = [
  'Vance', 'Okoro', 'Lindqvist', 'Moreau', 'Hale', 'Petrov', 'Ibarra', 'Wren', 'Adeyemi', 'Kessler',
  'Marchetti', 'Novak', 'Duarte', 'Sinclair', 'Rahimi', 'Bell', 'Kowalski', 'Ferreira', 'Nakamura', 'Ashby',
  'Osei', 'Lindgren', 'Beaumont', 'Sato', 'Voss', 'Amari', 'Quill', 'Hollis', 'Brandt', 'Solorzano',
  'Kerr', 'Basile', 'Nystrom', 'Delacroix', 'Banda', 'Fenwick', 'Rossi', 'Achebe', 'Marsh', 'Varga',
]

const rng = mulberry32(SEED)
const gauss = () => {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const pick = (list) => list[Math.floor(rng() * list.length)]
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fibonacciSphere(n) {
  const pts = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r])
  }
  return pts
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

function tangents(dir) {
  const up = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]
  const t1 = normalize([
    up[1] * dir[2] - up[2] * dir[1],
    up[2] * dir[0] - up[0] * dir[2],
    up[0] * dir[1] - up[1] * dir[0],
  ])
  const t2 = normalize([
    dir[1] * t1[2] - dir[2] * t1[1],
    dir[2] * t1[0] - dir[0] * t1[2],
    dir[0] * t1[1] - dir[1] * t1[0],
  ])
  return [t1, t2]
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = clamp(((n >> 16) & 255) + amount, 0, 255)
  const g = clamp(((n >> 8) & 255) + amount, 0, 255)
  const b = clamp((n & 255) + amount, 0, 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

const bools = { fantasy: 0, scifi: 1, romance: 2, mystery: 3, literary: 4, horror: 5, history: 6, poetry: 7 }

function main() {
  const genreDirs = fibonacciSphere(GENRES.length)
  const books = []
  const clusters = []

  CLUSTERS.forEach((theme, ci) => {
    const gi = bools[theme.genre]
    const base = genreDirs[gi]
    const [t1, t2] = tangents(base)
    const centre = normalize([
      base[0] + (t1[0] * gauss() + t2[0] * gauss()) * 0.3,
      base[1] + (t1[1] * gauss() + t2[1] * gauss()) * 0.3,
      base[2] + (t1[2] * gauss() + t2[2] * gauss()) * 0.3,
    ])
    const [c1, c2] = tangents(centre)
    const color = shade(GENRES[gi].color, (ci % 3) * 8 - 8)
    const seen = new Set()
    const start = books.length

    for (let i = 0; i < theme.count; i++) {
      let title = ''
      for (let attempt = 0; attempt < 12 && (!title || seen.has(title)); attempt++) {
        const r = rng()
        const a = pick(theme.adj)
        const n = pick(theme.nouns)
        const n2 = pick(theme.nouns)
        const p = pick(theme.places)
        title =
          r < 0.32
            ? `The ${a} ${n}`
            : r < 0.5
              ? `${a} ${n}`
              : r < 0.68
                ? `The ${n} of ${p}`
                : r < 0.85
                  ? `${n} & ${n2}`
                  : `A ${a} ${n}`
        if (seen.has(title)) title = ''
      }
      if (!title) title = `The ${pick(theme.nouns)} ${start + i}`

      seen.add(title)
      const year = Math.round(
        theme.years[0] + rng() * (theme.years[1] - theme.years[0]) + gauss() * 4,
      )
      const subjectPool = [...theme.subjects]
      const subjects = []
      for (let s = 0; s < 4 && subjectPool.length; s++) {
        subjects.push(subjectPool.splice(Math.floor(rng() * subjectPool.length), 1)[0])
      }
      subjects.push(GENRES[gi].name.toLowerCase())

      const spread = theme.spread * (0.65 + rng() * 0.7)
      const scatter = 0.14 + spread * 1.5
      const dir = normalize([
        centre[0] + c1[0] * gauss() * scatter + c2[0] * gauss() * scatter,
        centre[1] + c1[1] * gauss() * scatter + c2[1] * gauss() * scatter,
        centre[2] + c1[2] * gauss() * scatter + c2[2] * gauss() * scatter,
      ])

      books.push({
        dir,
        title,
        author: `${pick(FIRST)} ${pick(LAST)}`,
        year: clamp(year, 1450, 2025),
        genre: gi,
        cluster: ci,
        popularity: Math.round(Math.pow(rng(), 1.9) * 99) + 1,
        subjects,
      })
    }

    const members = books.slice(start)
    const sum = members.reduce(
      (acc, b) => [acc[0] + b.dir[0], acc[1] + b.dir[1], acc[2] + b.dir[2]],
      [0, 0, 0],
    )
    clusters.push({
      id: ci,
      name: theme.name,
      genre: gi,
      color,
      count: members.length,
      centroid: normalize(sum),
      terms: theme.subjects.slice(0, 3),
    })
  })

  // Shuffle so lazy metadata chunks cover every continent.
  for (let i = books.length - 1; i > 1; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[books[i], books[j]] = [books[j], books[i]]
  }

  // Local density (mean distance to 8 nearest) lifts crowded regions slightly.
  const lift = new Float32Array(books.length)
  const dists = new Float32Array(books.length)
  for (let i = 0; i < books.length; i++) {
    const a = books[i].dir
    let count = 0
    let sum = 0
    for (let j = 0; j < books.length; j += 1) {
      if (i === j) continue
      const b = books[j].dir
      const dx = a[0] - b[0]
      const dy = a[1] - b[1]
      const dz = a[2] - b[2]
      const nd = 1 - (dx * dx + dy * dy + dz * dz) / 2
      if (count < 8) {
        dists[count++] = nd
        if (count === 8) dists.sort((x, y) => x - y)
      } else if (nd < dists[7]) {
        dists[7] = nd
        dists.sort((x, y) => x - y)
      }
      sum += nd
    }
    lift[i] = sum
  }
  const maxLift = Math.max(...lift)
  const minLift = Math.min(...lift)

  // Neighbours over the 3D map, like the HNSW step of the real pipeline.
  const neighbours = new Uint32Array(books.length * K)
  for (let i = 0; i < books.length; i++) {
    const scored = []
    const a = books[i].dir
    for (let j = 0; j < books.length; j++) {
      if (i === j) continue
      const b = books[j].dir
      const dx = a[0] - b[0]
      const dy = a[1] - b[1]
      const dz = a[2] - b[2]
      scored.push([dx * dx + dy * dy + dz * dz, j])
    }
    scored.sort((x, y) => x[0] - y[0])
    for (let k = 0; k < K; k++) neighbours[i * K + k] = scored[k][1]
  }

  const n = books.length
  const positions = Buffer.alloc(n * 6)
  const attrs = Buffer.alloc(n * 4)
  const neighbourBuf = Buffer.alloc(n * K * 4)
  const meta = new Array(n)

  for (let i = 0; i < n; i++) {
    const b = books[i]
    const density = (lift[i] - minLift) / (maxLift - minLift || 1)
    const radius = 1 + density * 0.012
    for (let c = 0; c < 3; c++) {
      const v = clamp((b.dir[c] * radius + 1) / 2, 0, 1)
      positions.writeUInt16LE(Math.round(v * 65535), i * 6 + c * 2)
    }
    attrs.writeUInt8(b.genre, i * 4)
    attrs.writeUInt8(b.popularity, i * 4 + 1)
    attrs.writeUInt16LE(b.year, i * 4 + 2)
    for (let k = 0; k < K; k++) neighbourBuf.writeUInt32LE(neighbours[i * K + k], (i * K + k) * 4)
    meta[i] = { t: b.title, a: b.author, y: b.year, g: b.genre, p: b.popularity, s: b.subjects }
  }

  const chunks = Math.ceil(n / CHUNK)
  const manifest = {
    version: 1,
    generatedAt: GENERATED_AT,
    source: 'synthetic sample',
    count: n,
    chunkSize: CHUNK,
    chunks,
    neighbors: K,
    sphereRadius: 2,
    genres: GENRES,
  }

  const clusterJson = {
    generatedAt: GENERATED_AT,
    radius: 2,
    clusters: clusters.map((c) => ({
      id: c.id,
      name: c.name,
      genre: c.genre,
      color: c.color,
      count: c.count,
      terms: c.terms,
      centroid: c.centroid.map((v) => Number(v.toFixed(5))),
    })),
  }

  const writes = [
    writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest)),
    writeFile(join(OUT, 'clusters.json'), JSON.stringify(clusterJson)),
    writeFile(join(OUT, 'positions.bin'), positions),
    writeFile(join(OUT, 'attrs.bin'), attrs),
    writeFile(join(OUT, 'neighbors.bin'), neighbourBuf),
  ]
  for (let c = 0; c < chunks; c++) {
    writes.push(
      writeFile(join(OUT, `meta-${c}.json`), JSON.stringify(meta.slice(c * CHUNK, (c + 1) * CHUNK))),
    )
  }

  return Promise.all(writes).then(() => {
    const metaSize = meta.reduce((acc, m) => acc + JSON.stringify(m).length, 0)
    console.log(
      `[sample] ${n} books · ${clusters.length} continents · positions ${(positions.length / 1024).toFixed(1)} KB · attrs ${(attrs.length / 1024).toFixed(1)} KB · neighbours ${(neighbourBuf.length / 1024).toFixed(1)} KB · meta ${(metaSize / 1024).toFixed(0)} KB in ${chunks} chunks`,
    )
  })
}

async function run() {
  await mkdir(OUT, { recursive: true })
  if (ONLY_IF_MISSING) {
    try {
      await access(join(OUT, 'manifest.json'))
      console.log('[sample] dataset present, skipping')
      return
    } catch {
      /* generate */
    }
  }
  await main()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
