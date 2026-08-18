import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { api } from '../api'
import ChatBubble from '../components/ChatBubble'
import PolicyCard from '../components/PolicyCard'
import ScreenHeader from '../components/ScreenHeader'
import { deleteSearchConversation, hasUserMessage, normalizeSearchState, selectSearchConversation, startNewSearch, updateSearchConversation } from '../searchHistory'
import { colors } from '../theme'

const SUGGESTIONS = [
  '월세 지원 받을 수 있어?',
  '취업 준비 지원금 찾아줘',
  '지금 신청 가능한 정책만 알려줘',
  '교육·자격증 지원을 찾고 있어',
]

export default function SearchScreen({ apiBase, profile, onOpenPolicy, searchState, onSearchStateChange }) {
  const [query, setQuery] = useState('')
  const [loadingConversationId, setLoadingConversationId] = useState(null)
  const [conversationErrors, setConversationErrors] = useState({})
  const [historyVisible, setHistoryVisible] = useState(false)
  const scrollRef = useRef(null)
  const normalizedState = normalizeSearchState(searchState)
  const activeConversation = normalizedState.conversations.find(
    (conversation) => conversation.id === normalizedState.activeConversationId,
  ) || normalizedState.conversations[0]
  const messages = activeConversation.messages
  const result = activeConversation.result
  const error = conversationErrors[activeConversation.id] || ''
  const loading = loadingConversationId === activeConversation.id
  const savedConversations = [...normalizedState.conversations]
    .filter(hasUserMessage)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  useEffect(() => {
    const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80)
    return () => clearTimeout(timeout)
  }, [activeConversation.id, messages.length])

  const updateConversation = (conversationId, update) => {
    onSearchStateChange((current) => updateSearchConversation(current, conversationId, update))
  }

  const submit = async (raw) => {
    const text = String(raw ?? query).trim()
    if (!text || loadingConversationId) return
    const conversationId = activeConversation.id
    setQuery('')
    setConversationErrors((current) => ({ ...current, [conversationId]: '' }))
    const nextHistory = [...messages, { role: 'user', content: text }]
    updateConversation(conversationId, { messages: nextHistory })
    setLoadingConversationId(conversationId)
    try {
      const data = await api.alanSearch(apiBase, {
        query: text,
        profileContext: profile || {},
        history: nextHistory,
        topK: 8,
        openOnly: true,
      })
      updateConversation(conversationId, (current) => ({
        ...current,
        result: data,
        messages: [...current.messages, { role: 'assistant', content: data.answer || '관련 정책을 찾았어요.' }],
      }))
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
    } catch (e) {
      setConversationErrors((current) => ({ ...current, [conversationId]: e.message }))
      updateConversation(conversationId, (current) => ({
        ...current,
        messages: [...current.messages, { role: 'assistant', content: '검색 중 문제가 발생했어요. 서버 설정과 네트워크를 확인해주세요.' }],
      }))
    } finally {
      setLoadingConversationId(null)
    }
  }

  const createNewSearch = () => {
    if (loadingConversationId) {
      Alert.alert('잠시만 기다려주세요', '현재 검색 응답을 받은 뒤 새 검색을 시작할 수 있어요.')
      return
    }
    onSearchStateChange((current) => startNewSearch(current))
    setQuery('')
    setHistoryVisible(false)
  }

  const openConversation = (conversationId) => {
    onSearchStateChange((current) => selectSearchConversation(current, conversationId))
    setQuery('')
    setConversationErrors((current) => ({ ...current, [conversationId]: '' }))
    setHistoryVisible(false)
  }

  const confirmDeleteConversation = (conversation) => {
    if (loadingConversationId === conversation.id) {
      Alert.alert('삭제할 수 없어요', '검색 응답을 받은 뒤 이 대화를 삭제해주세요.')
      return
    }
    Alert.alert(
      '대화 삭제',
      `“${conversation.title}” 대화를 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => onSearchStateChange((current) => deleteSearchConversation(current, conversation.id)),
        },
      ],
    )
  }

  const formatUpdatedAt = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString('ko-KR', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  return (
    <>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title="복지 Finder Alan AI"
          subtitle="Alan AI + 정책 DB 검색"
          rightLabel="대화 목록"
          onRight={() => setHistoryVisible(true)}
        />
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.searchIntro}>
            <View style={styles.introHeader}>
              <Text style={styles.introTitle}>🔎 검색으로 혜택을 찾아보세요</Text>
              <TouchableOpacity style={styles.inlineNewSearch} onPress={createNewSearch}>
                <Text style={styles.inlineNewSearchText}>＋ 새 검색</Text>
              </TouchableOpacity>
            </View>
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

      <Modal visible={historyVisible} transparent animationType="fade" onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setHistoryVisible(false)} />
          <View style={styles.historySheet}>
            <View style={styles.historyHeader}>
              <View style={styles.historyHeading}>
                <Text style={styles.historyTitle}>검색 대화</Text>
                <Text style={styles.historySubtitle}>대화를 선택하면 이전 검색 결과가 열립니다.</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setHistoryVisible(false)}>
                <Text style={styles.closeText}>닫기</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newSearchButton} onPress={createNewSearch}>
              <Text style={styles.newSearchText}>＋ 새 검색</Text>
            </TouchableOpacity>

            <ScrollView style={styles.historyList} contentContainerStyle={savedConversations.length ? styles.historyListContent : styles.emptyHistory}>
              {!savedConversations.length && (
                <View>
                  <Text style={styles.emptyHistoryTitle}>저장된 대화가 없습니다.</Text>
                  <Text style={styles.emptyHistoryText}>검색을 시작하면 첫 질문이 대화 제목으로 저장됩니다.</Text>
                </View>
              )}
              {savedConversations.map((conversation) => {
                const isActive = conversation.id === activeConversation.id
                const questionCount = conversation.messages.filter((message) => message.role === 'user').length
                return (
                  <View key={conversation.id} style={[styles.historyItem, isActive && styles.historyItemActive]}>
                    <TouchableOpacity style={styles.historyOpen} onPress={() => openConversation(conversation.id)}>
                      <View style={styles.historyTitleRow}>
                        <Text style={styles.historyItemTitle} numberOfLines={1}>{conversation.title}</Text>
                        {isActive && <Text style={styles.activeBadge}>현재</Text>}
                      </View>
                      <Text style={styles.historyMeta}>{formatUpdatedAt(conversation.updatedAt)} · 질문 {questionCount}개</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityLabel={`${conversation.title} 대화 삭제`}
                      style={styles.deleteButton}
                      onPress={() => confirmDeleteConversation(conversation)}
                    >
                      <Text style={styles.deleteText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 14, paddingBottom: 20 },
  searchIntro: { backgroundColor: colors.greenSoft, borderRadius: 17, padding: 14, marginBottom: 13 },
  introHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  introTitle: { flex: 1, color: colors.greenDark, fontSize: 14, fontWeight: '900' },
  introText: { color: colors.text, fontSize: 11, marginTop: 5, lineHeight: 17 },
  inlineNewSearch: { backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  inlineNewSearchText: { color: colors.greenDark, fontSize: 10, fontWeight: '900' },
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
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 32, 26, 0.42)' },
  historySheet: { maxHeight: '78%', minHeight: 330, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 18, paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 18 },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  historyHeading: { flex: 1 },
  historyTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  historySubtitle: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  closeButton: { paddingHorizontal: 8, paddingVertical: 5 },
  closeText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  newSearchButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green, borderRadius: 14, paddingVertical: 13, marginTop: 15, marginBottom: 10 },
  newSearchText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  historyList: { maxHeight: 480 },
  historyListContent: { paddingVertical: 4, gap: 8 },
  historyItem: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 15, backgroundColor: colors.white, overflow: 'hidden' },
  historyItemActive: { borderColor: colors.green, backgroundColor: colors.greenPale },
  historyOpen: { flex: 1, paddingVertical: 12, paddingLeft: 13, paddingRight: 8 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  historyItemTitle: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '800' },
  activeBadge: { color: colors.greenDark, backgroundColor: colors.greenSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: '900' },
  historyMeta: { color: colors.muted, fontSize: 10, marginTop: 5 },
  deleteButton: { alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: 13, borderLeftWidth: 1, borderLeftColor: colors.line },
  deleteText: { color: colors.danger, fontSize: 11, fontWeight: '900' },
  emptyHistory: { minHeight: 170, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyHistoryTitle: { color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyHistoryText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 6, textAlign: 'center' },
})
