export function profileLabel(profile) {
  if (!profile) return '프로필 미등록'
  return [profile.location, profile.age, profile.employment].filter(Boolean).join(' · ') || '프로필 미등록'
}

export function moneyText(value) {
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toLocaleString('ko-KR')}만원` : String(value || '')
}

export function isoToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthMatrix(year, month) {
  const first = new Date(year, month - 1, 1)
  const start = new Date(year, month - 1, 1 - first.getDay())
  const cells = []
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const day = d.getDate()
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ iso, day, inMonth: m === month && y === year, date: d })
  }
  return cells
}

export function previousMonth(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

export function nextMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

export function eventTone(type) {
  if (type === 'deadline') return { emoji: '⏰', label: '신청 마감' }
  if (type === 'single') return { emoji: '📌', label: '신청일' }
  return { emoji: '📣', label: '신청 시작' }
}

export function getPolicyKey(item) {
  return item?.policy?.['정책번호'] || item?.policy?.['정책명'] || Math.random().toString(36)
}
