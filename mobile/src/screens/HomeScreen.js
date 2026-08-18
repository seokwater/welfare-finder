import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { api } from '../api'
import PolicyCard from '../components/PolicyCard'
import { colors } from '../theme'
import { isoToday } from '../utils'

function ageLabel(value) {
  const age = String(value || '').trim()
  if (!age) return '만 나이'
  if (age.startsWith('만 ')) return age.replace(/살/g, '세')
  if (/^\d/.test(age)) return `만 ${age.replace(/살/g, '세')}`
  return age
}

function profileMeta(profile) {
  return [profile?.location || '지역', ageLabel(profile?.age), profile?.employment || '직업 형태'].join(' · ')
}

export default function HomeScreen({ apiBase, profile, profileName = '프로필', onOpenPolicy, onNavigate, onEditProfile }) {
  const [recommendation, setRecommendation] = useState(null)
  const [calendar, setCalendar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [benefitsExpanded, setBenefitsExpanded] = useState(false)

  const normalizedProfileName = String(profileName || '프로필').trim() || '프로필'
  const greetingName = normalizedProfileName.endsWith('님') ? normalizedProfileName : `${normalizedProfileName}님`

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    setRecommendation(null)
    try {
      const now = new Date()
      const [rec, calendarResponse] = await Promise.all([
        api.alanSearch(apiBase, {
          query: '내 프로필 기준으로 지금 신청할 수 있는 청년 혜택을 우선 추천해줘',
          profileContext: profile || {},
          topK: 6,
          openOnly: true,
        }),
        api.calendar(apiBase, now.getFullYear(), now.getMonth() + 1),
      ])
      setRecommendation(rec)
      setCalendar(calendarResponse.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [apiBase, profile])

  useEffect(() => {
    setBenefitsExpanded(false)
    load()
  }, [load])

  const upcoming = useMemo(() => {
    const today = isoToday()
    return (calendar?.events || [])
      .filter((event) => event.date >= today && ['deadline', 'start', 'single'].includes(event.type))
      .slice(0, 3)
  }, [calendar])

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.green} />}
    >
      <View style={styles.homeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>정check</Text>
          <Text numberOfLines={1} style={styles.profileMeta}>{profileMeta(profile)}</Text>
        </View>
        <TouchableOpacity onPress={onEditProfile} style={styles.editProfileButton}>
          <Text style={styles.editProfileText}>프로필 수정</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.hero}>
        <Text style={styles.hello}>👋 안녕하세요, {greetingName}!</Text>
        <Text style={styles.heroSub}>{profile ? '조건에 맞는 혜택을 찾아봤어요.' : '프로필을 만들면 받을 수 있는 혜택을 찾아드려요.'}</Text>
        <TouchableOpacity
          style={styles.estimateCard}
          activeOpacity={0.86}
          accessibilityRole="button"
          accessibilityState={{ expanded: benefitsExpanded }}
          accessibilityLabel="지금 확인할 추천 혜택"
          onPress={() => setBenefitsExpanded((current) => !current)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.estimateLabel}>지금 확인할 추천 혜택</Text>
            <Text style={styles.estimateValue}>{loading ? '—' : (recommendation?.count ?? 0)}<Text style={styles.estimateUnit}>{loading ? '' : '개'}</Text></Text>
          </View>
          <Text style={styles.sparkleArt}>✨</Text>
          <Text style={styles.chevron}>{benefitsExpanded ? '⌃' : '›'}</Text>
        </TouchableOpacity>
      </View>

      {!!recommendation?.answer && (
        <View style={styles.aiSummary}>
          <View style={styles.aiIcon}><Text style={styles.aiIconText}>AI</Text></View>
          <Text style={styles.aiText}>{recommendation.answer}</Text>
        </View>
      )}

      {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={load}><Text style={styles.retry}>다시 불러오기</Text></TouchableOpacity></View>}

      {benefitsExpanded && (
        <View style={styles.benefitsSection}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>지금 확인할 혜택 <Text style={styles.sectionCount}>({recommendation?.count ?? 0})</Text></Text>
            <TouchableOpacity onPress={() => onNavigate('search')}><Text style={styles.more}>전체보기 ›</Text></TouchableOpacity>
          </View>

          <View style={styles.policyList}>
            {loading && <ActivityIndicator color={colors.green} style={{ marginVertical: 26 }} />}
            {!loading && !error && (recommendation?.results || []).slice(0, 4).map((item, index) => (
              <PolicyCard key={item.policy?.['정책번호'] || `${item.policy?.['정책명']}-${index}`} item={item} compact onPress={onOpenPolicy} />
            ))}
            {!loading && !error && (recommendation?.results || []).length === 0 && (
              <TouchableOpacity style={styles.emptyBenefits} onPress={load}>
                <Text style={styles.emptyBenefitsTitle}>{profile ? '현재 표시할 추천 혜택이 없어요.' : '아직 선택된 프로필이 없어요.'}</Text>
                <Text style={styles.emptyBenefitsText}>{profile ? '새로고침하거나 AI 검색에서 조건을 넓혀보세요.' : 'My 화면에서 프로필을 추가해 맞춤 추천을 시작하세요.'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.scheduleHead}>
        <Text style={styles.scheduleHeadTitle}>곧 챙겨야 할 일정</Text>
        <TouchableOpacity onPress={() => onNavigate('calendar')}><Text style={styles.more}>캘린더 ›</Text></TouchableOpacity>
      </View>

      <View style={styles.scheduleBox}>
        {upcoming.length === 0 ? (
          <Text style={styles.empty}>이번 달에 표시할 시작/마감 일정이 없어요.</Text>
        ) : upcoming.map((event) => (
          <TouchableOpacity key={event.id} style={styles.scheduleRow} onPress={() => onOpenPolicy(event.policy_result)}>
            <View style={[styles.scheduleIcon, event.type === 'deadline' ? styles.deadline : styles.start]}>
              <Text>{event.type === 'deadline' ? '⏰' : '📣'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scheduleDate}>{event.date.slice(5).replace('-', '/')} · {event.label}</Text>
              <Text numberOfLines={1} style={styles.scheduleTitle}>{event.title}</Text>
            </View>
            <Text style={styles.scheduleArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.safety}>
        <Text style={styles.safetyTitle}>안심하고 사용하세요</Text>
        <Text style={styles.safetyText}>추천 결과는 정책 DB와 자격 조건을 바탕으로 제공하며, 최종 신청 가능 여부는 각 기관의 심사를 따릅니다.</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 26 },
  homeHeader: { minHeight: 91, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15, gap: 12 },
  brand: { color: colors.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.9 },
  profileMeta: { color: colors.muted, fontSize: 12, marginTop: 5 },
  editProfileButton: { paddingHorizontal: 7, paddingVertical: 9 },
  editProfileText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  hero: { backgroundColor: colors.green, marginHorizontal: 6, marginTop: 5, borderRadius: 30, paddingHorizontal: 25, paddingTop: 26, paddingBottom: 25 },
  hello: { color: colors.white, fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  heroSub: { color: '#E4F8ED', fontSize: 13, fontWeight: '700', marginTop: 8 },
  estimateCard: { minHeight: 107, marginTop: 20, paddingHorizontal: 20, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', borderRadius: 21, backgroundColor: colors.white },
  estimateLabel: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  estimateValue: { color: colors.greenDark, fontSize: 31, fontWeight: '900', marginTop: 8 },
  estimateUnit: { color: colors.greenDark, fontSize: 14, fontWeight: '900' },
  sparkleArt: { fontSize: 34, marginRight: 15 },
  chevron: { color: '#6F7973', fontSize: 29, minWidth: 18, textAlign: 'center' },
  aiSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginHorizontal: 6, marginTop: 15, borderRadius: 21, paddingHorizontal: 17, paddingVertical: 16 },
  aiIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  aiIconText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  aiText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 21 },
  benefitsSection: { paddingBottom: 2 },
  policyList: { paddingHorizontal: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 18, marginTop: 24, marginBottom: 9 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  sectionCount: { color: colors.greenDark, fontSize: 13 },
  more: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  errorBox: { marginHorizontal: 6, marginTop: 12, backgroundColor: colors.dangerSoft, borderRadius: 16, padding: 14 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  retry: { color: colors.greenDark, fontWeight: '900', marginTop: 8, fontSize: 12 },
  emptyBenefits: { padding: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center' },
  emptyBenefitsTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  emptyBenefitsText: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: 'center' },
  scheduleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 11, marginTop: 34, marginBottom: 10 },
  scheduleHeadTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  scheduleBox: { backgroundColor: colors.white, borderRadius: 22, marginHorizontal: 6, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  scheduleRow: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 17, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  scheduleIcon: { width: 47, height: 47, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  start: { backgroundColor: colors.greenSoft },
  deadline: { backgroundColor: colors.dangerSoft },
  scheduleDate: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  scheduleTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 5 },
  scheduleArrow: { color: '#A7AEA9', fontSize: 23 },
  empty: { color: colors.muted, fontSize: 12, textAlign: 'center', padding: 22 },
  safety: { margin: 14, marginTop: 20, borderRadius: 18, padding: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  safetyTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  safetyText: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 6 },
})
