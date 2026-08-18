import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isFavoritePolicy,
  normalizeFavoritePolicies,
  removeProfileFavorites,
  toggleFavoritePolicy,
} from '../src/favorites.js'

const policy = { policy: { 정책번호: 'P-1', 정책명: '청년 월세 지원' } }

test('정책을 프로필별 찜 목록에 추가하고 다시 누르면 제거한다', () => {
  const added = toggleFavoritePolicy({}, 'me', policy, 1_000)
  assert.equal(added.me.length, 1)
  assert.equal(added.me[0].savedAt, 1_000)
  assert.equal(isFavoritePolicy(added.me, policy), true)

  const removed = toggleFavoritePolicy(added, 'me', policy, 2_000)
  assert.equal(removed.me, undefined)
})

test('중복 정책과 식별할 수 없는 정책은 복원하지 않는다', () => {
  const normalized = normalizeFavoritePolicies({
    me: [{ item: policy }, { item: policy }, { item: { policy: {} } }],
  })
  assert.equal(normalized.me.length, 1)
})

test('프로필 삭제 시 해당 프로필의 찜만 제거한다', () => {
  const value = { me: [{ item: policy }], family: [{ item: policy }] }
  const next = removeProfileFavorites(value, 'me')
  assert.equal(next.me, undefined)
  assert.equal(next.family.length, 1)
})
