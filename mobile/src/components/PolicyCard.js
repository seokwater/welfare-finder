import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors, shadow } from '../theme'

function eligibilityMeta(status) {
  if (status === 'likely') return { label: '조건 충족 가능성 높음', bg: colors.greenSoft, fg: colors.greenDark }
  if (status === 'mismatch') return { label: '조건 불일치', bg: colors.dangerSoft, fg: colors.danger }
  return { label: '추가 확인 필요', bg: colors.warningSoft, fg: '#B66A1C' }
}

export default function PolicyCard({ item, compact = false, onPress }) {
  const policy = item?.policy || {}
  const eligibility = item?.eligibility || {}
  const application = item?.application || {}
  const meta = eligibilityMeta(eligibility.status)
  const title = policy['정책명'] || '정책명 없음'
  const category = [policy['정책대분류'], policy['정책중분류']].filter(Boolean).join(' · ')
  const support = policy['지원내용'] || policy['정책설명'] || ''

  return (
    <TouchableOpacity activeOpacity={0.8} style={[styles.card, compact && styles.compact]} onPress={() => onPress?.(item)}>
      <View style={styles.top}>
        <View style={styles.titleWrap}>
          {!!category && <Text style={styles.category}>{category}</Text>}
          <Text numberOfLines={2} style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: meta.bg }]}><Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text></View>
        {!!application.label && <View style={styles.openBadge}><Text style={styles.openText}>{application.label}</Text></View>}
      </View>
      {!compact && !!support && <Text numberOfLines={3} style={styles.support}>{support}</Text>}
      <View style={styles.footer}>
        <Text numberOfLines={1} style={styles.region}>{policy['정책거주지역요약'] || policy['정책거주지역명_현재기준'] || '지역 조건 확인'}</Text>
        {Number.isFinite(Number(item?.score)) && <Text style={styles.score}>추천 {Math.max(0, Math.round(Number(item.score) * 100))}</Text>}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: colors.line, marginBottom: 11, ...shadow },
  compact: { paddingVertical: 13, marginBottom: 9 },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  titleWrap: { flex: 1, paddingRight: 8 },
  category: { fontSize: 11, color: colors.muted, fontWeight: '700', marginBottom: 5 },
  title: { fontSize: 16, color: colors.ink, fontWeight: '900', lineHeight: 22 },
  chevron: { color: '#A1AAA4', fontSize: 28, lineHeight: 28 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  openBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: '#EEF8F3' },
  openText: { fontSize: 11, fontWeight: '800', color: colors.greenDark },
  support: { fontSize: 13, color: colors.text, lineHeight: 19, marginTop: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 11 },
  region: { flex: 1, fontSize: 11, color: colors.muted },
  score: { fontSize: 11, color: colors.muted, fontWeight: '700' },
})
