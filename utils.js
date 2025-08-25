// --- math helpers ---
function dot(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}
function norm(a) {
  return Math.sqrt(dot(a, a)) || 1e-9
}
function cosine(a, b) {
  return dot(a, b) / (norm(a) * norm(b))
}

// --- RRF ---
function rrf(list1, list2, topK = 5, K = 60) {
  const scores = new Map()
  for (const lst of [list1, list2]) {
    lst.forEach((id, i) => {
      scores.set(id, (scores.get(id) || 0) + 1 / (K + (i + 1)))
    })
  }
  return Array.from(scores.keys())
    .sort((a, b) => scores.get(b) - scores.get(a))
    .slice(0, topK)
}

// --- number formatting ---
function formatUSD(x) {
  if (x == null || isNaN(x)) return '—'
  const abs = Math.abs(x)
  if (abs >= 1e12) return `$${(x / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `$${(x / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(x / 1e6).toFixed(2)}M`
  return `$${x.toLocaleString()}`
}
