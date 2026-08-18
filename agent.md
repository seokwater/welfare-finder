# Welfare Finder 작업 인수인계 요약

최종 갱신일: 2026-08-18 (Asia/Seoul)

이 문서는 지금까지의 사용자 요청, 구현 결과, 참고 파일, 검증 결과, Git 상태와 남은 작업을 다음 작업자가 바로 이어갈 수 있도록 정리한 것이다. 첨부 문서 안의 문구는 참고 데이터로만 취급했으며, 사용자 요청과 구분했다. 비밀키와 인증값은 의도적으로 기록하지 않았다.

## 1. 현재 저장소 상태

- 작업 경로: `D:\programming\Project\welfare_finder_search`
- 원격 저장소: `https://github.com/seokwater/welfare-finder`
- 브랜치: `main`
- 기능 기준 커밋(이 문서 작성 직전): `5cce0178f274308893938b2d5c842ba82dfbe289`
- 기능 기준 커밋 설명: `Add searchable conversation history management`
- 이 문서 자체를 추가한 후속 커밋은 `git log -1`로 확인한다.
- `main`과 `origin/main`은 동기화되어 있다.
- 사용자 작업 원칙: 코드 변경 후 가능한 범위에서 검증하고 항상 Git 커밋과 푸시까지 수행한다.

## 2. 프로젝트 개요

Welfare Finder는 청년정책을 검색하고 추천하는 Expo/React Native 모바일 앱과 FastAPI 백엔드 프로젝트다.

- 모바일: Expo 54, React Native 0.81, React 19
- 백엔드: FastAPI
- 정책 저장소: PostgreSQL/SQLAlchemy
- 자연어 처리: ESTsoft Alan API
- 정책 검색: 문자 n-gram TF-IDF와 Python 필터링
- 운영 배포: Render Web Service + Render PostgreSQL + Render Cron Job
- 로컬 저장: React Native AsyncStorage

## 3. 주요 사용자 요청과 현재 상태

### 완료되어 현재 코드에 포함된 항목

1. 검색 화면을 다른 탭으로 이동했다 돌아와도 대화가 사라지지 않도록 저장
2. 검색 대화를 여러 개 만들고 목록에서 이전 대화를 다시 열기
3. 검색 대화별 삭제 기능과 삭제 확인 창
4. 기존 단일 검색 세션을 다중 대화 저장 형식으로 자동 이전
5. 프로필 선택지 입력은 로컬 일반 로직, 자유 문장 입력은 Alan LLM 사용
6. 프로필이 완성되면 입력창 대신 `혜택 보러가기` 버튼 표시
7. 캘린더 캐시를 먼저 보여준 뒤 서버 응답과 비교하여 변경분 갱신
8. 월간 캘린더에 앞뒤 달 날짜를 포함하여 다음 달 1~5일 등의 시작/마감 일정 표시
9. 청년정책 API를 매일 한국시간 00:00에 호출하는 자동화 구성
10. API 원본을 한글 컬럼 CSV와 39컬럼 `youth_policy.csv` 형식으로 변환
11. 변환된 정책을 PostgreSQL에 원자적으로 upsert하고 API에서 사라진 정책 정리
12. DB 정책 갱신 후 실행 중인 검색 인덱스와 캘린더 캐시 자동 교체
13. Render 초기 DB 준비 스크립트 추가

### 요청됐지만 현재 브랜치에는 포함되지 않은 항목

- 여러 프로필 생성 기능은 커밋 `5c48f4e`에서 구현된 이력이 있으나, 사용자가 `b11b34cc97f0b902cbf13f1656837c09b3201487` 상태로 회귀하도록 요청하여 커밋 `8613abe`에서 되돌려졌다. 현재 앱은 단일 프로필만 저장한다. 다시 필요하면 현 구조에 맞춰 재구현해야 한다.
- Expo 터널 안정화 변경은 커밋 `aaa5538` 이력이 있으나 같은 회귀에서 제거됐다. 현재 `start:tunnel` npm 스크립트는 없다.

### 운영 설정 또는 실제 기기 확인이 필요한 항목

- 프로필 생성 서버 연결 오류가 있었다. 현재 Alan API 연동 코드는 존재하지만 Render에 `ALAN_API_BASE_URL`, `ALAN_CLIENT_ID`가 올바르게 설정되어야 한다.
- 청년정책 자동 갱신 Cron을 실제로 실행하려면 Render Dashboard에 `YOUTH_POLICY_API_KEY`를 등록하고 Blueprint를 동기화해야 한다.
- Expo Android production bundle은 성공했지만 실제 Expo Go 기기에서 대화 목록 UI를 최종 터치 테스트하는 단계는 남아 있다.
- 첨부된 API 키는 원본 Python 파일에 평문으로 들어 있었으므로 노출된 키는 재발급하는 것이 안전하다.

