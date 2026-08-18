import { Platform } from 'react-native'

export function defaultApiBase() {
  const env = String(process.env.EXPO_PUBLIC_API_BASE_URL || '').trim().replace(/\/$/, '')
  if (env) return env
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://127.0.0.1:8000'
}

function normalizeBase(base) {
  return String(base || defaultApiBase()).trim().replace(/\/$/, '')
}

async function request(base, path, options = {}) {
  const url = `${normalizeBase(base)}${path}`
  const controller = new AbortController()
  const {
    timeoutMs = 20000,
    allowNotModified = false,
    returnMetadata = false,
    headers: requestHeaders = {},
    ...fetchOptions
  } = options
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...requestHeaders,
      },
    })
    const etag = response.headers?.get?.('etag') || ''
    if (allowNotModified && response.status === 304) {
      return { data: null, etag, notModified: true }
    }
    const raw = await response.text()
    let data = raw
    try { data = raw ? JSON.parse(raw) : null } catch {}
    if (!response.ok) {
      const message = data?.detail || data?.message || raw || `HTTP ${response.status}`
      throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
    }
    return returnMetadata ? { data, etag, notModified: false } : data
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('서버 응답 시간이 초과되었습니다.')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const api = {
  health: (base) => request(base, '/health', { timeoutMs: 8000 }),
  alanStatus: (base) => request(base, '/api/alan/status', { timeoutMs: 8000 }),
  profileTurn: (base, message, currentProfile) => request(base, '/api/alan/profile', {
    method: 'POST',
    body: JSON.stringify({ message, current_profile: currentProfile || {} }),
    timeoutMs: 45000,
  }),
  alanSearch: (base, { query, profileContext, history = [], topK = 6, openOnly = true }) => request(base, '/api/alan/search', {
    method: 'POST',
    body: JSON.stringify({
      query,
      profile_context: profileContext || {},
      history: history.slice(-20),
      top_k: topK,
      open_only: openOnly,
    }),
    timeoutMs: 45000,
  }),
  search: (base, payload) => request(base, '/api/search', {
    method: 'POST',
    body: JSON.stringify(payload),
    timeoutMs: 30000,
  }),
  calendar: (base, year, month, etag = '') => request(base, `/api/calendar?year=${year}&month=${month}`, {
    timeoutMs: 20000,
    allowNotModified: true,
    returnMetadata: true,
    headers: etag ? { 'If-None-Match': etag } : {},
  }),
}
