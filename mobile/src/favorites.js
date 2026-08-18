const MAX_FAVORITES_PER_PROFILE = 50

export function policyFavoriteId(item) {
  const policy = item?.policy || {}
  return String(
    policy['정책번호']
    || policy.id
    || policy.detail_url
    || policy['신청URL']
    || policy['정책명']
    || '',
  ).trim()
}

export function normalizeFavoritePolicies(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([profileId, entries]) => {
    if (!profileId || !Array.isArray(entries)) return []
    const usedIds = new Set()
    const normalized = entries.flatMap((entry) => {
      const item = entry?.item || entry
      const id = policyFavoriteId(item)
      if (!id || usedIds.has(id)) return []
      usedIds.add(id)
      return [{ id, item, savedAt: Number(entry?.savedAt) || Date.now() }]
    }).slice(0, MAX_FAVORITES_PER_PROFILE)
    return normalized.length ? [[profileId, normalized]] : []
  }))
}

export function isFavoritePolicy(entries, item) {
  const id = policyFavoriteId(item)
  return Boolean(id && (entries || []).some((entry) => entry.id === id))
}

export function toggleFavoritePolicy(value, profileId, item, now = Date.now()) {
  const normalized = normalizeFavoritePolicies(value)
  const id = policyFavoriteId(item)
  if (!profileId || !id) return normalized
  const current = normalized[profileId] || []
  const exists = current.some((entry) => entry.id === id)
  const next = exists
    ? current.filter((entry) => entry.id !== id)
    : [{ id, item, savedAt: Number(now) || Date.now() }, ...current].slice(0, MAX_FAVORITES_PER_PROFILE)
  const result = { ...normalized }
  if (next.length) result[profileId] = next
  else delete result[profileId]
  return result
}

export function removeProfileFavorites(value, profileId) {
  const normalized = normalizeFavoritePolicies(value)
  const next = { ...normalized }
  delete next[profileId]
  return next
}