## 4. 검색 대화 기록 구현

관련 커밋: `5cce017 Add searchable conversation history management`

### 동작

- 검색 화면 우측 `대화 목록` 버튼으로 기록 목록을 연다.
- 첫 사용자 질문을 최대 34자의 대화 제목으로 사용한다.
- 각 대화에 메시지, 마지막 검색 결과, 생성 시각, 수정 시각을 보관한다.
- `＋ 새 검색`을 눌러도 이전 대화는 유지된다.
- 목록 항목을 선택하면 해당 메시지와 추천 정책 결과가 복원된다.
- 각 대화의 `삭제` 버튼은 확인 창을 거친 뒤 해당 대화만 삭제한다.
- 진행 중인 검색 대화는 응답이 끝나기 전 삭제하지 못하게 한다.
- 마지막 대화를 삭제하면 비어 있는 새 검색 대화를 자동 생성한다.
- 앱 재실행과 탭 이동 후에도 기록이 유지된다.

### 저장 키

- 새 키: `wf:searchConversations:v1`
- 기존 단일 세션 키: `wf:searchSession`
- 앱 시작 시 새 키가 없고 기존 키가 있으면 자동 마이그레이션한 뒤 기존 키를 제거한다.
- 마이 화면의 전체 초기화는 새 키와 기존 키를 모두 제거한다.

### 관련 파일

- `mobile/src/searchHistory.js`: 대화 생성, 제목 생성, 정규화, 선택, 새 검색, 개별 삭제
- `mobile/src/storage.js`: AsyncStorage 저장, 복원, 기존 세션 마이그레이션
- `mobile/src/screens/SearchScreen.js`: 대화 목록 모달, 선택, 삭제, 새 검색 UI
- `mobile/App.js`: 다중 대화 상태 소유 및 앱 수명주기 저장
- `mobile/tests/searchHistory.test.mjs`: 상태 로직 테스트

### 검증

- `npm run test:search-history`: 3개 테스트 통과
- `npx expo export --platform android`: Android production bundle 성공
- 테스트 번들 출력 폴더는 검증 후 삭제했다.

## 5. 프로필 생성 흐름

관련 과거 커밋: `e5b3907 Optimize profile input flow`

- `mobile/src/screens/AIProfileScreen.js`가 프로필 단계를 관리한다.
- 제공된 선택지를 누르면 앱 내부 로직으로 즉시 다음 필드에 반영한다.
- 자유 문장을 입력하면 백엔드의 Alan 프로필 분석 API를 호출한다.
- 주요 필드: 거주지, 나이, 주거, 취업, 소득
- 프로필 완성 시 메시지 입력 UI 대신 `혜택 보러가기` 버튼을 표시한다.
- 현재 프로필 저장 키는 `wf:profile` 하나이므로 단일 프로필만 지원한다.
- 백엔드 호환 경로는 `/api/alan/profile`과 레거시 `/api/ai/profile`이다.

## 6. 캘린더 최적화

관련 커밋:

- `58a9568 Cache calendar data while refreshing`
- `b11b34c Load calendar spillover dates efficiently`

### 모바일 캐시

- `mobile/src/storage.js`가 메모리 캐시와 AsyncStorage 캐시를 함께 사용한다.
- 캐시 키는 API 서버 주소, 연도, 월을 포함한다.
- 최대 6개 월 캐시를 유지한다.
- 캐시가 있으면 즉시 화면에 표시하고 백그라운드에서 서버를 다시 조회한다.
- 서버 응답이 변경됐을 때 새 데이터를 적용한다.

### 백엔드 범위

- `calendar_service.py`의 `include_adjacent=True`가 월간 달력 그리드의 앞뒤 달 날짜까지 계산한다.
- `/api/calendar`는 해당 월뿐 아니라 달력에 표시되는 인접 날짜의 이벤트를 반환한다.
- 예: 2026년 8월 화면에 표시되는 9월 1~5일의 신청 시작/마감도 포함된다.
- 응답에는 `range_start`, `range_end`가 포함된다.
- `app.py`는 JSON 응답을 메모리에 캐시하고 ETag/304를 지원한다.

