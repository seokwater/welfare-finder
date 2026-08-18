from __future__ import annotations

import argparse
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import delete, text
from sqlalchemy.orm import Session

from database import create_tables, engine
from models import CSV_COLUMN_MAP, Policy, PolicyRefreshState

INTEGER_FIELDS = {"support_scale_count", "views"}
DATETIME_FIELDS = {"source_created_at", "source_updated_at"}


def clean_scalar(value: Any, attr: str) -> Any:
    if pd.isna(value):
        return None
    if attr == "policy_no":
        return str(value).strip()
    if attr in INTEGER_FIELDS:
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return 0 if attr == "views" else None
    if attr in DATETIME_FIELDS:
        parsed = pd.to_datetime(value, errors="coerce")
        return None if pd.isna(parsed) else parsed.to_pydatetime()
    return str(value).strip()


def dataframe_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    missing = [column for column in CSV_COLUMN_MAP if column not in df.columns]
    if missing:
        raise ValueError(f"CSV에 필요한 컬럼이 없습니다: {missing}")

    records: list[dict[str, Any]] = []
    for row in df.to_dict(orient="records"):
        record = {
            attr: clean_scalar(row.get(csv_name), attr)
            for csv_name, attr in CSV_COLUMN_MAP.items()
        }
        if not record["policy_no"] or not record["policy_name"]:
            continue
        if record["views"] is None:
            record["views"] = 0
        records.append(record)
    policy_numbers = [record["policy_no"] for record in records]
    if len(policy_numbers) != len(set(policy_numbers)):
        raise ValueError("정책번호가 중복되어 DB 동기화를 중단했습니다.")
    if not records:
        raise ValueError("적재할 정책 데이터가 없습니다.")
    return records


def dataframe_version(df: pd.DataFrame) -> str:
    selected = df.loc[:, list(CSV_COLUMN_MAP)]
    canonical = selected.astype(object).where(pd.notna(selected), "").to_csv(index=False, lineterminator="\n")
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def sync_dataframe(
    df: pd.DataFrame,
    *,
    delete_missing: bool = False,
    batch_size: int = 300,
    source: str = "csv",
    data_version: str | None = None,
) -> int:
    """검증된 DataFrame을 한 트랜잭션으로 upsert하고 갱신 버전을 기록한다."""

    create_tables()
    records = dataframe_to_records(df)
    policy_numbers = [record["policy_no"] for record in records]
    version = data_version or dataframe_version(df)

    with Session(engine) as session, session.begin():
        table = Policy.__table__
        if engine.dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import insert as pg_insert

            # 수동 실행과 Cron 실행이 겹쳐도 한 번에 하나의 DB 동기화만 진행한다.
            session.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": 923_710_041})

            for start in range(0, len(records), batch_size):
                stmt = pg_insert(table).values(records[start : start + batch_size])
                update_columns = {
                    column.name: stmt.excluded[column.name]
                    for column in table.columns
                    if column.name != "policy_no"
                }
                session.execute(
                    stmt.on_conflict_do_update(
                        index_elements=[table.c.policy_no],
                        set_=update_columns,
                    )
                )
        else:
            for record in records:
                session.merge(Policy(**record))

        if delete_missing:
            session.execute(delete(Policy).where(Policy.policy_no.not_in(policy_numbers)))

        session.merge(
            PolicyRefreshState(
                id=1,
                data_version=version,
                completed_at=datetime.now(timezone.utc),
                policy_count=len(records),
                source=source,
            )
        )

    return len(records)


def import_csv(csv_path: Path, replace: bool = False, batch_size: int = 300) -> int:
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    return sync_dataframe(df, delete_missing=replace, batch_size=batch_size, source="csv")


def main() -> None:
    parser = argparse.ArgumentParser(description="청년정책 CSV를 PostgreSQL policies 테이블로 적재")
    parser.add_argument("--csv", default="data/youth_policy.csv")
    parser.add_argument("--replace", action="store_true", help="기존 policies 데이터를 모두 지운 뒤 다시 적재")
    parser.add_argument("--batch-size", type=int, default=300)
    args = parser.parse_args()

    count = import_csv(Path(args.csv), replace=args.replace, batch_size=args.batch_size)
    print(f"완료: {count:,}개 정책을 데이터베이스에 적재했습니다.")
    print(f"DB dialect: {engine.dialect.name}")


if __name__ == "__main__":
    main()
