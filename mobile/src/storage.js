import AsyncStorage from '@react-native-async-storage/async-storage'
import { legacySessionToSearchState, normalizeSearchState } from './searchHistory'
import { createProfileEntry, normalizeProfiles, resolveActiveProfileId } from './profiles'
import { normalizeFavoritePolicies } from './favorites'

const KEYS = {
  onboarded: 'wf:onboarded',
  profile: 'wf:profile',
  profiles: 'wf:profiles:v3',
  activeProfileId: 'wf:activeProfileId:v3',
  legacyProfiles: 'wf:profiles:v2',
  legacyActiveProfileId: 'wf:activeProfileId:v2',
  apiBase: 'wf:apiBase',
  profileSearchStates: 'wf:profileSearchConversations:v2',
  searchState: 'wf:searchConversations:v1',
  legacySearchSession: 'wf:searchSession',
  legacyProfileSearchSessions: 'wf:searchSessions:v2',
  calendarCacheIndex: 'wf:calendarCacheIndex:v1',
  homeCacheIndex: 'wf:homeCacheIndex:v1',
  favoritePolicies: 'wf:favoritePolicies:v1',
  notificationSettings: 'wf:notificationSettings:v1',
}

export const DEFAULT_NOTIFICATION_SETTINGS = {
  newMatchingPolicies: true,
  deadlineReminders: true,
}

const CALENDAR_CACHE_PREFIX = 'wf:calendarCache:v1:'
const HOME_CACHE_PREFIX = 'wf:homeCache:v1:'
const MAX_CALENDAR_CACHE_ENTRIES = 8
const MAX_HOME_CACHE_ENTRIES = 8
export const HOME_CACHE_FRESH_MS = 5 * 60 * 1000
const calendarMemoryCache = new Map()
const homeMemoryCache = new Map()
let calendarCacheIndexWrite = Promise.resolve()

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
  const pairs = await AsyncStorage.multiGet([
    KEYS.onboarded,
    KEYS.profile,
    KEYS.profiles,
    KEYS.activeProfileId,
    KEYS.legacyProfiles,
    KEYS.legacyActiveProfileId,
    KEYS.apiBase,
  ])
  const map = Object.fromEntries(pairs)
  let profiles = []
  let activeProfileId = map[KEYS.activeProfileId] || ''
  try {
    profiles = normalizeProfiles(parseJson(map[KEYS.profiles]))
  } catch {}

  let migrated = false
  if (!profiles.length) {
    try {
      profiles = normalizeProfiles(parseJson(map[KEYS.legacyProfiles]))
      activeProfileId = map[KEYS.legacyActiveProfileId] || ''
      migrated = profiles.length > 0
    } catch {}
  }
  if (!profiles.length) {
    const legacyProfile = parseJson(map[KEYS.profile])
    const entry = createProfileEntry([], legacyProfile, {
      id: 'profile-migrated',
      name: '프로필 1',
    })
    if (entry) {
      profiles = [entry]
      activeProfileId = entry.id
      migrated = true
    }
  }

  activeProfileId = resolveActiveProfileId(profiles, activeProfileId)
  if (migrated) await saveProfiles(profiles, activeProfileId)
  const profile = profiles.find((entry) => entry.id === activeProfileId)?.data || null
  return {
    onboarded: map[KEYS.onboarded] === '1',
    profiles,
    activeProfileId,
    profile,
    apiBase: map[KEYS.apiBase] || '',
  }
}

function homeCacheKey(apiBase, profileCacheKey) {
  const base = String(apiBase || '').trim().replace(/\/$/, '')
  return `${HOME_CACHE_PREFIX}${encodeURIComponent(base)}:${encodeURIComponent(String(profileCacheKey || 'guest'))}`
}

function parseHomeCache(raw) {
  try {
    const value = raw ? JSON.parse(raw) : null
    return value?.recommendation && value?.calendar && Number(value.savedAt) > 0 ? value : null
  } catch {
    return null
  }
}

export async function saveOnboarded(value = true) {
  await AsyncStorage.setItem(KEYS.onboarded, value ? '1' : '0')
}

export async function saveProfiles(profiles, activeProfileId) {
  const normalized = normalizeProfiles(profiles)
  const activeId = resolveActiveProfileId(normalized, activeProfileId)
  await AsyncStorage.multiSet([
    [KEYS.profiles, JSON.stringify(normalized)],
    [KEYS.activeProfileId, activeId],
  ])
  await AsyncStorage.multiRemove([KEYS.profile, KEYS.legacyProfiles, KEYS.legacyActiveProfileId])
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

function parseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function normalizeProfileSearchStates(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).flatMap(([profileId, state]) => (
    profileId && state?.conversations?.length ? [[profileId, normalizeSearchState(state)]] : []
  )))
}

