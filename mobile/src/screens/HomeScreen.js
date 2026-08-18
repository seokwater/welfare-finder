import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { api } from '../api'
import PolicyCard from '../components/PolicyCard'
import { colors, shadow } from '../theme'
import { isoToday } from '../utils'

export default function HomeScreen({ apiBase, profile, profiles = [], activeProfileId, onOpenPolicy, onNavigate, onSelectProfile, onAddProfile }) {
  const [recommendation, setRecommendation] = useState(null)
  const [calendar, setCalendar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const activeProfile = profiles.find((entry) => entry.id === activeProfileId) || null
  const displayName = activeProfile?.name || (profile?.location ? `${profile.location} 청년` : '청년')

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
      <View style={styles.hero}>
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brand}>복지 Finder</Text>
            <Text style={styles.brandSub}>나의 맞춤 혜택 홈</Text>
          </View>
          <TouchableOpacity style={styles.manageButton} onPress={() => onNavigate('my')}>
            <Text style={styles.manageButtonText}>프로필 관리</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profileStrip}>
          {profiles.map((entry, index) => {
            const active = entry.id === activeProfileId
            return (
              <TouchableOpacity
                key={entry.id}
                style={[styles.profileChip, active && styles.activeProfileChip]}
                onPress={() => onSelectProfile(entry.id)}
              >
                <Text style={styles.profileChipEmoji}>{['🙂', '😊', '😎', '🧑'][index % 4]}</Text>
                <Text style={[styles.profileChipText, active && styles.activeProfileChipText]}>{entry.name}</Text>
                {active && <Text style={styles.profileChipCheck}>✓</Text>}
              </TouchableOpacity>
            )
          })}
          <TouchableOpacity style={styles.addProfileChip} onPress={onAddProfile}>
            <Text style={styles.addProfileChipText}>＋ 프로필 추가</Text>
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.hello}>👋 안녕하세요, {displayName}!</Text>
        <Text style={styles.heroSub}>{profile ? '조건에 맞는 혜택을 찾아봤어요.' : '프로필을 만들면 받을 수 있는 혜택을 찾아드려요.'}</Text>
      </View>

      <TouchableOpacity style={styles.estimateCard} activeOpacity={0.86} onPress={() => profile ? onNavigate('search') : onAddProfile()}>
        <View style={{ flex: 1 }}>
          <Text style={styles.estimateLabel}>{profile ? '지금 확인할 추천 혜택' : '맞춤 혜택을 받으려면'}</Text>
          <Text style={styles.estimateValue}>{profile ? (recommendation?.count ?? 0) : '프로필 생성'}<Text style={styles.estimateUnit}>{profile ? '개' : ''}</Text></Text>
        </View>
        <View style={styles.coinArt}><Text style={styles.coin}>🪙</Text><Text style={styles.sparkle}>✦</Text></View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {!!recommendation?.answer && (
        <View style={styles.aiSummary}>
          <View style={styles.aiIcon}><Text style={styles.aiIconText}>AI</Text></View>
          <Text style={styles.aiText}>{recommendation.answer}</Text>
        </View>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>지금 확인할 혜택 <Text style={styles.sectionCount}>({recommendation?.count ?? 0})</Text></Text>
        <TouchableOpacity onPress={() => onNavigate('search')}><Text style={styles.more}>전체보기 ›</Text></TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={colors.green} style={{ marginVertical: 26 }} />}
      {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={load}><Text style={styles.retry}>다시 불러오기</Text></TouchableOpacity></View>}
      {!loading && !error && (recommendation?.results || []).slice(0, 4).map((item, index) => (
        <PolicyCard key={item.policy?.['정책번호'] || `${item.policy?.['정책명']}-${index}`} item={item} compact onPress={onOpenPolicy} />
      ))}
      {!loading && !error && (recommendation?.results || []).length === 0 && (
        <TouchableOpacity style={styles.emptyBenefits} onPress={() => profile ? load() : onAddProfile()}>
          <Text style={styles.emptyBenefitsTitle}>{profile ? '현재 표시할 추천 혜택이 없어요.' : '아직 선택된 프로필이 없어요.'}</Text>
          <Text style={styles.emptyBenefitsText}>{profile ? '새로고침하거나 AI 검색에서 조건을 넓혀보세요.' : '프로필을 추가해 맞춤 추천을 시작하세요.'}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>곧 챙겨야 할 일정 <Text style={styles.sectionCount}>({upcoming.length})</Text></Text>
        <TouchableOpacity onPress={() => onNavigate('calendar')}><Text style={styles.more}>전체보기 ›</Text></TouchableOpacity>
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
  hero: { backgroundColor: colors.green, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 64 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.white, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  brandSub: { color: '#DDF7E9', fontSize: 9, marginTop: 2 },
  manageButton: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.16)' },
  manageButtonText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  profileStrip: { gap: 7, paddingVertical: 17, paddingRight: 20 },
  profileChip: { height: 35, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  activeProfileChip: { backgroundColor: colors.white, borderColor: colors.white },
  profileChipEmoji: { fontSize: 14 },
  profileChipText: { color: '#E8FAF1', fontSize: 10, fontWeight: '800' },
  activeProfileChipText: { color: colors.greenDark },
  profileChipCheck: { color: colors.green, fontSize: 10, fontWeight: '900' },
  addProfileChip: { height: 35, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.5)' },
  addProfileChipText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  hello: { color: colors.white, fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  heroSub: { color: '#DDF7E9', fontSize: 12, marginTop: 5 },
  estimateCard: { minHeight: 108, marginHorizontal: 15, marginTop: -42, paddingHorizontal: 18, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 17, backgroundColor: colors.white, ...shadow },
  estimateLabel: { color: colors.text, fontSize: 12, fontWeight: '700' },
  estimateValue: { color: colors.greenDark, fontSize: 29, fontWeight: '900', marginTop: 8 },
  estimateUnit: { color: colors.greenDark, fontSize: 14, fontWeight: '900' },
  coinArt: { width: 51, height: 51, borderRadius: 19, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  coin: { fontSize: 29 },
  sparkle: { position: 'absolute', right: 3, top: 1, color: colors.warning, fontSize: 15 },
  chevron: { color: '#7E8781', fontSize: 28 },
  aiSummary: { flexDirection: 'row', gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginHorizontal: 14, marginTop: 12, borderRadius: 17, padding: 13 },
  aiIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  aiIconText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  aiText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 19 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 18, marginTop: 24, marginBottom: 9 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  sectionCount: { color: colors.greenDark, fontSize: 13 },
  more: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  errorBox: { marginHorizontal: 14, backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  retry: { color: colors.greenDark, fontWeight: '900', marginTop: 8, fontSize: 12 },
  emptyBenefits: { marginHorizontal: 14, padding: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center' },
  emptyBenefitsTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  emptyBenefitsText: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: 'center' },
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
