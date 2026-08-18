export const DEFAULT_SEARCH_GREETING = '궁금한 혜택을 자연스럽게 물어보세요. 저장된 프로필과 실제 정책 DB를 함께 확인할게요.'

function createConversationId(now = Date.now()) {
  return `search-${now}-${Math.random().toString(36).slice(2, 9)}`
}

export function validMessages(messages) {
  if (!Array.isArray(messages)) return []
  return messages.filter((message) => (
    ['user', 'assistant'].includes(message?.role)
    && typeof message?.content === 'string'
    && message.content.trim()
  )).map((message) => ({ role: message.role, content: message.content }))
}

export function hasUserMessage(conversation) {
  return conversation?.messages?.some((message) => message.role === 'user') || false
}

export function conversationTitle(messages) {
  const firstQuestion = validMessages(messages).find((message) => message.role === 'user')?.content || ''
  const oneLine = firstQuestion.replace(/\s+/g, ' ').trim()
  if (!oneLine) return '새 검색'
  return oneLine.length > 34 ? `${oneLine.slice(0, 34)}…` : oneLine
}

export function createSearchConversation(options = {}) {
  const now = Number(options.now) || Date.now()
  const messages = validMessages(options.messages)
  const normalizedMessages = messages.length
    ? messages
    : [{ role: 'assistant', content: options.greeting || DEFAULT_SEARCH_GREETING }]
  return {
    id: options.id || createConversationId(now),
    title: conversationTitle(normalizedMessages),
    messages: normalizedMessages,
    result: options.result && typeof options.result === 'object' ? options.result : null,
    createdAt: Number(options.createdAt) || now,
    updatedAt: Number(options.updatedAt) || now,
  }
}

export function createInitialSearchState(options = {}) {
  const conversation = createSearchConversation(options)
  return { conversations: [conversation], activeConversationId: conversation.id }
}

export function normalizeSearchState(value) {
  const conversations = Array.isArray(value?.conversations)
    ? value.conversations
        .filter((conversation) => conversation && typeof conversation === 'object')
        .map((conversation) => createSearchConversation(conversation))
        .filter((conversation, index, items) => items.findIndex((item) => item.id === conversation.id) === index)
    : []

  if (!conversations.length) return createInitialSearchState()
  const requestedId = value?.activeConversationId
  const activeConversationId = conversations.some((conversation) => conversation.id === requestedId)
    ? requestedId
    : [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)[0].id
  return { conversations, activeConversationId }
}

export function legacySessionToSearchState(session, options = {}) {
  const messages = validMessages(session?.messages)
  if (!messages.length) return null
  const conversation = createSearchConversation({
    ...options,
    messages,
    result: session?.result,
  })
  return { conversations: [conversation], activeConversationId: conversation.id }
}

export function updateSearchConversation(state, conversationId, updater, now = Date.now()) {
  const normalized = normalizeSearchState(state)
  let found = false
  const conversations = normalized.conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation
    found = true
    const update = typeof updater === 'function' ? updater(conversation) : updater
    const next = { ...conversation, ...(update || {}) }
    const messages = validMessages(next.messages)
    return {
      ...next,
      messages: messages.length ? messages : conversation.messages,
      title: conversationTitle(messages.length ? messages : conversation.messages),
      result: next.result && typeof next.result === 'object' ? next.result : null,
      updatedAt: now,
    }
  })
  return found ? { ...normalized, conversations } : normalized
}

export function selectSearchConversation(state, conversationId) {
  const normalized = normalizeSearchState(state)
  return normalized.conversations.some((conversation) => conversation.id === conversationId)
    ? { ...normalized, activeConversationId: conversationId }
    : normalized
}

export function startNewSearch(state, options = {}) {
  const normalized = normalizeSearchState(state)
  const active = normalized.conversations.find((conversation) => conversation.id === normalized.activeConversationId)
  if (active && !hasUserMessage(active) && !active.result) return normalized

  const conversation = createSearchConversation({
    ...options,
    greeting: '새로 검색해볼게요. 어떤 혜택을 찾고 있나요?',
  })
  return {
    conversations: [...normalized.conversations, conversation],
    activeConversationId: conversation.id,
  }
}

export function deleteSearchConversation(state, conversationId, options = {}) {
  const normalized = normalizeSearchState(state)
  const remaining = normalized.conversations.filter((conversation) => conversation.id !== conversationId)
  if (remaining.length === normalized.conversations.length) return normalized
  if (!remaining.length) return createInitialSearchState(options)
  if (normalized.activeConversationId !== conversationId) {
    return { ...normalized, conversations: remaining }
  }
  const nextActive = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  return { conversations: remaining, activeConversationId: nextActive.id }
}
