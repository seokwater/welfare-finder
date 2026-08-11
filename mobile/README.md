# 복지 Finder 모바일 앱

Expo + React Native 기반 네이티브 모바일 클라이언트입니다.

## 화면

- 온보딩
- GPT 기반 AI 프로필 생성
- 홈: 프로필 기반 추천 정책 및 가까운 신청 일정
- 검색: 기존 `혜택` 탭을 제거하고 GPT 자연어 검색 탭으로 대체
- 캘린더: PostgreSQL 정책의 실제 신청 시작/마감일 표시
- 기기 캘린더 연동: 일정의 `기기 캘린더에 추가` 버튼
- 마이: 프로필, FastAPI 서버 주소, DB/GPT 연결 상태

## 실행

```bash
npm install
npx expo install --fix
npx expo start
```

실제 스마트폰에서는 `.env`를 만들고 PC의 IPv4 주소를 설정합니다.

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.15:8000
```

백엔드는 `--host 0.0.0.0`으로 실행해야 같은 Wi-Fi의 스마트폰에서 접속할 수 있습니다.

```bash
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

앱의 **마이 > 백엔드 연결**에서도 API 주소를 수정할 수 있습니다.