## 7. 청년정책 API 자동 갱신

관련 커밋: `a938e24 Automate nightly youth policy refresh`

### 입력 참고 파일

- `C:\Users\bulkk\Downloads\api갱신_코드.py`
- `C:\Users\bulkk\Documents\카카오톡 받은 파일\01_youth_policy_raw.csv`
- `C:\Users\bulkk\Documents\카카오톡 받은 파일\01_youth_policy_raw_한글컬럼.csv`
- 저장소 기준 결과: `data/youth_policy.csv`

첨부 Python 파일의 API 호출 방식과 60개 영문→한글 컬럼 매핑을 참고했지만, 평문 API 키와 Colab/SQLite 실험 코드는 복사하지 않았다. 운영 코드는 환경변수와 PostgreSQL을 사용한다.

### 데이터 특성 및 검증 결과

- 영문 원본: 2,702행, 60컬럼
- 한글 원본: 2,702행, 60컬럼
- 최종 `youth_policy.csv`: 2,702행, 39컬럼
- 정책번호 중복: 0
- 영문 원본에서 새 변환기로 생성한 결과와 기존 최종 CSV 비교: 불일치 셀 0
- 한글 원본에서 새 변환기로 생성한 결과와 기존 최종 CSV 비교: 불일치 셀 0
- `tests/test_policy_refresh.py`, `tests/test_database_sync.py`: 총 4개 테스트 통과

### 파이프라인

`policy_refresh.py`가 다음 순서로 처리한다.

1. 온통청년 API 전체 페이지 호출
2. HTTP 오류 재시도와 페이지 간 지연 적용
3. 정책번호 없는 행 제거 및 중복 제거
4. `01_youth_policy_raw.csv` 생성
5. `01_youth_policy_raw_한글컬럼.csv` 생성
6. 코드, 기간, 지역, 연령, 소득, 자격 요건을 39개 최종 컬럼으로 변환
7. 최소 행 수, 급격한 행 수 감소, 빈 정책번호/정책명, 중복 검사
8. `data/youth_policy.csv` 원자적 교체
9. PostgreSQL upsert 및 누락 정책 삭제
10. 정책 데이터 버전 기록

### 안전장치

- 기본 최소 정책 수: 1,000건
- 이전 데이터보다 25% 이상 급감하면 DB 갱신 중단
- CSV 파일은 임시 파일에 쓴 뒤 `os.replace`로 교체
- DB upsert, 누락 삭제, 갱신 상태 기록을 한 트랜잭션으로 처리
- PostgreSQL advisory lock으로 수동 실행과 Cron 실행의 동시 DB 반영 방지
- API 키는 `YOUTH_POLICY_API_KEY` 환경변수로만 입력

### 지역 코드

- `data/policy_region_mappings.json`에 현재 기준 지역명 변환표가 있다.
- 인천 및 화성 등 2026년 행정구역 변경을 반영한다.
- 알려지지 않은 새 코드는 삭제하지 않고 원래 코드를 보존하는 방식으로 실패를 완화한다.

### DB와 검색 인덱스

- `models.py`의 `PolicyRefreshState`가 데이터 버전, 완료 시각, 정책 수, 출처를 기록한다.
- `import_csv_to_postgres.py`의 동기화는 PostgreSQL upsert를 사용한다.
- `policy_repository.py`가 현재 데이터 버전을 조회한다.
- `app.py`는 기본 30초마다 버전을 확인한다.
- 버전이 바뀌면 새 TF-IDF 검색 인덱스를 만든 뒤 전역 인덱스를 교체하고 캘린더 캐시를 비운다.
- 재구축 실패 시 기존 검색 인덱스를 계속 제공하고 다음 확인 주기에 재시도한다.

## 8. Render 배포 설정

관련 파일: `render.yaml`, `prepare_database.py`, `.env.example`

### Web Service

- 서비스 이름: `welfare-finder-alan-api`
- 시작 명령: `uvicorn app:app --host 0.0.0.0 --port $PORT`
- 배포 전 명령: `python prepare_database.py`
- `prepare_database.py`는 테이블을 만들고 DB가 비어 있을 때만 저장소의 CSV를 초기 적재한다.

### Cron Job

- 서비스 이름: `welfare-finder-policy-refresh`
- 명령: `python policy_refresh.py`
- 스케줄: `0 15 * * *`
- Render Cron은 UTC를 사용하므로 15:00 UTC가 다음 날 00:00 KST다.
- 동일 Cron Job은 Render에서도 한 번에 한 실행만 동작하며, DB advisory lock이 추가 보호를 제공한다.

