from __future__ import annotations

import os
import unittest

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

# 테스트가 개발/운영 DB에 닿지 않도록 관련 모듈을 가져오기 전에 강제로 메모리 DB를 사용한다.
os.environ["DATABASE_URL"] = "sqlite+pysqlite:///:memory:"

from database import engine  # noqa: E402
from import_csv_to_postgres import sync_dataframe  # noqa: E402
from models import CSV_COLUMN_MAP, Policy, PolicyRefreshState  # noqa: E402


def policy_row(policy_no: str, name: str) -> dict[str, object]:
    row: dict[str, object] = {column: "" for column in CSV_COLUMN_MAP}
    row.update({"정책번호": policy_no, "정책명": name, "조회수": 0})
    return row


class DatabaseSyncTest(unittest.TestCase):
    def test_upsert_delete_and_state_are_one_sync(self) -> None:
        first = pd.DataFrame([policy_row("P-1", "첫 정책"), policy_row("P-2", "둘째 정책")])
        self.assertEqual(2, sync_dataframe(first, delete_missing=True, source="test", data_version="v1"))

        second = pd.DataFrame([policy_row("P-1", "수정된 정책")])
        self.assertEqual(1, sync_dataframe(second, delete_missing=True, source="test", data_version="v2"))

        with Session(engine) as session:
            self.assertEqual(1, session.scalar(select(func.count()).select_from(Policy)))
            self.assertEqual("수정된 정책", session.get(Policy, "P-1").policy_name)
            state = session.get(PolicyRefreshState, 1)
            self.assertEqual("v2", state.data_version)
            self.assertEqual(1, state.policy_count)


if __name__ == "__main__":
    unittest.main()
