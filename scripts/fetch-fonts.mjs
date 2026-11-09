#!/usr/bin/env node
/**
 * Fetch the two self-hosted families into public/fonts when they are missing.
 *
 * The woff2 files are deliberately not committed: this keeps the repository
 * text-only while the Pages build still serves locally-hosted fonts (no runtime
 * Google/Fontshare dependency). Existing files are left untouched.
 */
import { access, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'public', 'fonts')
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const TARGETS = [
  { file: 'fraunces-var.woff2', source: 'fraunces' },
  { file: 'satoshi-1.woff2', source: 'satoshi', index: 0 },
  { file: 'satoshi-2.woff2', source: 'satoshi', index: 1 },
  { file: 'satoshi-3.woff2', source: 'satoshi', index: 2 },
]

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function css(url) {
  const response = await fetch(url, { headers: { 'user-agent': UA } })
  if (!response.ok) throw new Error(`${response.status} for ${url}`)
  return response.text()
}

async function main() {
  await mkdir(OUT, { recursive: true })

  const missing = []
  for (const target of TARGETS) {
    if (await exists(join(OUT, target.file))) continue
    missing.push(target)
  }
  if (!missing.length) {
    console.log('[fonts] already present')
    return
  }

  const sources = {}
  if (missing.some((target) => target.source === 'fraunces')) {
    const sheet = await css(
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&display=swap',
    )
    const urls = [...sheet.matchAll(/https:\/\/[^)]+\.woff2/g)].map((match) => match[0])
    if (!urls.length) throw new Error('no Fraunces woff2 found')
    sources.fraunces = [urls[urls.length - 1]]
  }
  if (missing.some((target) => target.source === 'satoshi')) {
    const sheet = await css(
      'https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap',
    )
    const urls = [...sheet.matchAll(/\/\/cdn\.fontshare\.com[^)]+\.woff2/g)].map(
      (match) => `https:${match[0]}`,
    )
    if (urls.length < 3) throw new Error(`expected 3 Satoshi woff2, found ${urls.length}`)
    sources.satoshi = urls
  }

  for (const target of missing) {
    const list = sources[target.source]
    const url = target.index == null ? list[0] : list[target.index]
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${response.status} for ${url}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(join(OUT, target.file), buffer)
    console.log(`[fonts] ${target.file} ${(buffer.length / 1024).toFixed(0)} KB`)
  }
}

main().catch((error) => {
  console.error('[fonts] failed:', error.message)
  // Fonts are cosmetic: never fail the build if a CDN is unreachable.
  process.exitCode = 0
})
