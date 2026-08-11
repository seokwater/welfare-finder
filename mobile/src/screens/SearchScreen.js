import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { api } from '../api'
import ChatBubble from '../components/ChatBubble'
import PolicyCard from '../components/PolicyCard'
import ScreenHeader from '../components/ScreenHeader'
import { colors } from '../theme'

const SUGGESTIONS = [
  '월세 지원 받을 수 있어?',
  '취업 준비 지원금 찾아줘',
  '지금 신청 가능한 정책만 알려줘',
  '교육·자격증 지원을 찾고 있어',
]

export const INITIAL_SEARCH_SESSION = {
  messages: [
    { role: 'assistant', content: '궁금한 혜택을 자연스럽게 물어보세요. 저장된 프로필과 실제 정책 DB를 함께 확인할게요.' },
  ],
  result: null,
}

export default function SearchScreen({ apiBase, profile, onOpenPolicy, searchSession, onSearchSessionChange }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const messages = searchSession?.messages?.length ? searchSession.messages : INITIAL_SEARCH_SESSION.messages
  const result = searchSession?.result || null

  useEffect(() => {
    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80)
    return () => clearTimeout(timeout)
  }, [])

  const updateSession = (update) => {
    onSearchSessionChange((current) => {
      const base = current?.messages?.length ? current : INITIAL_SEARCH_SESSION
      return typeof update === 'function' ? update(base) : { ...base, ...update }
    })
  }

  const submit = async (raw) => {
    const text = String(raw ?? query).trim()
    if (!text || loading) return
    setQuery('')
    setError('')
    const nextHistory = [...messages, { role: 'user', content: text }]
    updateSession({ messages: nextHistory })
    setLoading(true)
    try {
      const data = await api.alanSearch(apiBase, {
        query: text,
        profileContext: profile || {},
        history: nextHistory,
        topK: 8,
        openOnly: true,
      })
      updateSession((current) => ({
        ...current,
        result: data,
        messages: [...current.messages, { role: 'assistant', content: data.answer || '관련 정책을 찾았어요.' }],
      }))
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
    } catch (e) {
      setError(e.message)
      updateSession((current) => ({
        ...current,
        messages: [...current.messages, { role: 'assistant', content: '검색 중 문제가 발생했어요. 서버 설정과 네트워크를 확인해주세요.' }],
      }))
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    onSearchSessionChange({
      messages: [{ role: 'assistant', content: '새로 검색해볼게요. 어떤 혜택을 찾고 있나요?' }],
      result: null,
    })
    setQuery('')
    setError('')
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="복지 Finder Alan AI" subtitle="Alan AI + 정책 DB 검색" rightLabel="새 검색" onRight={clear} />
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.searchIntro}>
          <Text style={styles.introTitle}>🔎 검색으로 혜택을 찾아보세요</Text>
          <Text style={styles.introText}>예: “전주 사는 24살 취준생인데 월세 지원 가능해?”</Text>
        </View>

        <View style={styles.chatBox}>
          {messages.map((message, index) => <ChatBubble key={`${index}-${message.role}`} role={message.role} text={message.content} />)}
          {loading && <View style={styles.loading}><ActivityIndicator color={colors.green} /><Text style={styles.loadingText}>정책 DB와 자격 조건을 확인 중이에요…</Text></View>}
        </View>

        {messages.length === 1 && (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((item) => (
              <TouchableOpacity key={item} style={styles.suggestion} onPress={() => submit(item)}>
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!!result?.search_plan && (
          <View style={styles.planBox}>
            <Text style={styles.planTitle}>AI가 이해한 검색 조건</Text>
            <Text style={styles.planText}>{[
              result.search_plan.region,
              result.search_plan.age ? `만 ${result.search_plan.age}세` : '',
              result.search_plan.employment,
              ...(result.search_plan.intents || []),
            ].filter(Boolean).join(' · ') || '자연어 관련도 중심 검색'}</Text>
          </View>
        )}

        {!!result?.results?.length && (
          <View style={styles.results}>
            <View style={styles.resultsHead}><Text style={styles.resultsTitle}>추천 정책</Text><Text style={styles.count}>{result.count}개</Text></View>
            {result.results.map((item, index) => (
              <PolicyCard key={item.policy?.['정책번호'] || `${index}`} item={item} onPress={onOpenPolicy} />
            ))}
          </View>
        )}

        {!!result?.follow_up_question && (
          <TouchableOpacity style={styles.follow} onPress={() => setQuery(result.follow_up_question)}>
            <Text style={styles.followLabel}>AI 추가 질문</Text>
            <Text style={styles.followText}>{result.follow_up_question}</Text>
          </TouchableOpacity>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => submit()}
          placeholder="혜택을 검색해보세요…"
          placeholderTextColor="#98A09B"
          returnKeyType="search"
          style={styles.input}
        />
        <TouchableOpacity activeOpacity={0.8} style={styles.send} onPress={() => submit()}>
          <Text style={styles.sendText}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 14, paddingBottom: 20 },
  searchIntro: { backgroundColor: colors.greenSoft, borderRadius: 17, padding: 14, marginBottom: 13 },
  introTitle: { color: colors.greenDark, fontSize: 14, fontWeight: '900' },
  introText: { color: colors.text, fontSize: 11, marginTop: 5, lineHeight: 17 },
  chatBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 19, padding: 13 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { color: colors.muted, fontSize: 11 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  suggestion: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  suggestionText: { color: colors.text, fontSize: 11, fontWeight: '700' },
  planBox: { backgroundColor: '#F1F7FF', borderRadius: 15, padding: 12, marginTop: 12 },
  planTitle: { color: '#3C5D7C', fontSize: 11, fontWeight: '900' },
  planText: { color: '#4E6274', fontSize: 11, marginTop: 5 },
  results: { marginTop: 20 },
  resultsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9, paddingHorizontal: 3 },
  resultsTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  count: { color: colors.muted, fontSize: 11 },
  follow: { backgroundColor: colors.warningSoft, borderRadius: 14, padding: 12, marginTop: 5 },
  followLabel: { color: '#A35F18', fontSize: 10, fontWeight: '900' },
  followText: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 3 },
  error: { color: colors.danger, fontSize: 11, marginVertical: 10 },
  composer: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, padding: 10, gap: 8 },
  input: { flex: 1, height: 46, backgroundColor: '#F8FAF9', borderWidth: 1, borderColor: colors.line, borderRadius: 15, paddingHorizontal: 14, fontSize: 13, color: colors.ink },
  send: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.white, fontSize: 22, fontWeight: '900' },
})
