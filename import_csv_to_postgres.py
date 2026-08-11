from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import delete
from sqlalchemy.orm import Session

from database import create_tables, engine
from models import CSV_COLUMN_MAP, Policy

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
    return records


def import_csv(csv_path: Path, replace: bool = False, batch_size: int = 300) -> int:
    create_tables()
    df = pd.read_csv(csv_path, encoding="utf-8-sig")
    records = dataframe_to_records(df)

    dialect = engine.dialect.name
    with Session(engine) as session:
        if replace:
            session.execute(delete(Policy))
            session.commit()

        if dialect == "postgresql":
            from sqlalchemy.dialects.postgresql import insert as pg_insert

            table = Policy.__table__
            for start in range(0, len(records), batch_size):
                batch = records[start : start + batch_size]
                stmt = pg_insert(table).values(batch)
                update_columns = {
                    column.name: stmt.excluded[column.name]
                    for column in table.columns
                    if column.name != "policy_no"
                }
                stmt = stmt.on_conflict_do_update(
                    index_elements=[table.c.policy_no],
                    set_=update_columns,
                )
                session.execute(stmt)
                session.commit()
        else:
            # 테스트/개발용 다른 SQLAlchemy DB에서도 동작하도록 범용 merge fallback 제공.
            for start in range(0, len(records), batch_size):
                for record in records[start : start + batch_size]:
                    session.merge(Policy(**record))
                session.commit()

    return len(records)


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
