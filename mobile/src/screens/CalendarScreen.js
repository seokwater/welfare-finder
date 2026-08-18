import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Calendar from 'expo-calendar'
import { api } from '../api'
import MonthCalendar from '../components/MonthCalendar'
import ScreenHeader from '../components/ScreenHeader'
import { getCalendarCacheEntry, loadCalendarCacheEntry, saveCalendarCache } from '../storage'
import { colors } from '../theme'
import { eventTone, isoToday, nextMonth, previousMonth } from '../utils'

function calendarDataChanged(previous, next) {
  if (!previous) return true
  try {
    return JSON.stringify(previous) !== JSON.stringify(next)
  } catch {
    return true
  }
}

export default function CalendarScreen({ apiBase, onOpenPolicy }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(isoToday())
  const initialCache = getCalendarCacheEntry(apiBase, now.getFullYear(), now.getMonth() + 1)
  const [data, setData] = useState(initialCache?.data || null)
  const [loading, setLoading] = useState(!initialCache)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    let cacheEntry = getCalendarCacheEntry(apiBase, year, month)
    setData(cacheEntry?.data || null)
    setLoading(!cacheEntry)
    setRefreshing(!!cacheEntry)
    setError('')

    const refresh = async () => {
      try {
        if (!cacheEntry) {
          cacheEntry = await loadCalendarCacheEntry(apiBase, year, month)
          if (!alive) return
          if (cacheEntry) {
            setData(cacheEntry.data)
            setLoading(false)
            setRefreshing(true)
          }
        }

        const response = await api.calendar(apiBase, year, month, cacheEntry?.etag)
        if (!alive) return
        if (response.notModified) return

        const result = response.data
        if (calendarDataChanged(cacheEntry?.data, result)) {
          setData(result)
        }
        saveCalendarCache(apiBase, year, month, result, response.etag).catch(() => {})
      } catch (e) {
        if (alive) {
          setError(cacheEntry
            ? `저장된 일정을 표시 중입니다. 최신 데이터 확인 실패: ${e.message}`
            : e.message)
        }
      } finally {
        if (alive) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    refresh()
    return () => { alive = false }
  }, [apiBase, year, month])

  const selectedEvents = useMemo(() => (data?.events || []).filter((event) => event.date === selectedDate), [data, selectedDate])
  const selectedCounts = data?.day_counts?.[selectedDate] || { start: 0, deadline: 0, active: 0, open_estimate: data?.summary?.always_open_count || 0 }

  const moveMonth = (direction) => {
    const target = direction < 0 ? previousMonth(year, month) : nextMonth(year, month)
    setYear(target.year)
    setMonth(target.month)
    setSelectedDate(`${target.year}-${String(target.month).padStart(2, '0')}-01`)
  }

  const goToday = () => {
    const d = new Date()
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setSelectedDate(isoToday())
  }

  const addToDeviceCalendar = async (event) => {
    try {
      const available = await Calendar.isAvailableAsync()
      if (!available) {
        Alert.alert('캘린더 사용 불가', '이 기기에서는 시스템 캘린더 기능을 사용할 수 없습니다.')
        return
      }
      const startDate = new Date(`${event.date}T09:00:00`)
      const endDate = new Date(`${event.date}T10:00:00`)
      const url = event.policy_result?.policy?.detail_url || event.policy_result?.policy?.['신청URL'] || ''
      await Calendar.createEventInCalendarAsync({
        title: `[복지 Finder] ${event.title} · ${event.label}`,
        startDate,
        endDate,
        allDay: false,
        notes: [`${event.label}: ${event.period || event.date}`, url ? `원문: ${url}` : ''].filter(Boolean).join('\n'),
        url: url || undefined,
        alarms: [{ relativeOffset: -1440 }],
      })
    } catch (e) {
      Alert.alert('캘린더 추가 실패', e.message || '일정을 추가하지 못했습니다.')
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ScreenHeader title="혜택 캘린더" subtitle="실제 정책 신청 시작일과 마감일" rightLabel="오늘" onRight={goToday} />

      <View style={styles.calendarCard}>
        <View style={styles.monthHead}>
          <TouchableOpacity style={styles.arrowButton} onPress={() => moveMonth(-1)}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
          <View style={styles.monthTitleWrap}>
            <Text style={styles.monthTitle}>{year}년 {month}월</Text>
            {refreshing && <Text style={styles.refreshingText}>최신 일정 확인 중…</Text>}
          </View>
          <TouchableOpacity style={styles.arrowButton} onPress={() => moveMonth(1)}><Text style={styles.arrow}>›</Text></TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator color={colors.green} style={{ marginVertical: 50 }} /> : (
          <MonthCalendar year={year} month={month} selectedDate={selectedDate} dayCounts={data?.day_counts || {}} onSelect={setSelectedDate} />
        )}
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.green }]} /><Text style={styles.legendText}>신청 시작</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.danger }]} /><Text style={styles.legendText}>신청 마감</Text></View>
        </View>
      </View>

      {!!data?.summary && (
        <View style={styles.summaryRow}>
          <SummaryCard label="이번 달 시작" value={data.summary.start_count} />
          <SummaryCard label="이번 달 마감" value={data.summary.deadline_count} danger />
          <SummaryCard label="상시 신청" value={data.summary.always_open_count} />
        </View>
      )}

      {!!error && <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View>}

      <View style={styles.dayHead}>
        <View>
          <Text style={styles.dayTitle}>{selectedDate.replaceAll('-', '.')}</Text>
          <Text style={styles.daySub}>진행 중 약 {selectedCounts.active || 0}개 · 상시 포함 약 {selectedCounts.open_estimate || 0}개</Text>
        </View>
      </View>

      {selectedEvents.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🗓️</Text>
          <Text style={styles.emptyTitle}>이 날짜의 시작·마감 일정이 없어요.</Text>
          <Text style={styles.emptyText}>달력의 초록색·빨간색 점이 있는 날짜를 눌러보세요.</Text>
        </View>
      ) : selectedEvents.map((event) => {
        const tone = eventTone(event.type)
        return (
          <View key={event.id} style={styles.eventCard}>
            <View style={[styles.eventIcon, event.type === 'deadline' ? styles.deadlineBg : styles.startBg]}><Text style={styles.eventEmoji}>{tone.emoji}</Text></View>
            <View style={{ flex: 1 }}>
              <View style={styles.eventMetaRow}><Text style={[styles.eventType, event.type === 'deadline' && styles.deadlineText]}>{event.label}</Text><Text style={styles.relative}>{event.relative_label}</Text></View>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text numberOfLines={2} style={styles.eventPeriod}>{event.period}</Text>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.secondary} onPress={() => onOpenPolicy(event.policy_result)}><Text style={styles.secondaryText}>정책 상세</Text></TouchableOpacity>
                <TouchableOpacity style={styles.primary} onPress={() => addToDeviceCalendar(event)}><Text style={styles.primaryText}>기기 캘린더에 추가</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        )
      })}

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>캘린더 안내</Text>
        <Text style={styles.noticeText}>날짜가 명확하게 구조화된 정책의 신청 시작일·마감일을 표시합니다. 상시 접수 정책은 특정 날짜에 점으로 표시하지 않고 상시 신청 수에 포함합니다.</Text>
      </View>
    </ScrollView>
  )
}