export async function loadProfileSearchStates() {
  const pairs = await AsyncStorage.multiGet([
    KEYS.profileSearchStates,
    KEYS.searchState,
    KEYS.legacySearchSession,
    KEYS.legacyProfileSearchSessions,
  ])
  const map = Object.fromEntries(pairs)
  const saved = normalizeProfileSearchStates(parseJson(map[KEYS.profileSearchStates]))
  if (Object.keys(saved).length) return saved

  let migrated = {}
  const previousMulti = parseJson(map[KEYS.legacyProfileSearchSessions])
  if (previousMulti && typeof previousMulti === 'object' && !Array.isArray(previousMulti)) {
    migrated = Object.fromEntries(Object.entries(previousMulti).flatMap(([profileId, session]) => {
      const state = legacySessionToSearchState(session)
      return state ? [[profileId, state]] : []
    }))
  }

  const globalState = parseJson(map[KEYS.searchState])
  if (globalState?.conversations?.length) {
    return { ...migrated, __legacy__: normalizeSearchState(globalState) }
  }

  const legacySession = legacySessionToSearchState(parseJson(map[KEYS.legacySearchSession]))
  return legacySession ? { ...migrated, __legacy__: legacySession } : migrated
}

export async function saveProfileSearchStates(states) {
  const normalized = normalizeProfileSearchStates(states)
  await AsyncStorage.setItem(KEYS.profileSearchStates, JSON.stringify(normalized))
  await AsyncStorage.multiRemove([
    KEYS.searchState,
    KEYS.legacySearchSession,
    KEYS.legacyProfileSearchSessions,
  ])
}

export async function loadFavoritePolicies() {
  return normalizeFavoritePolicies(parseJson(await AsyncStorage.getItem(KEYS.favoritePolicies)))
}

export async function saveFavoritePolicies(value) {
  const normalized = normalizeFavoritePolicies(value)
  await AsyncStorage.setItem(KEYS.favoritePolicies, JSON.stringify(normalized))
  return normalized
}

export async function loadNotificationSettings() {
  const saved = parseJson(await AsyncStorage.getItem(KEYS.notificationSettings))
  return {
    newMatchingPolicies: saved?.newMatchingPolicies !== false,
    deadlineReminders: saved?.deadlineReminders !== false,
  }
}

export async function saveNotificationSettings(value) {
  const normalized = {
    newMatchingPolicies: value?.newMatchingPolicies !== false,
    deadlineReminders: value?.deadlineReminders !== false,
  }
  await AsyncStorage.setItem(KEYS.notificationSettings, JSON.stringify(normalized))
  return normalized
}

export function getHomeCacheEntry(apiBase, profileCacheKey) {
  return homeMemoryCache.get(homeCacheKey(apiBase, profileCacheKey)) || null
}

export async function loadHomeCacheEntry(apiBase, profileCacheKey) {
  const key = homeCacheKey(apiBase, profileCacheKey)
  const memoryValue = homeMemoryCache.get(key)
  if (memoryValue) return memoryValue
  const cached = parseHomeCache(await AsyncStorage.getItem(key))
  if (!cached) return null
  homeMemoryCache.set(key, cached)
  return cached
}

export function isHomeCacheFresh(entry, now = Date.now()) {
  return Boolean(entry && Number(now) - Number(entry.savedAt) < HOME_CACHE_FRESH_MS)
}

export async function saveHomeCache(apiBase, profileCacheKey, recommendation, calendar) {
  const key = homeCacheKey(apiBase, profileCacheKey)
  const entry = { recommendation, calendar, savedAt: Date.now() }
  homeMemoryCache.set(key, entry)
  await AsyncStorage.setItem(key, JSON.stringify(entry))

  let index = []
  try {
    const parsed = parseJson(await AsyncStorage.getItem(KEYS.homeCacheIndex))
    if (Array.isArray(parsed)) index = parsed
  } catch {}
  const nextIndex = [{ key, savedAt: entry.savedAt }, ...index.filter((item) => item?.key && item.key !== key)]
  const evicted = nextIndex.slice(MAX_HOME_CACHE_ENTRIES)
  const retained = nextIndex.slice(0, MAX_HOME_CACHE_ENTRIES)
  if (evicted.length) {
    evicted.forEach((item) => homeMemoryCache.delete(item.key))
    await AsyncStorage.multiRemove(evicted.map((item) => item.key))
  }
  await AsyncStorage.setItem(KEYS.homeCacheIndex, JSON.stringify(retained))
  return entry
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

  calendarCacheIndexWrite = calendarCacheIndexWrite.catch(() => {}).then(async () => {
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
  })
  await calendarCacheIndexWrite
  return entry
}

export async function resetAppState() {
  const homeIndex = parseJson(await AsyncStorage.getItem(KEYS.homeCacheIndex))
  const homeCacheKeys = Array.isArray(homeIndex) ? homeIndex.map((item) => item?.key).filter(Boolean) : []
  homeMemoryCache.clear()
  await AsyncStorage.multiRemove([
    KEYS.onboarded,
    KEYS.profile,
    KEYS.profiles,
    KEYS.activeProfileId,
    KEYS.legacyProfiles,
    KEYS.legacyActiveProfileId,
    KEYS.profileSearchStates,
    KEYS.searchState,
    KEYS.legacySearchSession,
    KEYS.legacyProfileSearchSessions,
    KEYS.favoritePolicies,
    KEYS.notificationSettings,
    KEYS.homeCacheIndex,
    ...homeCacheKeys,
  ])
}
