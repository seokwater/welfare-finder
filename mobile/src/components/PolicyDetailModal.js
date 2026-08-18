import React from 'react'
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../theme'

function Criterion({ item }) {
  const tone = item.status === 'pass' ? colors.green : item.status === 'fail' ? colors.danger : colors.warning
  return (
    <View style={styles.criterion}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.criterionTitle}>{item.criterion} · {item.reason}</Text>
        {!!item.policy_rule && <Text style={styles.rule}>{item.policy_rule}</Text>}
      </View>
    </View>
  )
}

export default function PolicyDetailModal({ item, onClose, favorite = false, onToggleFavorite }) {
  const policy = item?.policy || {}
  const eligibility = item?.eligibility || {}
  const application = item?.application || {}
  const url = policy.detail_url || policy['신청URL'] || policy['참고URL1'] || policy['참고URL2']
  const likely = eligibility.status === 'likely'

  return (
    <Modal visible={!!item} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}><Text style={styles.headerIcon}>‹</Text></TouchableOpacity>
          <Text numberOfLines={1} style={styles.headerTitle}>{policy['정책명'] || '정책 상세'}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={favorite ? '찜 해제' : '찜하기'}
            onPress={() => onToggleFavorite?.(item)}
            style={styles.headerButton}
          >
            <Ionicons name={favorite ? 'bookmark' : 'bookmark-outline'} size={24} color={favorite ? colors.green : colors.ink} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.resultBox, likely ? styles.resultGood : styles.resultCheck]}>
            <Text style={styles.resultIcon}>{likely ? '✓' : '!'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultTitle}>{likely ? '받을 가능성이 높아요!' : eligibility.status === 'mismatch' ? '일부 조건이 맞지 않아요' : '추가 확인이 필요해요'}</Text>
              <Text style={styles.resultSub}>자동 분석 결과이며 최종 자격은 공고 기관 심사를 따릅니다.</Text>
            </View>
          </View>

          {!!eligibility.criteria?.length && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>왜 추천했나요?</Text>
              {eligibility.criteria.map((c, i) => <Criterion key={`${c.criterion}-${i}`} item={c} />)}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>지원 내용</Text>
            <Text style={styles.body}>{policy['지원내용'] || policy['정책설명'] || '원문 공고를 확인해 주세요.'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>신청 정보</Text>
            <Info label="신청 기간" value={application.period || policy['신청기간_정리'] || policy['신청기간구분']} />
            <Info label="신청 상태" value={application.label} />
            <Info label="신청 방법" value={policy['신청방법']} />
            <Info label="거주 지역" value={policy['정책거주지역요약'] || policy['정책거주지역명_현재기준']} />
            <Info label="연령 조건" value={policy['연령조건']} />
            <Info label="취업 조건" value={policy['취업요건']} />
            <Info label="소득 조건" value={policy['소득조건요약']} />
          </View>

          {!!policy['제출서류'] && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>필요 서류</Text>
              <Text style={styles.body}>{policy['제출서류']}</Text>
            </View>
          )}
        </ScrollView>
        {!!url && (
          <View style={styles.bottom}>
            <TouchableOpacity style={styles.primary} onPress={() => Linking.openURL(url)}>
              <Text style={styles.primaryText}>공식 신청 페이지로 이동 ↗</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  )
}

function Info({ label, value }) {
  if (!value) return null
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{String(value)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { height: 58, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 10 },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 34, color: colors.ink, lineHeight: 36 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 16, fontWeight: '900' },
  content: { padding: 16, paddingBottom: 110 },
  resultBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, padding: 15, borderWidth: 1 },
  resultGood: { backgroundColor: colors.greenSoft, borderColor: '#CDEDDC' },
  resultCheck: { backgroundColor: colors.warningSoft, borderColor: '#F7D9B8' },
  resultIcon: { width: 34, height: 34, borderRadius: 17, textAlign: 'center', textAlignVertical: 'center', color: colors.white, backgroundColor: colors.green, fontSize: 20, fontWeight: '900', overflow: 'hidden' },
  resultTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  resultSub: { color: colors.muted, fontSize: 11, marginTop: 4, lineHeight: 16 },
  section: { backgroundColor: colors.white, borderRadius: 17, borderWidth: 1, borderColor: colors.line, padding: 15, marginTop: 12 },
  sectionTitle: { fontSize: 15, color: colors.ink, fontWeight: '900', marginBottom: 11 },
  criterion: { flexDirection: 'row', gap: 9, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  criterionTitle: { fontSize: 12, color: colors.text, fontWeight: '700', lineHeight: 18 },
  rule: { fontSize: 11, color: colors.muted, marginTop: 3, lineHeight: 16 },
  body: { color: colors.text, fontSize: 13, lineHeight: 21 },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, gap: 12 },
  infoLabel: { width: 76, color: colors.muted, fontSize: 12, fontWeight: '700' },
  infoValue: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, padding: 14, borderTopWidth: 1, borderTopColor: colors.line },
  primary: { height: 52, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: '900' },
})
