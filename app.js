// Configuration
const CSV_URL = './public/data.csv'
const EMB_URL = './public/embeddings.json' // optional

let ROWS = [] // [{country, code, series:{year: value}, latestYear, latestGDP}]
let YEARS = [] // ["1960",..."2020"]
let LUNR_INDEX = null // keyword index
let EMBEDDINGS = null // [[...] ...]  (optional) per ROWS index

// ------------ boot ------------
document.addEventListener('DOMContentLoaded', boot)

async function boot() {
  // load CSV
  await loadCSV()
  // load embeddings (optional)
  await loadEmbeddings()
  // build keyword index
  buildLunrIndex()

  // status
  document.getElementById('rows').textContent = `Rows: ${ROWS.length}`
  document.getElementById('years').textContent = `Years: ${YEARS[0]}–${
    YEARS[YEARS.length - 1]
  }`
  document.getElementById('emb').textContent = `Embeddings: ${
    EMBEDDINGS ? 'loaded' : 'not loaded'
  }`

  // wire UI
  document.getElementById('go').addEventListener('click', runAll)
  document.getElementById('q').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runAll()
  })
}

// ------------ load & prep CSV ------------
async function loadCSV() {
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`)
  const text = await res.text()

  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  const header = parsed.meta.fields

  // years are any numeric columns except country fields
  YEARS = header.filter((h) => /^\d{4}$/.test(h))

  ROWS = parsed.data.map((row) => {
    const series = {}
    YEARS.forEach((y) => {
      // numbers may be like 1.01E+12 or empty
      const v = row[y] === '' ? null : Number(row[y])
      series[y] = isNaN(v) ? null : v
    })
    // latest non-null
    let latestYear = null,
      latestGDP = null
    for (let i = YEARS.length - 1; i >= 0; i--) {
      const y = YEARS[i]
      if (series[y] != null) {
        latestYear = y
        latestGDP = series[y]
        break
      }
    }
    return {
      country: row['Country Name'],
      code: row['Country Code'],
      series,
      latestYear,
      latestGDP,
    }
  })
}

// ------------ optional embeddings ------------
async function loadEmbeddings() {
  try {
    const res = await fetch(EMB_URL)
    if (!res.ok) return
    EMBEDDINGS = await res.json()
    if (EMBEDDINGS.length !== ROWS.length) {
      console.warn(
        'embeddings.json length mismatch with rows; disabling semantics.'
      )
      EMBEDDINGS = null
    }
  } catch (e) {
    /* optional */
  }
}

// ------------ keyword index (lunr) ------------
function buildLunrIndex() {
  LUNR_INDEX = lunr(function () {
    this.ref('id')
    this.field('country')
    this.field('code')
    // lightweight “doc” per row
    ROWS.forEach((r, i) => {
      this.add({ id: i, country: r.country, code: r.code })
    })
  })
}

function keywordSearch(q, k) {
  const hits = LUNR_INDEX.search(q || '')
  return hits.slice(0, k).map((h) => Number(h.ref))
}

// ------------ semantic search (cosine over precomputed) ------------
function semanticSearch(q, k) {
  if (!EMBEDDINGS) return []
  // very small trick: create a pseudo-embedding by TF on tokens via lunr scoring as proxy
  // Better: precompute query embeddings offline and ship; or run a web model.
  const kw = keywordSearch(q, Math.max(k, 30)) // many candidates
  // Score by closeness to the centroid of their embeddings for a crude semantic-ish proxy
  const vecs = kw.map((i) => EMBEDDINGS[i])
  if (!vecs.length) return []
  const centroid = averageVec(vecs)
  const scored = EMBEDDINGS.map((v, idx) => ({ idx, s: cosine(v, centroid) }))
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, k).map((x) => x.idx)
}
function averageVec(vectors) {
  const out = new Array(vectors[0].length).fill(0)
  vectors.forEach((v) => {
    for (let i = 0; i < v.length; i++) out[i] += v[i]
  })
  for (let i = 0; i < out.length; i++) out[i] /= vectors.length
  return out
}

// ------------ RRF ------------
function rrfFuse(q, k) {
  const a = keywordSearch(q, k)
  const b = semanticSearch(q, k)
  return rrf(a, b, k, 60)
}

// ------------ answer (no LLM, computed) ------------
function computeAnswer(query) {
  // patterns:
  // - "gdp of <country> [in] <year>"
  // - "highest gdp <year>"
  // - "top <N> <year>"
  const lc = (query || '').toLowerCase()

  const yearMatch = lc.match(/(19|20)\d{2}/)
  const year = yearMatch ? yearMatch[0] : null

  const topMatch = lc.match(/top\s+(\d{1,3})/)
  const topN = topMatch
    ? Math.max(1, Math.min(50, parseInt(topMatch[1], 10)))
    : 5

  const ofMatch = lc.match(/gdp\s+of\s+(.+?)(?:\s+in\s+(19|20)\d{2}|$)/)
  if (ofMatch) {
    const name = ofMatch[1].trim()
    // find the best country by keyword
    const idxs = keywordSearch(name, 1)
    if (!idxs.length) return `No match found for "${name}".`
    const row = ROWS[idxs[0]]
    const y = year || row.latestYear
    const val = row.series[y] ?? null
    return val == null
      ? `No GDP value for ${row.country} in ${y}.`
      : `GDP of ${row.country} in ${y}: ${formatUSD(val)}.`
  }

  if (lc.includes('highest gdp') || lc.includes('largest gdp')) {
    const y = year || latestCommonYear()
    const ranked = rankByYear(y).slice(0, 5)
    const lines = ranked.map(
      (r, i) => `${i + 1}. ${r.country}: ${formatUSD(r.value)}`
    )
    return `Highest GDP in ${y}:\n` + lines.join('\n')
  }

  if (topMatch) {
    const y = year || latestCommonYear()
    const ranked = rankByYear(y).slice(0, topN)
    const lines = ranked.map(
      (r, i) => `${i + 1}. ${r.country}: ${formatUSD(r.value)}`
    )
    return `Top ${topN} GDP in ${y}:\n` + lines.join('\n')
  }

  // default: show best guess (latest top 5)
  const y = latestCommonYear()
  const ranked = rankByYear(y).slice(0, 5)
  const lines = ranked.map(
    (r, i) => `${i + 1}. ${r.country}: ${formatUSD(r.value)}`
  )
  return `Top 5 GDP in ${y}:\n` + lines.join('\n')
}

function latestCommonYear() {
  // latest year where at least, say, 50 countries have data
  for (let i = YEARS.length - 1; i >= 0; i--) {
    const y = YEARS[i]
    let count = 0
    ROWS.forEach((r) => {
      if (r.series[y] != null) count++
    })
    if (count >= 50) return y
  }
  return YEARS[YEARS.length - 1]
}

function rankByYear(y) {
  const out = []
  ROWS.forEach((r) => {
    const v = r.series[y]
    if (v != null)
      out.push({
        country: r.country,
        code: r.code,
        value: v,
        idx: ROWS.indexOf(r),
      })
  })
  out.sort((a, b) => b.value - a.value)
  return out
}

// ------------ RAG context formatting ------------
function buildContext(indices) {
  const blocks = indices.map((i) => {
    const r = ROWS[i]
    const latest = r.latestYear
    const latestVal = r.latestGDP
    // fabricate a useful description
    const y0 = '2000',
      y1 = '2010',
      y2 = '2020'
    const d0 = r.series[y0],
      d1 = r.series[y1],
      d2 = r.series[y2]
    const desc = `GDP snapshot — ${y0}: ${formatUSD(d0)}, ${y1}: ${formatUSD(
      d1
    )}, ${y2}: ${formatUSD(d2)} (latest ${latest}: ${formatUSD(latestVal)})`
    const url = `https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=${r.code}`
    return `Title: ${r.country}, Description: ${desc}, Published at: ${latest}\nURL: ${url}`
  })
  return blocks.join('\n')
}

// ------------ run ------------
function runAll() {
  const q = document.getElementById('q').value.trim()
  const k = Math.max(
    1,
    Math.min(50, parseInt(document.getElementById('k').value || '5', 10))
  )
  const mode = document.getElementById('mode').value

  // ANSWER (computed)
  document.getElementById('answer').textContent = computeAnswer(q)

  // RETRIEVALS
  const kwIdx = keywordSearch(q, k)
  const semIdx = semanticSearch(q, k)
  const rrfIdx = rrfFuse(q, k)

  document.getElementById('kw').textContent = prettyList(kwIdx)
  document.getElementById('sem').textContent = EMBEDDINGS
    ? prettyList(semIdx)
    : 'Semantic disabled (no embeddings.json)'
  document.getElementById('rrf').textContent = prettyList(rrfIdx)

  // CONTEXT
  const which =
    mode === 'keyword' ? kwIdx : mode === 'semantic' ? semIdx : rrfIdx
  document.getElementById('context').value = buildContext(which)
}

function prettyList(ids) {
  const lines = ids.map((i, n) => {
    const r = ROWS[i]
    return `${n + 1}. ${r.country} (${r.code}) — latest ${
      r.latestYear
    }: ${formatUSD(r.latestGDP)}`
  })
  return lines.join('\n')
}
