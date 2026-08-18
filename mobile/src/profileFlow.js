export const EMPTY_PROFILE = { location: '', age: '', housing: '', employment: '', income: '' }

export const PROFILE_STEPS = [
  { field: 'location', label: '거주지', icon: '📍', text: '현재 살고 있는 지역을 알려주세요.', choices: ['서울', '경기', '전주', '부산', '직접 입력'] },
  { field: 'age', label: '나이', icon: '🎂', text: '나이도 알려주실 수 있나요?', choices: ['19~24살', '25~29살', '30~34살', '직접 입력'] },
  { field: 'housing', label: '주거', icon: '🏠', text: '현재 어떤 형태로 거주하고 있나요?', choices: ['자취/원룸', '부모님과 거주', '기숙사', '전월세', '직접 입력'] },
  { field: 'employment', label: '취업', icon: '💼', text: '현재 취업 상태도 알려주세요.', choices: ['취업준비생', '대학생', '재직 중', '프리랜서', '무직', '직접 입력'] },
  { field: 'income', label: '소득', icon: '💰', text: '마지막으로 월 소득도 알려주실 수 있나요?', choices: ['소득 없음', '100만원 이하', '100~200만원', '200만원 이상', '직접 입력'] },
]

export function nextProfileStep(profile) {
  return PROFILE_STEPS.find(({ field }) => !profile?.[field]) || null
}

export function profileStep(field) {
  return PROFILE_STEPS.find((step) => step.field === field) || null
}

export function countFilledProfile(profile) {
  return PROFILE_STEPS.filter(({ field }) => Boolean(profile?.[field])).length
}

export function applyProfileChoice(profile, field, value) {
  if (!profileStep(field) || !value) return { ...EMPTY_PROFILE, ...(profile || {}) }
  return { ...EMPTY_PROFILE, ...(profile || {}), [field]: value }
}

export function normalizeDirectProfileInput(field, value) {
  if (field !== 'age') return ''
  const match = String(value || '').trim().match(/^(?:만\s*)?(\d{1,2})\s*(?:살|세)?$/)
  if (!match) return ''
  const age = Number(match[1])
  return age >= 1 && age <= 99 ? `만 ${age}세` : ''
}

export function createProfileEditRequest(profile, field) {
  if (!profileStep(field)) return { ...EMPTY_PROFILE, ...(profile || {}) }
  return { ...EMPTY_PROFILE, ...(profile || {}), [field]: '' }
}

export function mergeAnalyzedProfile(profile, analyzedProfile) {
  return PROFILE_STEPS.reduce((result, { field }) => ({
    ...result,
    [field]: analyzedProfile?.[field] || result[field],
  }), { ...EMPTY_PROFILE, ...(profile || {}) })
}