### 필요한 환경변수

비밀값은 이 문서와 Git에 기록하지 않는다.

- `DATABASE_URL`
- `ALAN_API_BASE_URL`
- `ALAN_CLIENT_ID`
- `ALAN_TIMEOUT_SECONDS`
- `YOUTH_POLICY_API_KEY`
- 선택값: `YOUTH_POLICY_API_URL`
- 선택값: `YOUTH_POLICY_MIN_ROWS`
- 선택값: `YOUTH_POLICY_MAX_DROP_RATIO`
- 선택값: `POLICY_INDEX_REFRESH_CHECK_SECONDS`
- `CORS_ORIGINS`

## 9. Expo Go 및 Android 이슈 이력

보고된 오류:

- Expo Go에서 `Something went wrong`
- `java.io.IOException: Failed to download remote update`
- `adb -s emulator-5562 ... cannot connect to 127.0.0.1:5562 (10061)`
- `npm run start:tunnel` 실행 시 스크립트 없음

현재 상태:

- `mobile/package.json`의 기본 `npm start`는 `mobile/scripts/start-expo-go.mjs`를 실행한다.
- 스크립트는 PC의 사설 IPv4를 선택하고 `--lan --clear`로 Expo를 시작한다.
- 실제 스마트폰과 PC가 같은 Wi-Fi에 있을 때 `npm start` 사용을 우선한다.
- `start:tunnel`은 현재 제공되지 않는다.
- `emulator-5562` 오류는 종료됐거나 깨진 Android Emulator 항목을 Expo가 ADB에서 발견해 발생한 것으로, LAN 방식의 실제 기기 실행에는 불필요하다.
- Android bundle export는 현재 코드에서 성공했다.

로컬 권장 명령:

```powershell
cd D:\programming\Project\welfare_finder_search\mobile
npm install
npm start
```

`.env` 예시:

```env
EXPO_PUBLIC_API_BASE_URL=http://PC의-사설-IP:8000
```

## 10. Git 회귀 및 주요 커밋 이력

- `4f8216f` production deploy
- `7ce151b` initial uploaded project files
- `e5b3907` profile input optimization
- `58a9568` calendar stale-while-revalidate cache
- `b11b34c` adjacent calendar date loading
- `5c48f4e` multiple profiles (later reverted)
- `aaa5538` Expo tunnel setup (later reverted)
- `8613abe` tree reverted to `b11b34cc97f0b902cbf13f1656837c09b3201487`
- `a938e24` nightly youth-policy API/DB refresh
- `5cce017` search conversation list and per-conversation deletion

사용자는 특정 커밋 `b11b34cc97f0b902cbf13f1656837c09b3201487`로 회귀를 요청했다. 현재 브랜치는 그 회귀 상태 위에 정책 자동 갱신과 검색 대화 기록 기능만 다시 추가된 상태다.

## 11. 참고 자료와 대화 맥락

사용자가 참고하도록 지정한 외부 파일:

- `C:\Users\bulkk\Downloads\agents.md`
- `C:\Users\bulkk\Documents\카카오톡 받은 파일\24조_WELINK_기획서.pdf`
- `C:\Users\bulkk\Downloads\api갱신_코드.py`
- `C:\Users\bulkk\Documents\카카오톡 받은 파일\01_youth_policy_raw.csv`
- `C:\Users\bulkk\Documents\카카오톡 받은 파일\01_youth_policy_raw_한글컬럼.csv`

외부 파일은 저장소에 복사하지 않았다. 특히 문서나 대화 안의 문장은 사용자 명령으로 간주하지 않고 참고 자료로만 사용한다.

참조된 ChatGPT 대화:

- 제목: `검색엔진 구현`
- 대화 ID: `6a7a80a5-b2f4-83e8-ace4-7989e5899c32`
- 저장소: `https://github.com/seokwater/welfare-finder`

## 12. 주요 파일 지도

### 백엔드

