# 정check 모바일 앱

Expo + React Native 기반 네이티브 모바일 클라이언트입니다.

## 화면

- 온보딩
- Alan AI 기반 프로필 생성·수정 및 여러 프로필 저장
- 홈: 활성 프로필 기반 추천 정책 접기·펼치기 및 가까운 신청 일정
- 검색: 활성 프로필별 Alan 자연어 검색, 여러 대화 기록 보관, 이전 대화 다시 열기 및 개별 삭제
- 캘린더: PostgreSQL 정책의 실제 신청 시작/마감일 표시
- 기기 캘린더 연동: 일정의 `기기 캘린더에 추가` 버튼
- My: 프로필 이름·정보 추가·선택·수정·삭제, FastAPI 서버 주소, DB/Alan 연결 상태

## 실행

```bash
npm install
npm start
```

`npm start`는 PC의 사설 IPv4 주소를 자동으로 선택해 Expo Go에 전달합니다.
휴대폰과 PC를 같은 Wi-Fi에 연결한 뒤 표시되는 QR 코드를 스캔합니다.

Expo Go에서 `failed to download remote update`가 표시되거나 공용 Wi-Fi가 LAN 접속을 차단하면 터널로 시작하고 새 QR 코드를 스캔합니다.

```bash
npm run start:tunnel
```

LAN과 터널 시작 명령은 Expo Go 모드를 강제하고, Metro 캐시를 비운 뒤 사용 가능한 새 포트를 선택합니다. 이전 실행의 QR 코드나 Expo Go 최근 항목 대신 현재 터미널에 표시된 QR 코드를 사용해야 합니다.

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

앱의 **My > 백엔드 연결**에서도 API 주소를 수정할 수 있습니다.
