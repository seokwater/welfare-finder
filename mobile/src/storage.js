import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  onboarded: 'wf:onboarded',
  profile: 'wf:profile',
  profiles: 'wf:profiles:v2',
  activeProfileId: 'wf:activeProfileId:v2',
  apiBase: 'wf:apiBase',
  searchSession: 'wf:searchSession',
  searchSessions: 'wf:searchSessions:v2',
  calendarCacheIndex: 'wf:calendarCacheIndex:v1',
}

const PROFILE_FIELDS = ['location', 'age', 'housing', 'employment', 'income']

const CALENDAR_CACHE_PREFIX = 'wf:calendarCache:v1:'
const MAX_CALENDAR_CACHE_ENTRIES = 6
const calendarMemoryCache = new Map()

function calendarCacheKey(apiBase, year, month) {
  const base = String(apiBase || '').trim().replace(/\/$/, '')
  return `${CALENDAR_CACHE_PREFIX}${encodeURIComponent(base)}:${year}-${String(month).padStart(2, '0')}`
}

function parseCalendarCache(raw) {
  try {
    const value = raw ? JSON.parse(raw) : null
    const hasGridRange = typeof value?.data?.range_start === 'string' && typeof value?.data?.range_end === 'string'
    return value?.data && typeof value.data === 'object' && hasGridRange ? value : null
  } catch {
    return null
  }
}

function normalizeProfileData(value) {
  if (!value || typeof value !== 'object') return null
  const data = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, String(value[field] || '').trim()]))
  return Object.values(data).some(Boolean) ? data : null
}

function normalizeProfiles(value) {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry, index) => {
    const data = normalizeProfileData(entry?.data)
    const id = String(entry?.id || '').trim()
    if (!data || !id) return []
    return [{
      id,
      name: String(entry.name || `프로필 ${index + 1}`).trim() || `프로필 ${index + 1}`,
      data,
      createdAt: Number(entry.createdAt) || Date.now(),
      updatedAt: Number(entry.updatedAt) || Date.now(),
    }]
  })
}

function normalizeSearchSession(session) {
  const messages = Array.isArray(session?.messages)
    ? session.messages.filter((message) => (
        ['user', 'assistant'].includes(message?.role)
        && typeof message?.content === 'string'
      ))
    : []
  if (!messages.length) return null
  return {
    messages,
    result: session?.result && typeof session.result === 'object' ? session.result : null,
  }
}

export async function loadAppState() {
  const pairs = await AsyncStorage.multiGet([
    KEYS.onboarded,
    KEYS.profile,
    KEYS.profiles,
    KEYS.activeProfileId,
    KEYS.apiBase,
  ])
  const map = Object.fromEntries(pairs)
  let profiles = []
  try {
    profiles = normalizeProfiles(map[KEYS.profiles] ? JSON.parse(map[KEYS.profiles]) : [])
  } catch {}

  let activeProfileId = map[KEYS.activeProfileId] || ''
  if (!profiles.length) {
    try {
      const legacy = normalizeProfileData(map[KEYS.profile] ? JSON.parse(map[KEYS.profile]) : null)
      if (legacy) {
        const now = Date.now()
        profiles = [{ id: 'profile-migrated', name: '프로필 1', data: legacy, createdAt: now, updatedAt: now }]
        activeProfileId = profiles[0].id
        await AsyncStorage.multiSet([
          [KEYS.profiles, JSON.stringify(profiles)],
          [KEYS.activeProfileId, activeProfileId],
        ])
        await AsyncStorage.removeItem(KEYS.profile)
      }
    } catch {}
  }

  if (!profiles.some((entry) => entry.id === activeProfileId)) {
    activeProfileId = profiles[0]?.id || ''
  }
  const profile = profiles.find((entry) => entry.id === activeProfileId)?.data || null
  return {
    onboarded: map[KEYS.onboarded] === '1',
    profiles,
    activeProfileId,
    profile,
    apiBase: map[KEYS.apiBase] || '',
  }
}

export async function saveOnboarded(value = true) {
  await AsyncStorage.setItem(KEYS.onboarded, value ? '1' : '0')
}

