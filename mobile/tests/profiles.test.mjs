import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createProfileEntry,
  deleteProfile,
  nextProfileName,
  normalizeProfiles,
  renameProfile,
  upsertProfile,
} from '../src/profiles.js'

const profileData = {
  location: '서울',
  age: '25~29살',
  housing: '자취/원룸',
  employment: '재직 중',
  income: '100~200만원',
}

test('기존 단일 프로필을 첫 멀티 프로필 항목으로 만들 수 있다', () => {
  const entry = createProfileEntry([], profileData, { id: 'legacy', now: 1_000, random: 0.1 })

  assert.equal(entry.id, 'legacy')
  assert.equal(entry.name, '프로필 1')
  assert.deepEqual(entry.data, profileData)
})

test('프로필을 추가하고 기존 프로필을 수정해도 다른 프로필은 유지된다', () => {
  const first = createProfileEntry([], profileData, { id: 'first', now: 1_000 })
  const second = createProfileEntry([first], { ...profileData, location: '부산' }, { id: 'second', now: 2_000 })
  const result = upsertProfile([first, second], 'first', { ...profileData, employment: '프리랜서' }, { now: 3_000 })

  assert.equal(nextProfileName(result.profiles), '프로필 3')
  assert.equal(result.profiles[0].data.employment, '프리랜서')
  assert.equal(result.profiles[1].data.location, '부산')
  assert.equal(result.activeProfileId, 'first')
})

test('활성 프로필 삭제 시 남은 첫 프로필을 활성화한다', () => {
  const profiles = normalizeProfiles([
    { id: 'first', name: '나', data: profileData },
    { id: 'second', name: '가족', data: { ...profileData, location: '경기' } },
  ], 1_000)
  const result = deleteProfile(profiles, 'first', 'first')

  assert.deepEqual(result.profiles.map(({ id }) => id), ['second'])
  assert.equal(result.activeProfileId, 'second')
})

test('중복 ID나 비어 있는 프로필은 복원 대상에서 제외한다', () => {
  const profiles = normalizeProfiles([
    { id: 'same', data: profileData },
    { id: 'same', data: { ...profileData, location: '부산' } },
    { id: 'empty', data: {} },
  ], 1_000)

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0].data.location, '서울')
})

test('프로필 이름을 수정하면 다른 데이터와 활성 ID는 영향을 받지 않는다', () => {
  const profiles = normalizeProfiles([
    { id: 'first', name: '프로필 1', data: profileData },
    { id: 'second', name: '프로필 2', data: { ...profileData, location: '부산' } },
  ], 1_000)

  const renamed = renameProfile(profiles, 'first', '  취업 준비  ', 2_000)

  assert.equal(renamed[0].name, '취업 준비')
  assert.deepEqual(renamed[0].data, profileData)
  assert.equal(renamed[1].name, '프로필 2')
  assert.equal(renamed[0].updatedAt, 2_000)
})

test('빈 이름이나 이미 사용 중인 이름은 저장하지 않는다', () => {
  const profiles = normalizeProfiles([
    { id: 'first', name: '나', data: profileData },
    { id: 'second', name: '가족', data: { ...profileData, location: '부산' } },
  ], 1_000)

  assert.strictEqual(renameProfile(profiles, 'first', '   '), profiles)
  assert.strictEqual(renameProfile(profiles, 'first', '가족'), profiles)
})
