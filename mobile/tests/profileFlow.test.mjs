import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyProfileChoice,
  countFilledProfile,
  createProfileEditRequest,
  mergeAnalyzedProfile,
  nextProfileStep,
  normalizeDirectProfileInput,
} from '../src/profileFlow.js'

const completeProfile = {
  location: '서울',
  age: '25~29살',
  housing: '자취/원룸',
  employment: '재직 중',
  income: '100~200만원',
}

test('완성된 프로필에서도 선택한 항목을 다시 수정할 수 있다', () => {
  assert.equal(nextProfileStep(completeProfile), null)

  const changed = applyProfileChoice(completeProfile, 'location', '경기')

  assert.equal(changed.location, '경기')
  assert.equal(countFilledProfile(changed), 5)
  assert.equal(completeProfile.location, '서울')
})

test('자유 입력 분석 시 선택 필드만 비우고 분석된 새 값을 기존 프로필에 병합한다', () => {
  const requestProfile = createProfileEditRequest(completeProfile, 'employment')
  assert.equal(requestProfile.employment, '')
  assert.equal(requestProfile.location, '서울')

  const changed = mergeAnalyzedProfile(completeProfile, {
    ...requestProfile,
    employment: '프리랜서',
  })

  assert.equal(changed.employment, '프리랜서')
  assert.equal(changed.location, '서울')
  assert.equal(countFilledProfile(changed), 5)
})

test('분석 결과가 비어 있으면 저장된 값을 잃지 않는다', () => {
  const unchanged = mergeAnalyzedProfile(completeProfile, { employment: '' })

  assert.deepEqual(unchanged, completeProfile)
})

test('나이 단계의 숫자 단독 입력을 만 나이로 정규화한다', () => {
  assert.equal(normalizeDirectProfileInput('age', '22'), '만 22세')
  assert.equal(normalizeDirectProfileInput('age', ' 만 25살 '), '만 25세')
  assert.equal(normalizeDirectProfileInput('age', '0'), '')
  assert.equal(normalizeDirectProfileInput('age', '100'), '')
  assert.equal(normalizeDirectProfileInput('location', '22'), '')
})
