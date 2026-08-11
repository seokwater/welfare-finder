import React, { useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { api } from '../api'
import ScreenHeader from '../components/ScreenHeader'
import { colors } from '../theme'

export default function MyScreen({ apiBase, profile, onSaveApiBase, onEditProfile, onReset }) {
  const [serverInput, setServerInput] = useState(apiBase)
  const [health, setHealth] = useState(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setServerInput(apiBase), [apiBase])

  const check = async (base = serverInput) => {
    setChecking(true)
    setError('')
    try {
      const data = await api.health(base)
      setHealth(data)
      return data
    } catch (e) {
      setHealth(null)
      setError(e.message)
      return null
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => { check(apiBase) }, [apiBase])

  const saveServer = async () => {
    const normalized = String(serverInput || '').trim().replace(/\/$/, '')
    if (!/^https?:\/\//i.test(normalized)) {
      Alert.alert('주소 확인', 'http:// 또는 https://로 시작하는 API 주소를 입력해주세요.')
      return
    }
    await onSaveApiBase(normalized)
    await check(normalized)
  }

  const confirmReset = () => {
    Alert.alert('앱 초기화', '저장한 프로필과 온보딩 상태를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '초기화', style: 'destructive', onPress: onReset },
    ])
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="마이" subtitle="프로필과 서버 설정" />

      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>🙂</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileTitle}>내 AI 프로필</Text>
          <Text style={styles.profileSub}>{profile ? '추천 검색에 자동으로 반영됩니다.' : '아직 프로필이 없습니다.'}</Text>
        </View>
        <TouchableOpacity onPress={onEditProfile}><Text style={styles.edit}>수정</Text></TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>프로필 정보</Text>
        <Info icon="📍" label="거주지" value={profile?.location} />
        <Info icon="🎂" label="나이" value={profile?.age} />
        <Info icon="🏠" label="주거 형태" value={profile?.housing} />
        <Info icon="💼" label="취업 상태" value={profile?.employment} />
        <Info icon="💰" label="소득" value={profile?.income} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>백엔드 연결</Text>
        <Text style={styles.help}>실제 스마트폰에서는 PC의 127.0.0.1이 아니라 같은 Wi-Fi의 PC IPv4 주소를 입력해야 합니다.</Text>
        <TextInput
          value={serverInput}
          onChangeText={setServerInput}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.0.15:8000"
          style={styles.input}
        />
        <View style={styles.serverActions}>
          <TouchableOpacity style={styles.secondary} onPress={() => check()}><Text style={styles.secondaryText}>{checking ? '확인 중…' : '연결 테스트'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.primary} onPress={saveServer}><Text style={styles.primaryText}>주소 저장</Text></TouchableOpacity>
        </View>
        <View style={[styles.status, { backgroundColor: health?.ok ? colors.greenSoft : '#F5F5F5' }]}>
          <View style={[styles.statusDot, { backgroundColor: health?.ok ? colors.green : '#B4BBB6' }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{health?.ok ? '서버 연결 정상' : '연결 상태 확인 필요'}</Text>
            {health && <Text style={styles.statusSub}>PostgreSQL {health.database_connected ? '연결됨' : '연결 안 됨'} · 정책 {health.policies || 0}개 · Alan {health.alan_enabled ? '연결됨' : 'fallback 모드'}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>서비스 구성</Text>
        <Info icon="🤖" label="AI 검색" value="ESTsoft Alan API + fallback 분석" />
        <Info icon="🗄️" label="정책 DB" value="PostgreSQL" />
        <Info icon="🔎" label="검색 랭킹" value="TF-IDF + 자격 조건" />
        <Info icon="🗓️" label="캘린더" value="정책 신청기간 + 기기 캘린더" />
      </View>

      <TouchableOpacity style={styles.reset} onPress={confirmReset}><Text style={styles.resetText}>프로필 및 온보딩 초기화</Text></TouchableOpacity>
      <Text style={styles.version}>복지 Finder Mobile v2.0</Text>
    </ScrollView>
  )
}

function Info({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={[styles.infoValue, !value && { color: '#B5BCB7' }]}>{value || '미입력'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 30 },
  profileCard: { marginHorizontal: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 19, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 48, height: 48, borderRadius: 18, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24 },
  profileTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  profileSub: { color: colors.muted, fontSize: 10, marginTop: 4 },
  edit: { color: colors.greenDark, fontSize: 12, fontWeight: '900', padding: 8 },
  section: { marginHorizontal: 14, marginTop: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 19, padding: 15 },
  sectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginBottom: 9 },
  infoRow: { flexDirection: 'row', alignItems: 'center', minHeight: 39, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  infoIcon: { width: 28, fontSize: 13 },
  infoLabel: { width: 72, color: colors.muted, fontSize: 11, fontWeight: '700' },
  infoValue: { flex: 1, color: colors.text, fontSize: 11, textAlign: 'right', fontWeight: '700' },
  help: { color: colors.muted, fontSize: 10, lineHeight: 16, marginBottom: 10 },
  input: { height: 46, borderRadius: 13, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.ink, backgroundColor: '#FAFCFB', fontSize: 12 },
  serverActions: { flexDirection: 'row', gap: 8, marginTop: 9 },
  secondary: { flex: 1, height: 41, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.text, fontSize: 11, fontWeight: '900' },
  primary: { flex: 1, height: 41, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  status: { flexDirection: 'row', gap: 8, borderRadius: 13, padding: 10, marginTop: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  statusTitle: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  statusSub: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 2 },
  error: { color: colors.danger, fontSize: 9, marginTop: 3 },
  reset: { margin: 14, marginTop: 18, height: 48, borderRadius: 14, borderWidth: 1, borderColor: '#F0CACA', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft },
  resetText: { color: colors.danger, fontSize: 12, fontWeight: '900' },
  version: { textAlign: 'center', color: '#A7AEA9', fontSize: 9 },
})
