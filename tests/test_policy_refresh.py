from __future__ import annotations

import hashlib
import unittest

import pandas as pd

from policy_refresh import (
    FINAL_COLUMNS,
    RENAME_MAP,
    extract_policy_list,
    prepare_korean_raw,
    transform_to_youth_policy,
    validate_final_dataframe,
)


class PolicyRefreshTest(unittest.TestCase):
    def test_prepare_and_transform(self) -> None:
        raw_row = {column: "" for column in RENAME_MAP}
        raw_row.update({
            "plcyNo": "P-1",
            "plcyNm": "청년 &quot;지원&quot;",
            "lclsfNm": "일자리",
            "mclsfNm": "취업지원",
            "pvsnInstGroupCd": "0054002",
            "plcyPvsnMthdCd": "0042006",
            "aplyPrdSeCd": "0057001",
            "aplyYmd": "20260801 ~ 20260831",
            "bizPrdSeCd": "0056001",
            "bizPrdBgngYmd": "20260901",
            "bizPrdEndYmd": "20261231",
            "zipCd": "11110",
            "sprtTrgtAgeLmtYn": "Y",
            "sprtTrgtMinAge": 19,
            "sprtTrgtMaxAge": 39,
            "mrgSttsCd": "0055003",
            "earnCndSeCd": "0043002",
            "earnMinAmt": 0,
            "earnMaxAmt": 5000,
            "plcyMajorCd": "0011009",
            "jobCd": "0013003,0013006",
            "schoolCd": "0049010",
            "sbizCd": "0014010",
            "sprtSclCnt": 10,
            "sprtSclLmtYn": "N",
            "sprtArvlSeqYn": "Y",
            "inqCnt": 12,
        })
        korean = prepare_korean_raw(pd.DataFrame([raw_row]))
        region_key = hashlib.sha256(b"11110").hexdigest()
        final = transform_to_youth_policy(korean, region_mappings={
            "codes": {"11110": ["서울특별시 종로구"]},
            "exact": {region_key: {"summary": "서울특별시 종로구"}},
        })

        self.assertEqual(FINAL_COLUMNS, final.columns.tolist())
        row = final.iloc[0]
        self.assertEqual('청년 "지원"', row["정책명"])
        self.assertEqual("지자체", row["제공기관구분"])
        self.assertEqual("보조금", row["정책제공방법"])
        self.assertEqual("2026-08-01 ~ 2026-08-31", row["신청기간_정리"])
        self.assertEqual("2026-09-01 ~ 2026-12-31", row["사업기간_정리"])
        self.assertEqual("만 19세 ~ 39세", row["연령조건"])
        self.assertEqual("연소득 5,000만원 이하", row["소득조건요약"])
        self.assertEqual("미취업자, (예비)창업자", row["취업요건"])
        self.assertEqual("제한 없음", row["지원규모제한여부"])
        self.assertEqual("선착순", row["선착순여부"])

    def test_validation_rejects_suspicious_drop(self) -> None:
        final = pd.DataFrame([{column: "x" for column in FINAL_COLUMNS}])
        with self.assertRaisesRegex(ValueError, "급감"):
            validate_final_dataframe(final, previous_count=10, min_rows=1, max_drop_ratio=0.25)

    def test_extracts_nested_api_list(self) -> None:
        payload = {"result": {"youthPolicyList": [{"plcyNo": "P-1"}]}}
        self.assertEqual([{"plcyNo": "P-1"}], extract_policy_list(payload))


if __name__ == "__main__":
    unittest.main()
