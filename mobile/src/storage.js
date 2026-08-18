import AsyncStorage from '@react-native-async-storage/async-storage'
import { legacySessionToSearchState, normalizeSearchState } from './searchHistory'

const KEYS = {
  onboarded: 'wf:onboarded',
  profile: 'wf:profile',
  apiBase: 'wf:apiBase',
  searchState: 'wf:searchConversations:v1',
  legacySearchSession: 'wf:searchSession',
  calendarCacheIndex: 'wf:calendarCacheIndex:v1',
}

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

export async function loadAppState() {
  const pairs = await AsyncStorage.multiGet([KEYS.onboarded, KEYS.profile, KEYS.apiBase])
  const map = Object.fromEntries(pairs)
  let profile = null
  try {
    profile = map[KEYS.profile] ? JSON.parse(map[KEYS.profile]) : null
  } catch {
    profile = null
  }
  return {
    onboarded: map[KEYS.onboarded] === '1',
    profile,
    apiBase: map[KEYS.apiBase] || '',
  }
}

export async function saveOnboarded(value = true) {
  await AsyncStorage.setItem(KEYS.onboarded, value ? '1' : '0')
}

export async function saveProfile(profile) {
  if (!profile) {
    await AsyncStorage.removeItem(KEYS.profile)
    return
  }
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile))
}

export async function saveApiBase(apiBase) {
  const normalized = String(apiBase || '').trim().replace(/\/$/, '')
  if (!normalized) await AsyncStorage.removeItem(KEYS.apiBase)
  else await AsyncStorage.setItem(KEYS.apiBase, normalized)
  return normalized
}

function parseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function loadSearchState() {
  const saved = parseJson(await AsyncStorage.getItem(KEYS.searchState))
  if (saved?.conversations?.length) return normalizeSearchState(saved)

  const legacyRaw = await AsyncStorage.getItem(KEYS.legacySearchSession)
  const migrated = legacySessionToSearchState(parseJson(legacyRaw))
  if (!migrated) {
    if (legacyRaw) await AsyncStorage.removeItem(KEYS.legacySearchSession)
    return null
  }

  await AsyncStorage.setItem(KEYS.searchState, JSON.stringify(migrated))
  await AsyncStorage.removeItem(KEYS.legacySearchSession)
  return migrated
}

export async function saveSearchState(state) {
  await AsyncStorage.setItem(KEYS.searchState, JSON.stringify(normalizeSearchState(state)))
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
  await AsyncStorage.multiRemove([KEYS.onboarded, KEYS.profile, KEYS.searchState, KEYS.legacySearchSession])
}