function SummaryCard({ label, value, danger }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, danger && { color: colors.danger }]}>{value ?? 0}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 28 },
  calendarCard: { backgroundColor: colors.white, marginHorizontal: 14, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.line },
  monthHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  monthTitleWrap: { alignItems: 'center' },
  monthTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  refreshingText: { color: colors.muted, fontSize: 9, marginTop: 2 },
  arrowButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F9F8' },
  arrow: { color: colors.ink, fontSize: 30, lineHeight: 32 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: 7, marginHorizontal: 14, marginTop: 10 },
  summaryCard: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 15, paddingVertical: 11, alignItems: 'center' },
  summaryValue: { color: colors.greenDark, fontSize: 18, fontWeight: '900' },
  summaryLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  errorBox: { margin: 14, backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 12 },
  error: { color: colors.danger, fontSize: 11 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 18, marginTop: 22, marginBottom: 9 },
  dayTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  daySub: { color: colors.muted, fontSize: 10, marginTop: 3 },
  emptyBox: { marginHorizontal: 14, backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', padding: 24 },
  emptyIcon: { fontSize: 34 },
  emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 9 },
  emptyText: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: 'center' },
  eventCard: { flexDirection: 'row', gap: 11, backgroundColor: colors.white, marginHorizontal: 14, marginBottom: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 13 },
  eventIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  startBg: { backgroundColor: colors.greenSoft },
  deadlineBg: { backgroundColor: colors.dangerSoft },
  eventEmoji: { fontSize: 19 },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventType: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
  deadlineText: { color: colors.danger },
  relative: { color: colors.muted, fontSize: 9 },
  eventTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', lineHeight: 20, marginTop: 4 },
  eventPeriod: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 11 },
  secondary: { flex: 1, height: 38, borderRadius: 11, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.text, fontSize: 10, fontWeight: '900' },
  primary: { flex: 1.4, height: 38, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  notice: { margin: 14, marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: '#F0F4F2' },
  noticeTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  noticeText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
})