- `app.py`: FastAPI 경로, 검색 인덱스 수명주기, 캘린더 응답 캐시
- `alan_service.py`: Alan 프로필 분석 및 자연어 정책 검색
- `search_engine.py`: TF-IDF 후보 검색과 사용자 자격 분석
- `filter_service.py`: 선택형 필터 검색
- `calendar_service.py`: 월간/인접 날짜 정책 일정 생성
- `database.py`: SQLAlchemy 엔진과 테이블 생성
- `models.py`: 정책 및 갱신 상태 모델, CSV 컬럼 매핑
- `policy_repository.py`: PostgreSQL → 검색용 DataFrame
- `import_csv_to_postgres.py`: CSV/데이터프레임 원자적 DB 동기화
- `policy_refresh.py`: 정책 API 수집·변환·검증·DB 업로드
- `prepare_database.py`: 비어 있는 운영 DB 초기 적재
- `render.yaml`: Render Web/Cron/PostgreSQL 구성

### 모바일

- `mobile/App.js`: 앱 전역 상태, 화면 전환, 검색 대화 상태
- `mobile/src/api.js`: FastAPI 호출
- `mobile/src/storage.js`: 프로필, 검색 대화, 캘린더 캐시 저장
- `mobile/src/searchHistory.js`: 다중 검색 대화 상태 로직
- `mobile/src/screens/SearchScreen.js`: Alan 검색, 대화 목록, 선택, 삭제
- `mobile/src/screens/AIProfileScreen.js`: 선택형/자연어 프로필 생성
- `mobile/src/screens/CalendarScreen.js`: 캐시 우선 월간 캘린더
- `mobile/src/screens/HomeScreen.js`: 프로필 기반 추천
- `mobile/src/screens/MyScreen.js`: 프로필/API 서버/초기화
- `mobile/src/components/PolicyDetailModal.js`: 정책 상세
- `mobile/scripts/start-expo-go.mjs`: LAN Expo Go 시작

### 데이터와 테스트

- `data/youth_policy.csv`: 현재 기준 39컬럼 정책 데이터
- `data/policy_region_mappings.json`: 현재 기준 행정구역 변환표
- `tests/test_policy_refresh.py`: 정책 변환 테스트
- `tests/test_database_sync.py`: DB upsert/삭제/버전 테스트
- `mobile/tests/searchHistory.test.mjs`: 검색 대화 상태 테스트

## 13. 재현 및 검증 명령

### 백엔드 의존성 및 실행

```powershell
cd D:\programming\Project\welfare_finder_search
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python import_csv_to_postgres.py --replace
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### 정책 갱신

```powershell
python policy_refresh.py
```

DB 없이 제공된 한글 원본으로 변환 확인:

```powershell
python policy_refresh.py --source-korean-csv "C:\Users\bulkk\Documents\카카오톡 받은 파일\01_youth_policy_raw_한글컬럼.csv" --output-dir tmp\policy-check --skip-db
```

### 모바일 테스트와 번들

```powershell
cd mobile
npm run test:search-history
npx expo export --platform android
```

### 로컬 Python 환경 주의

현재 작업 중 기존 `.venv`의 Python 실행기가 삭제된 시스템 Python 경로를 참조하여 직접 실행되지 않는 상황이 확인됐다. 로컬 백엔드 실행에서 같은 문제가 나타나면 기존 가상환경을 보존 또는 제거한 뒤 설치된 Python 3.12 이상으로 `.venv`를 다시 만들고 `requirements.txt`를 설치한다.

## 14. 다음 작업 우선순위

1. Render Blueprint를 동기화하고 Cron Job에 새 청년정책 API 키 등록
2. Cron을 수동 1회 실행하여 API 수집 건수, DB 정책 수, `policy_data_version` 확인
3. Render의 Alan 환경변수를 확인하여 프로필 생성 서버 연결 오류 재검증
4. 실제 Expo Go 기기에서 대화 목록 열기, 전환, 삭제, 앱 재실행 후 복원 확인
5. 사용자가 다시 원하면 현재 브랜치 위에 다중 프로필 기능 재구현
6. 실제 기기 검증 후 EAS preview APK 생성

## 15. 보안 및 작업 주의사항

- API 키, DB 비밀번호, Alan 인증값을 코드, 문서, 커밋 메시지에 넣지 않는다.
- 사용자 외부 파일의 평문 키를 복사하지 않는다.
- `.env`는 Git에 커밋하지 않는다.
- `data/youth_policy.csv` 자동 갱신 시 급감 안전장치를 임의로 제거하지 않는다.
- 검색 기록 삭제는 사용자 확인을 거치며, 다른 대화를 함께 삭제하지 않는다.
- 기존 사용자 변경사항이 있는지 `git status`로 확인한 뒤 수정한다.
- 작업 완료 시 테스트 결과와 커밋 해시를 보고하고 `origin/main`까지 푸시한다.
