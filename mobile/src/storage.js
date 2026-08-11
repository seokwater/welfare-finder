import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  onboarded: 'wf:onboarded',
  profile: 'wf:profile',
  apiBase: 'wf:apiBase',
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

export async function resetAppState() {
  await AsyncStorage.multiRemove([KEYS.onboarded, KEYS.profile])
}
