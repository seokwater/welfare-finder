import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createInitialSearchState,
  deleteSearchConversation,
  legacySessionToSearchState,
  selectSearchConversation,
  startNewSearch,
  updateSearchConversation,
} from '../src/searchHistory.js'

test('첫 질문을 제목으로 저장하고 새 검색에서도 이전 대화를 유지한다', () => {
  let state = createInitialSearchState({ id: 'first', now: 1_000 })
  state = updateSearchConversation(state, 'first', (conversation) => ({
    messages: [...conversation.messages, { role: 'user', content: '서울 청년 월세 지원을 찾아줘' }],
    result: { count: 2 },
  }), 1_100)

  assert.equal(state.conversations[0].title, '서울 청년 월세 지원을 찾아줘')
  assert.deepEqual(state.conversations[0].result, { count: 2 })

  state = startNewSearch(state, { id: 'second', now: 1_200 })
  assert.equal(state.conversations.length, 2)
  assert.equal(state.activeConversationId, 'second')
  assert.equal(state.conversations[0].id, 'first')
})

test('대화를 선택하고 각각 삭제할 수 있다', () => {
  let state = createInitialSearchState({ id: 'first', now: 1_000 })
  state = updateSearchConversation(state, 'first', (conversation) => ({
    messages: [...conversation.messages, { role: 'user', content: '첫 질문' }],
  }), 1_100)
  state = startNewSearch(state, { id: 'second', now: 1_200 })
  state = updateSearchConversation(state, 'second', (conversation) => ({
    messages: [...conversation.messages, { role: 'user', content: '둘째 질문' }],
  }), 1_300)

  state = selectSearchConversation(state, 'first')
  assert.equal(state.activeConversationId, 'first')

  state = deleteSearchConversation(state, 'first')
  assert.deepEqual(state.conversations.map(({ id }) => id), ['second'])
  assert.equal(state.activeConversationId, 'second')

  state = deleteSearchConversation(state, 'second', { id: 'empty', now: 1_400 })
  assert.deepEqual(state.conversations.map(({ id }) => id), ['empty'])
  assert.equal(state.activeConversationId, 'empty')
})

test('기존 단일 검색 세션을 대화 목록 형식으로 마이그레이션한다', () => {
  const state = legacySessionToSearchState({
    messages: [
      { role: 'assistant', content: '무엇을 찾나요?' },
      { role: 'user', content: '취업 지원금' },
    ],
    result: { count: 1 },
  }, { id: 'legacy', now: 2_000 })

  assert.equal(state.activeConversationId, 'legacy')
  assert.equal(state.conversations[0].title, '취업 지원금')
  assert.deepEqual(state.conversations[0].result, { count: 1 })
})