export async function saveProfiles(profiles, activeProfileId) {
  const normalized = normalizeProfiles(profiles)
  const activeId = normalized.some((entry) => entry.id === activeProfileId)
    ? activeProfileId
    : (normalized[0]?.id || '')
  await AsyncStorage.multiSet([
    [KEYS.profiles, JSON.stringify(normalized)],
    [KEYS.activeProfileId, activeId],
  ])
  await AsyncStorage.removeItem(KEYS.profile)
  return { profiles: normalized, activeProfileId: activeId }
}

export async function saveActiveProfileId(profileId) {
  const value = String(profileId || '')
  if (value) await AsyncStorage.setItem(KEYS.activeProfileId, value)
  else await AsyncStorage.removeItem(KEYS.activeProfileId)
  return value
}

export async function saveApiBase(apiBase) {
  const normalized = String(apiBase || '').trim().replace(/\/$/, '')
  if (!normalized) await AsyncStorage.removeItem(KEYS.apiBase)
  else await AsyncStorage.setItem(KEYS.apiBase, normalized)
  return normalized
}

export async function loadSearchSessions() {
  const pairs = await AsyncStorage.multiGet([KEYS.searchSessions, KEYS.searchSession])
  const map = Object.fromEntries(pairs)
  try {
    const parsed = map[KEYS.searchSessions] ? JSON.parse(map[KEYS.searchSessions]) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const sessions = Object.fromEntries(
        Object.entries(parsed).flatMap(([key, session]) => {
          const normalized = normalizeSearchSession(session)
          return normalized ? [[key, normalized]] : []
        }),
      )
      if (Object.keys(sessions).length) return sessions
    }
  } catch {}

  try {
    const legacy = normalizeSearchSession(map[KEYS.searchSession] ? JSON.parse(map[KEYS.searchSession]) : null)
    return legacy ? { __legacy__: legacy } : {}
  } catch {}
  return {}
}

export async function saveSearchSessions(sessions) {
  const normalized = Object.fromEntries(
    Object.entries(sessions || {}).flatMap(([key, session]) => {
      const value = normalizeSearchSession(session)
      return value ? [[key, value]] : []
    }),
  )
  await AsyncStorage.setItem(KEYS.searchSessions, JSON.stringify(normalized))
  await AsyncStorage.removeItem(KEYS.searchSession)
}

export function getCalendarCacheEntry(apiBase, year, month) {
  return calendarMemoryCache.get(calendarCacheKey(apiBase, year, month)) || null
}

export async function loadCalendarCacheEntry(apiBase, year, month) {
  const key = calendarCacheKey(apiBase, year, month)
  const memoryValue = calendarMemoryCache.get(key)
  if (memoryValue) return memoryValue

  const cached = parseCalendarCache(await AsyncStorage.getItem(key))
  if (!cached) return null
  calendarMemoryCache.set(key, cached)
  return cached
}

export async function saveCalendarCache(apiBase, year, month, data, etag = '') {
  const key = calendarCacheKey(apiBase, year, month)
  const entry = { data, etag, savedAt: Date.now() }
  calendarMemoryCache.set(key, entry)
  await AsyncStorage.setItem(key, JSON.stringify(entry))

  let index = []
  try {
    const rawIndex = await AsyncStorage.getItem(KEYS.calendarCacheIndex)
    const parsed = rawIndex ? JSON.parse(rawIndex) : []
    if (Array.isArray(parsed)) index = parsed
  } catch {}

  const nextIndex = [
    { key, savedAt: entry.savedAt },
    ...index.filter((item) => item?.key && item.key !== key),
  ]
  const evicted = nextIndex.slice(MAX_CALENDAR_CACHE_ENTRIES)
  const retained = nextIndex.slice(0, MAX_CALENDAR_CACHE_ENTRIES)
  if (evicted.length) {
    evicted.forEach((item) => calendarMemoryCache.delete(item.key))
    await AsyncStorage.multiRemove(evicted.map((item) => item.key))
  }
  await AsyncStorage.setItem(KEYS.calendarCacheIndex, JSON.stringify(retained))
}

export async function resetAppState() {
  await AsyncStorage.multiRemove([
    KEYS.onboarded,
    KEYS.profile,
    KEYS.profiles,
    KEYS.activeProfileId,
    KEYS.searchSession,
    KEYS.searchSessions,
  ])
}
