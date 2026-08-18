import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { api } from '../api'
import PolicyCard from '../components/PolicyCard'
import ScreenHeader from '../components/ScreenHeader'
import { colors, shadow } from '../theme'
import { isoToday, profileLabel } from '../utils'

export default function HomeScreen({ apiBase, profile, onOpenPolicy, onNavigate, onEditProfile }) {
  const [recommendation, setRecommendation] = useState(null)
  const [calendar, setCalendar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const displayName = profile?.location ? `${profile.location} 청년` : '청년'

  const load = useCallback(async () => {
    setError('')
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

  useEffect(() => { load() }, [load])

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
      <ScreenHeader title="복지 Finder" subtitle={profileLabel(profile)} rightLabel="프로필 수정" onRight={onEditProfile} />

      <View style={styles.hero}>
        <Text style={styles.hello}>👋 안녕하세요, {displayName}!</Text>
        <Text style={styles.heroSub}>조건에 맞는 혜택을 찾아봤어요.</Text>
        <TouchableOpacity style={styles.heroCard} activeOpacity={0.85} onPress={() => onNavigate('search')}>
          <View>
            <Text style={styles.heroCardLabel}>지금 확인할 추천 혜택</Text>
            <Text style={styles.heroNumber}>{recommendation?.count ?? 0}<Text style={styles.heroUnit}>개</Text></Text>
          </View>
          <Text style={styles.coin}>✨</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {!!recommendation?.answer && (
        <View style={styles.aiSummary}>
          <View style={styles.aiIcon}><Text style={styles.aiIconText}>AI</Text></View>
          <Text style={styles.aiText}>{recommendation.answer}</Text>
        </View>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>지금 확인할 혜택</Text>
        <TouchableOpacity onPress={() => onNavigate('search')}><Text style={styles.more}>AI 검색 ›</Text></TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={colors.green} style={{ marginVertical: 26 }} />}
      {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={load}><Text style={styles.retry}>다시 불러오기</Text></TouchableOpacity></View>}
      {!loading && !error && (recommendation?.results || []).slice(0, 4).map((item, index) => (
        <PolicyCard key={item.policy?.['정책번호'] || `${item.policy?.['정책명']}-${index}`} item={item} compact onPress={onOpenPolicy} />
      ))}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>곧 챙겨야 할 일정</Text>
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
  hero: { backgroundColor: colors.green, marginHorizontal: 14, borderRadius: 25, padding: 20, ...shadow },
  hello: { color: colors.white, fontSize: 17, fontWeight: '900' },
  heroSub: { color: '#DDF7E9', fontSize: 12, marginTop: 5 },
  heroCard: { marginTop: 16, backgroundColor: colors.white, borderRadius: 17, padding: 15, flexDirection: 'row', alignItems: 'center' },
  heroCardLabel: { color: colors.text, fontSize: 11, fontWeight: '700' },
  heroNumber: { color: colors.greenDark, fontSize: 28, fontWeight: '900', marginTop: 2 },
  heroUnit: { fontSize: 14, color: colors.greenDark },
  coin: { fontSize: 31, marginLeft: 'auto', marginRight: 12 },
  chevron: { color: '#7E8781', fontSize: 28 },
  aiSummary: { flexDirection: 'row', gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginHorizontal: 14, marginTop: 12, borderRadius: 17, padding: 13 },
  aiIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  aiIconText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  aiText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 19 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 18, marginTop: 24, marginBottom: 9 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  more: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  errorBox: { marginHorizontal: 14, backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  retry: { color: colors.greenDark, fontWeight: '900', marginTop: 8, fontSize: 12 },
  scheduleBox: { backgroundColor: colors.white, borderRadius: 18, marginHorizontal: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  scheduleIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  start: { backgroundColor: colors.greenSoft },
  deadline: { backgroundColor: colors.dangerSoft },
  scheduleDate: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  scheduleTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 3 },
  scheduleArrow: { color: '#A7AEA9', fontSize: 23 },
  empty: { color: colors.muted, fontSize: 12, textAlign: 'center', padding: 22 },
  safety: { margin: 14, marginTop: 20, borderRadius: 18, padding: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  safetyTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  safetyText: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 6 },
})
