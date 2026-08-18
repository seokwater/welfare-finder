import { EMPTY_PROFILE, PROFILE_STEPS } from './profileFlow.js'

export function normalizeProfileData(value) {
  if (!value || typeof value !== 'object') return null
  const data = PROFILE_STEPS.reduce((result, { field }) => ({
    ...result,
    [field]: String(value[field] || '').trim(),
  }), { ...EMPTY_PROFILE })
  return Object.values(data).some(Boolean) ? data : null
}

export function normalizeProfiles(value, now = Date.now()) {
  if (!Array.isArray(value)) return []
  const usedIds = new Set()
  return value.flatMap((entry, index) => {
    const data = normalizeProfileData(entry?.data)
    const id = String(entry?.id || '').trim()
    if (!data || !id || usedIds.has(id)) return []
    usedIds.add(id)
    return [{
      id,
      name: String(entry.name || `프로필 ${index + 1}`).trim() || `프로필 ${index + 1}`,
      data,
      createdAt: Number(entry.createdAt) || now,
      updatedAt: Number(entry.updatedAt) || now,
    }]
  })
}

export function nextProfileName(profiles) {
  const names = new Set((profiles || []).map((entry) => entry.name))
  let index = 1
  while (names.has(`프로필 ${index}`)) index += 1
  return `프로필 ${index}`
}

export function createProfileId(now = Date.now(), random = Math.random()) {
  return `profile-${now}-${random.toString(36).slice(2, 8)}`
}

export function createProfileEntry(profiles, data, options = {}) {
  const normalizedData = normalizeProfileData(data)
  if (!normalizedData) return null
  const now = Number(options.now) || Date.now()
  return {
    id: options.id || createProfileId(now, options.random),
    name: String(options.name || nextProfileName(profiles)).trim() || nextProfileName(profiles),
    data: normalizedData,
    createdAt: now,
    updatedAt: now,
  }
}

export function resolveActiveProfileId(profiles, requestedId) {
  return profiles.some((entry) => entry.id === requestedId) ? requestedId : (profiles[0]?.id || '')
}

export function upsertProfile(profiles, profileId, data, options = {}) {
  const now = Number(options.now) || Date.now()
  const existing = profiles.find((entry) => entry.id === profileId)
  if (!existing) {
    const created = createProfileEntry(profiles, data, { ...options, now })
    return created ? { profiles: [...profiles, created], activeProfileId: created.id } : { profiles, activeProfileId: '' }
  }
  const normalizedData = normalizeProfileData(data)
  if (!normalizedData) return { profiles, activeProfileId: existing.id }
  return {
    profiles: profiles.map((entry) => entry.id === existing.id
      ? { ...entry, data: normalizedData, updatedAt: now }
      : entry),
    activeProfileId: existing.id,
  }
}

export function deleteProfile(profiles, profileId, activeProfileId) {
  const remaining = profiles.filter((entry) => entry.id !== profileId)
  return {
    profiles: remaining,
    activeProfileId: activeProfileId === profileId
      ? (remaining[0]?.id || '')
      : resolveActiveProfileId(remaining, activeProfileId),
  }
}

export function normalizeProfileName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 20)
}

export function renameProfile(profiles, profileId, name, now = Date.now()) {
  const nextName = normalizeProfileName(name)
  if (!nextName) return profiles
  const duplicate = profiles.some((entry) => entry.id !== profileId && entry.name === nextName)
  if (duplicate) return profiles
  return profiles.map((entry) => entry.id === profileId
    ? { ...entry, name: nextName, updatedAt: Number(now) || Date.now() }
    : entry)
}
