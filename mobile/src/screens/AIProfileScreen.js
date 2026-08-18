import React, { useMemo, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { api } from '../api'
import ChatBubble from '../components/ChatBubble'
import {
  EMPTY_PROFILE,
  PROFILE_STEPS,
  applyProfileChoice,
  countFilledProfile,
  createProfileEditRequest,
  mergeAnalyzedProfile,
  nextProfileStep,
  profileStep,
} from '../profileFlow'
import { colors } from '../theme'

const COMPLETE_MESSAGE = '프로필을 완성했어요. 이제 조건에 맞는 청년 혜택을 찾아볼 수 있어요.'

export default function AIProfileScreen({ apiBase, initialProfile, profileName = '프로필', isEditing = false, onComplete, onCancel }) {
  const initial = { ...EMPTY_PROFILE, ...(initialProfile || {}) }
  const initialStep = nextProfileStep(initial)
  const editingExisting = isEditing || Boolean(initialProfile)
  const [profile, setProfile] = useState(initial)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: initialProfile
        ? (initialStep ? `프로필을 수정해볼게요.\n\n${initialStep.text}` : '수정할 항목을 아래 프로필에서 선택해주세요.')
        : `안녕하세요! 정check Alan AI예요. ${initialStep.text}`,
    },
  ])
  const [question, setQuestion] = useState(initialStep)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const filled = useMemo(() => countFilledProfile(profile), [profile])
  const complete = filled === PROFILE_STEPS.length

  const editField = (step) => {
    if (loading) return
    setError('')
    setText('')
    setQuestion(step)
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: `${step.label} 정보를 수정할게요.\n\n${step.text}` },
    ])
  }

  const selectChoice = (choice) => {
    if (loading) return
    if (choice === '직접 입력') {
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }

    const currentStep = question?.field ? question : nextProfileStep(profile)
    if (!currentStep) return

    const nextProfile = applyProfileChoice(profile, currentStep.field, choice)
    const nextStep = nextProfileStep(nextProfile)
    setError('')
    setProfile(nextProfile)
    setQuestion(nextStep)
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: choice },
      {
        role: 'assistant',
        content: nextStep?.text || (editingExisting
          ? `${currentStep.label} 정보를 ${choice}(으)로 수정했어요. 다른 항목도 선택해서 수정할 수 있어요.`
          : COMPLETE_MESSAGE),
      },
    ])
  }

  const send = async (raw) => {
    const message = String(raw ?? text).trim()
    if (!message || loading || (editingExisting && !question) || (!editingExisting && complete)) return
    setText('')
    setError('')
    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setLoading(true)
    try {
      const requestProfile = createProfileEditRequest(profile, question?.field)
      const data = await api.profileTurn(apiBase, message, requestProfile)
      const nextProfile = mergeAnalyzedProfile(profile, data.profile)
      const nextStep = data.complete ? null : (profileStep(data.missing_field) || nextProfileStep(nextProfile))
      setProfile(nextProfile)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: editingExisting && !nextStep
          ? '말씀해주신 내용으로 수정했어요. 다른 항목도 선택해서 수정할 수 있어요.'
          : (data.reply || '내용을 반영했어요.'),
      }])
      setQuestion(nextStep || null)
    } catch (e) {
      setError(e.message)
      setMessages((prev) => [...prev, { role: 'assistant', content: '서버 연결을 확인해주세요. 입력한 내용은 아직 저장하지 않았어요.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.back}><Text style={styles.backText}>‹</Text></TouchableOpacity>
          <View style={styles.bot}><Text style={styles.botText}>AI</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.title}>정check Alan AI</Text><Text style={styles.sub}>{profileName} {editingExisting ? '수정' : '생성'} · {filled}/5</Text></View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {messages.map((m, i) => <ChatBubble key={`${i}-${m.role}`} role={m.role} text={m.content} />)}
          {loading && <View style={styles.loadingRow}><ActivityIndicator color={colors.green} /><Text style={styles.loadingText}>AI가 이해하고 있어요…</Text></View>}

          <View style={styles.profileCard}>
            <Text style={styles.profileTitle}>이렇게 이해했어요</Text>
            {editingExisting && <Text style={styles.profileHelp}>바꿀 항목을 눌러주세요.</Text>}
            {PROFILE_STEPS.map((step) => (
              <ProfileRow
                key={step.field}
                icon={step.icon}
                label={step.label}
                value={profile[step.field]}
                active={question?.field === step.field}
                onPress={editingExisting ? () => editField(step) : undefined}
              />
            ))}
          </View>

          {!!question?.choices?.length && (
            <View style={styles.choices}>
              {question.choices.map((choice) => (
                <TouchableOpacity key={choice} style={styles.choice} onPress={() => selectChoice(choice)}>
                  <Text style={styles.choiceText}>{choice}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        {editingExisting ? (
          <View style={styles.completeBar}>
            {!!question && (
              <View style={styles.composerInline}>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  onSubmitEditing={() => send()}
                  placeholder={`${question.label} 정보를 말로 입력하세요…`}
                  placeholderTextColor="#A0A8A3"
                  style={styles.input}
                  returnKeyType="send"
                />
                <TouchableOpacity style={styles.send} onPress={() => send()}><Text style={styles.sendText}>↑</Text></TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={[styles.save, !complete && styles.saveDisabled]} disabled={!complete} onPress={() => onComplete(profile)}>
              <Text style={styles.saveText}>수정 내용 저장하기</Text>
            </TouchableOpacity>
          </View>
        ) : complete ? (
          <View style={styles.completeBar}>
            <TouchableOpacity style={styles.save} onPress={() => onComplete(profile)}>
              <Text style={styles.saveText}>혜택 보러가기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.composer}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                onSubmitEditing={() => send()}
                placeholder="직접 말로 입력하세요…"
                placeholderTextColor="#A0A8A3"
                style={styles.input}
                returnKeyType="send"
              />
              <TouchableOpacity style={styles.send} onPress={() => send()}><Text style={styles.sendText}>↑</Text></TouchableOpacity>
            </View>
            <View style={styles.saveBar}>
              <TouchableOpacity style={[styles.save, filled < 2 && styles.saveDisabled]} disabled={filled < 2} onPress={() => onComplete(profile)}>
                <Text style={styles.saveText}>현재 정보로 저장하기</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function ProfileRow({ icon, label, value, active, onPress }) {
  const content = (
    <>
      <Text style={styles.profileIcon}>{icon}</Text><Text style={styles.profileLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.profileValue, !value && styles.empty]}>{value || '아직 확인 전'}</Text>
      {!!onPress && <Text style={[styles.editLabel, active && styles.editLabelActive]}>{active ? '수정 중' : '수정'}</Text>}
    </>
  )
  if (!onPress) return <View style={styles.profileRow}>{content}</View>
  return <TouchableOpacity style={[styles.profileRow, styles.editableRow, active && styles.activeRow]} onPress={onPress}>{content}</TouchableOpacity>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', height: 62, paddingHorizontal: 12, gap: 9, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 34, color: colors.ink, lineHeight: 36 },
  bot: { width: 36, height: 36, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  botText: { color: colors.white, fontSize: 11, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  sub: { color: colors.muted, fontSize: 10, marginTop: 2 },
  content: { padding: 16, paddingBottom: 30 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  loadingText: { color: colors.muted, fontSize: 12 },
  profileCard: { marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 14, backgroundColor: '#FBFCFB' },
  profileTitle: { color: colors.ink, fontWeight: '900', fontSize: 13, marginBottom: 7 },
  profileHelp: { color: colors.muted, fontSize: 10, marginTop: -3, marginBottom: 5 },
  profileRow: { flexDirection: 'row', alignItems: 'center', minHeight: 36, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 10 },
  editableRow: { marginHorizontal: -4 },
  activeRow: { backgroundColor: colors.greenSoft },
  profileIcon: { width: 25, fontSize: 14 },
  profileLabel: { width: 50, color: colors.muted, fontSize: 11, fontWeight: '700' },
  profileValue: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  empty: { color: '#B7BEB9', fontWeight: '500' },
  editLabel: { color: colors.greenDark, fontSize: 10, fontWeight: '900', marginLeft: 8 },
  editLabelActive: { color: colors.green },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: colors.white },
  choiceText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 11, marginTop: 10 },
  composer: { flexDirection: 'row', padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  composerInline: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  input: { flex: 1, height: 46, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFCFB', borderRadius: 14, paddingHorizontal: 14, color: colors.ink, fontSize: 13 },
  send: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.white, fontSize: 23, fontWeight: '900' },
  saveBar: { paddingHorizontal: 12, paddingBottom: 12, backgroundColor: colors.white },
  completeBar: { padding: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  save: { height: 48, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  saveDisabled: { opacity: 0.4 },
  saveText: { color: colors.white, fontSize: 13, fontWeight: '900' },
})
