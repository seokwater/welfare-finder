from __future__ import annotations

import pandas as pd
from sqlalchemy import func, select

from database import engine
from models import CSV_COLUMN_MAP, Policy


def load_policies_dataframe() -> pd.DataFrame:
    """PostgreSQL policies 테이블을 기존 검색엔진이 이해하는 CSV 컬럼명 DataFrame으로 변환한다."""
    columns = [getattr(Policy, attr).label(csv_name) for csv_name, attr in CSV_COLUMN_MAP.items()]
    stmt = select(*columns)
    with engine.connect() as conn:
        df = pd.read_sql(stmt, conn)
    return df


def count_policies() -> int:
    stmt = select(func.count()).select_from(Policy)
    with engine.connect() as conn:
        return int(conn.execute(stmt).scalar_one())
