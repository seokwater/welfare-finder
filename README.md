# 복지 Finder AI — 모바일 앱 전체 프로젝트

기존 웹 프로토타입을 **Expo + React Native 모바일 앱**으로 재구성한 버전입니다.
백엔드는 FastAPI, 정책 저장소는 PostgreSQL, 자연어 이해/설명은 OpenAI API, 정책 후보 검색과 자격 분석은 Python 검색엔진을 사용합니다.

## 전체 구조

```text
Android / iOS
React Native + Expo
  ├─ 온보딩
  ├─ 복지 Finder AI 프로필 생성
  ├─ 홈 추천
  ├─ 검색 탭 (기존 혜택 탭 대체)
  ├─ 실제 정책 캘린더
  └─ 마이 / 서버 설정
          ↓ HTTP API
FastAPI
  ├─ /api/ai/profile
  ├─ /api/ai/search
  ├─ /api/search
  └─ /api/calendar
          ↓
Python 검색엔진
  ├─ 문자 n-gram TF-IDF
  ├─ 지역/나이/취업/학력/소득 자격 분석
  ├─ 신청기간 분석
  └─ GPT 검색 계획 + 결과 설명
          ↓
PostgreSQL policies
```

## 주요 모바일 기능

1. **온보딩** — 제공된 복지 Finder UI 방향을 모바일 네이티브 화면으로 구현
2. **AI 프로필** — 사용자 문장을 GPT API로 분석해 거주지/나이/주거/취업/소득 저장
3. **홈** — 저장 프로필 기준 지금 확인할 정책과 가까운 시작/마감 일정 표시
4. **검색** — 하단의 기존 `혜택` 메뉴를 없애고 `검색` 메뉴로 변경
5. **복지 Finder AI 검색** — 자연어 질문 → GPT 구조화 → PostgreSQL 정책 검색 → Python 자격 분석 → GPT 설명
6. **검색 대화 기록** — 여러 검색 대화를 기기에 보관하고 목록에서 다시 열거나 개별 삭제
7. **캘린더** — 정책 DB의 실제 `신청기간_정리`를 월간 달력에 표시
8. **기기 캘린더 연동** — 신청 시작/마감 일정을 Android/iOS 시스템 캘린더 생성 화면으로 전달
9. **정책 상세** — 자격 분석 이유, 지원 내용, 신청 기간, 신청 방법, 제출서류, 공식 신청 URL
10. **마이** — AI 프로필 수정, API 서버 주소 변경, PostgreSQL/GPT 연결 상태 확인
11. **로컬 저장** — 온보딩/프로필/API 주소와 검색 대화 목록을 AsyncStorage에 저장

## 폴더 구조

```text
welfare_finder_mobile_gpt_ai/
├─ app.py
├─ ai_service.py
├─ calendar_service.py
├─ search_engine.py
├─ filter_service.py
├─ filter_options.py
├─ database.py
├─ models.py
├─ policy_repository.py
├─ import_csv_to_postgres.py
├─ db_check.py
├─ requirements.txt
├─ compose.yaml
├─ .env.example
├─ data/
│  └─ youth_policy.csv
├─ setup_postgres.bat
├─ start_backend.bat
├─ start_mobile.bat
└─ mobile/
   ├─ App.js
   ├─ app.json
   ├─ package.json
   ├─ eas.json
   ├─ .env.example
   └─ src/
      ├─ api.js
      ├─ storage.js
      ├─ theme.js
      ├─ utils.js
      ├─ components/
      │  ├─ BottomTabs.js
      │  ├─ ChatBubble.js
      │  ├─ MonthCalendar.js
      │  ├─ PolicyCard.js
      │  ├─ PolicyDetailModal.js
      │  └─ ScreenHeader.js
      └─ screens/
         ├─ OnboardingScreen.js
         ├─ AIProfileScreen.js
         ├─ HomeScreen.js
         ├─ SearchScreen.js
         ├─ CalendarScreen.js
         └─ MyScreen.js
```

# Windows 실행 방법

## 1. 준비 프로그램

- Docker Desktop
- Python 3.11 이상
- Node.js 20 이상
- Expo Go(Android/iOS) 또는 Android Emulator
- OpenAI API Key

## 2. 프로젝트 압축 해제 후 이동

```bat
cd "C:\Users\PC2411\Desktop\EST 메인프로젝트\welfare_finder_mobile_gpt_ai"
```

## 3. 환경변수 생성

```bat
copy .env.example .env
```

`.env`:

```env
DATABASE_URL=postgresql+psycopg://welfare:welfare@127.0.0.1:5432/welfare_finder
OPENAI_API_KEY=sk-본인키
OPENAI_MODEL=gpt-5-mini
CORS_ORIGINS=*
```

> OpenAI API Key는 모바일 앱이나 React Native 소스에 넣지 않습니다. FastAPI 서버에만 둡니다.

## 4. PostgreSQL + Python 준비

가장 간단한 방법:

```bat
setup_postgres.bat
```

직접 실행하려면:

```bat
docker compose up -d postgres
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python import_csv_to_postgres.py --replace
python db_check.py
```

정상 적재 시 정책 약 2,702개가 `policies` 테이블에 들어갑니다.

