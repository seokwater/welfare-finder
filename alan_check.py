from __future__ import annotations

from alan_service import ALAN_API_BASE_URL, alan_enabled, ask_alan


def main() -> None:
    print(f"Alan API: {ALAN_API_BASE_URL}")
    print(f"ALAN_CLIENT_ID configured: {alan_enabled()}")
    if not alan_enabled():
        raise SystemExit(".env 또는 환경변수에 ALAN_CLIENT_ID를 설정하세요.")
    answer = ask_alan("안녕하세요. 한 문장으로 'Alan API 연결 성공'이라고 답해주세요.")
    print("응답:")
    print(answer)


if __name__ == "__main__":
    main()
