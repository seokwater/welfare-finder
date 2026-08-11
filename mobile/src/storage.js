import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  onboarded: 'wf:onboarded',
  profile: 'wf:profile',
  apiBase: 'wf:apiBase',
  searchSession: 'wf:searchSession',
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

export async function loadSearchSession() {
  const raw = await AsyncStorage.getItem(KEYS.searchSession)
  if (!raw) return null

  try {
    const session = JSON.parse(raw)
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
  } catch {
    await AsyncStorage.removeItem(KEYS.searchSession)
    return null
  }
}

export async function saveSearchSession({ messages, result }) {
  await AsyncStorage.setItem(KEYS.searchSession, JSON.stringify({ messages, result }))
}

export async function resetAppState() {
  await AsyncStorage.multiRemove([KEYS.onboarded, KEYS.profile, KEYS.searchSession])
}
