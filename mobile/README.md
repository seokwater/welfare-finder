# 복지 Finder 모바일 앱

Expo + React Native 기반 네이티브 모바일 클라이언트입니다.

## 화면

- 온보딩
- Alan AI 기반 프로필 생성
- 홈: 프로필 기반 추천 정책 및 가까운 신청 일정
- 검색: Alan 자연어 검색, 여러 대화 기록 보관, 이전 대화 다시 열기 및 개별 삭제
- 캘린더: PostgreSQL 정책의 실제 신청 시작/마감일 표시
- 기기 캘린더 연동: 일정의 `기기 캘린더에 추가` 버튼
- 마이: 프로필, FastAPI 서버 주소, DB/Alan 연결 상태

## 실행

```bash
npm install
npm start
```

`npm start`는 PC의 사설 IPv4 주소를 자동으로 선택해 Expo Go에 전달합니다.
휴대폰과 PC를 같은 Wi-Fi에 연결한 뒤 표시되는 QR 코드를 스캔합니다.

에뮬레이터나 PC 내부에서만 실행하려면 다음 명령을 사용합니다.

```bash
npm run start:local
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
