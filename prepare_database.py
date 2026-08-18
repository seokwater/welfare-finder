from __future__ import annotations

from pathlib import Path

from database import create_tables
from import_csv_to_postgres import import_csv
from policy_repository import count_policies

CSV_PATH = Path(__file__).resolve().parent / "data" / "youth_policy.csv"


def main() -> None:
    create_tables()
    existing = count_policies()
    if existing:
        print(f"DB 준비 완료: 기존 정책 {existing:,}건을 유지합니다.")
        return
    count = import_csv(CSV_PATH, replace=False)
    print(f"DB 초기 데이터 적재 완료: {count:,}건")


if __name__ == "__main__":
    main()