## 청년정책 API 자동 갱신

`policy_refresh.py`는 아래 과정을 한 번에 실행합니다.

1. 온통청년 API의 모든 페이지를 재시도와 함께 수집
2. `01_youth_policy_raw.csv`와 `01_youth_policy_raw_한글컬럼.csv` 생성
3. 코드·기간·지역·자격 조건을 39개 컬럼의 `data/youth_policy.csv` 형식으로 변환
4. 정책 수 급감, 빈 정책번호, 중복 정책번호를 검증
5. PostgreSQL에 한 트랜잭션으로 upsert하고 API에서 사라진 정책을 정리
6. 갱신 버전을 기록해 실행 중인 API 서버가 30초 이내에 검색 인덱스와 캘린더 캐시를 교체

`.env`에 발급받은 키를 설정한 뒤 수동 실행할 수 있습니다.

```env
YOUTH_POLICY_API_KEY=발급받은-API-키
```

```bat
python policy_refresh.py
```

DB 반영 없이 제공받은 원본으로 변환만 검증하려면 다음처럼 실행합니다.

```bat
python policy_refresh.py --source-korean-csv "01_youth_policy_raw_한글컬럼.csv" --output-dir tmp\policy-check --skip-db
```

운영 환경의 `render.yaml`에는 매일 한국시간 00:00에 실행되는 Cron Job이 포함되어 있습니다. Render 스케줄은 UTC 기준이므로 `0 15 * * *`로 설정되어 있습니다. Blueprint를 처음 연결할 때 Cron Job의 `YOUTH_POLICY_API_KEY` 비밀 환경변수를 Render Dashboard에서 입력해야 합니다.

## 5. FastAPI 실행

```bat
.venv\Scripts\activate
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

확인:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/docs
```

## 6. 실제 스마트폰 연결용 PC IP 확인

```bat
ipconfig
```

예를 들어 Wi-Fi의 IPv4가 `192.168.0.15`라면 모바일 앱은 다음 주소를 사용해야 합니다.

```text
http://192.168.0.15:8000
```

PC와 스마트폰은 같은 Wi-Fi에 연결되어 있어야 합니다.
Windows Defender 방화벽에서 Python/8000 포트 접근 허용이 필요할 수 있습니다.

## 7. 모바일 앱 설치

새 CMD:

```bat
cd "C:\Users\PC2411\Desktop\EST 메인프로젝트\welfare_finder_mobile_gpt_ai\mobile"
copy .env.example .env
```

`mobile/.env` 수정:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.15:8000
```

설치:

```bat
npm install
npx expo install --fix
```

실행:

```bat
npx expo start
```

QR 코드를 Expo Go로 스캔합니다.

앱이 이미 실행된 뒤에는 **마이 > 백엔드 연결**에서 API 주소를 수정할 수도 있습니다.

### Android Emulator

`.env`를 비워두면 Android에서는 기본값으로 다음 주소를 사용합니다.

```text
http://10.0.2.2:8000
```

### iOS Simulator

기본값:

```text
http://127.0.0.1:8000
```

# API

## 상태

```http
GET /health
GET /api/ai/status
```

## AI 프로필

```http
POST /api/ai/profile
```

```json
{
  "message": "전주에 살고 있고 24살 취준생이야",
  "current_profile": {
    "location": "",
    "age": "",
    "housing": "",
    "employment": "",
    "income": ""
  }
}
```

## AI 정책 검색

```http
POST /api/ai/search
```

```json
{
  "query": "월세 지원 받을 수 있어?",
  "profile_context": {
    "location": "전주",
    "age": "만 24세",
    "housing": "월세 거주",
    "employment": "취업준비생",
    "income": "소득 없음"
  },
  "history": [],
  "top_k": 8,
  "open_only": true
}
```

## 월간 정책 캘린더

```http
GET /api/calendar?year=2026&month=8
```

반환값에는:

- 월별 신청 시작 이벤트
- 월별 신청 마감 이벤트
- 날짜별 진행 중 정책 수
- 상시 신청 정책 수
- 각 이벤트의 정책 상세 정보

가 포함됩니다.

# 기기 캘린더 연동

`CalendarScreen.js`는 `expo-calendar`의 시스템 제공 이벤트 생성 UI를 사용합니다.
정책 일정에서 **기기 캘린더에 추가** 버튼을 누르면 Android/iOS의 캘린더 이벤트 생성 화면이 열리고 사용자가 최종 저장할 수 있습니다.

# APK 빌드

Expo Go 테스트 완료 후:

```bat
cd mobile
npm install -g eas-cli
eas login
eas build:configure
```

`app.json`의 EAS projectId를 본인 프로젝트 값으로 갱신한 뒤:

```bat
eas build --platform android --profile preview
```

`preview` 프로필은 내부 배포용 APK로 설정되어 있습니다.

# 운영 배포 시

로컬 LAN의 `http://192.168.x.x:8000`은 개발용입니다. 운영 앱은 FastAPI를 외부 서버에 배포하고 HTTPS 주소를 `EXPO_PUBLIC_API_BASE_URL`에 설정하는 방식이 적합합니다.
