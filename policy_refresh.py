from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_API_URL = "https://www.youthcenter.go.kr/go/ythip/getPlcy"
DEFAULT_OUTPUT_DIR = BASE_DIR / "data"
REGION_MAPPINGS_PATH = BASE_DIR / "data" / "policy_region_mappings.json"

RENAME_MAP = {
    "plcyNo": "정책번호",
    "bscPlanCycl": "기본계획차수",
    "bscPlanPlcyWayNo": "기본계획_정책방향번호",
    "bscPlanFcsAsmtNo": "기본계획_중점과제번호",
    "bscPlanAsmtNo": "기본계획_과제번호",
    "pvsnInstGroupCd": "제공기관그룹코드",
    "plcyPvsnMthdCd": "정책제공방법코드",
    "plcyAprvSttsCd": "정책승인상태코드",
    "plcyNm": "정책명",
    "plcyKywdNm": "정책키워드",
    "plcyExplnCn": "정책설명",
    "lclsfNm": "정책대분류",
    "mclsfNm": "정책중분류",
    "plcySprtCn": "지원내용",
    "sprvsnInstCd": "주관기관코드",
    "sprvsnInstCdNm": "주관기관명",
    "sprvsnInstPicNm": "주관기관담당자",
    "operInstCd": "운영기관코드",
    "operInstCdNm": "운영기관명",
    "operInstPicNm": "운영기관담당자",
    "sprtSclLmtYn": "지원규모제한여부",
    "aplyPrdSeCd": "신청기간구분코드",
    "bizPrdSeCd": "사업기간구분코드",
    "bizPrdBgngYmd": "사업시작일",
    "bizPrdEndYmd": "사업종료일",
    "bizPrdEtcCn": "사업기간기타",
    "plcyAplyMthdCn": "신청방법",
    "srngMthdCn": "심사방법",
    "aplyUrlAddr": "신청URL",
    "sbmsnDcmntCn": "제출서류",
    "etcMttrCn": "기타사항",
    "refUrlAddr1": "참고URL1",
    "refUrlAddr2": "참고URL2",
    "sprtSclCnt": "지원규모",
    "sprtArvlSeqYn": "선착순여부",
    "sprtTrgtMinAge": "최소연령",
    "sprtTrgtMaxAge": "최대연령",
    "sprtTrgtAgeLmtYn": "연령제한여부",
    "mrgSttsCd": "결혼상태코드",
    "earnCndSeCd": "소득조건구분코드",
    "earnMinAmt": "최소소득금액",
    "earnMaxAmt": "최대소득금액",
    "earnEtcCn": "소득기타조건",
    "addAplyQlfcCndCn": "추가신청자격",
    "ptcpPrpTrgtCn": "참여제한대상",
    "inqCnt": "조회수",
    "rgtrInstCd": "등록기관코드",
    "rgtrInstCdNm": "등록기관명",
    "rgtrUpInstCd": "등록상위기관코드",
    "rgtrUpInstCdNm": "등록상위기관명",
    "rgtrHghrkInstCd": "등록최상위기관코드",
    "rgtrHghrkInstCdNm": "등록최상위기관명",
    "zipCd": "정책거주지역코드",
    "plcyMajorCd": "전공요건코드",
    "jobCd": "취업요건코드",
    "schoolCd": "학력요건코드",
    "aplyYmd": "신청기간",
    "frstRegDt": "최초등록일시",
    "lastMdfcnDt": "최종수정일시",
    "sbizCd": "특화요건코드",
}

PROVIDER_TYPES = {"54001": "중앙부처", "54002": "지자체"}
DELIVERY_METHODS = {
    "42001": "인프라 구축", "42002": "프로그램", "42003": "직접대출",
    "42004": "공공기관", "42005": "계약(위탁운영)", "42006": "보조금",
    "42007": "대출보증", "42008": "공적보험", "42009": "조세지출",
    "42010": "바우처", "42011": "정보제공", "42012": "경제적 규제", "42013": "기타",
}
APPLICATION_PERIOD_TYPES = {"57001": "특정기간", "57002": "상시", "57003": "마감"}
BUSINESS_PERIOD_TYPES = {"56001": "특정기간", "56002": "기타"}
MARITAL_STATUSES = {"55001": "기혼", "55002": "미혼", "55003": "제한없음"}
MAJOR_REQUIREMENTS = {
    "0011001": "인문계열", "0011002": "사회계열", "0011003": "상경계열",
    "0011004": "이학계열", "0011005": "공학계열", "0011006": "예체능계열",
    "0011007": "농산업계열", "0011008": "기타", "0011009": "제한없음",
}
EMPLOYMENT_REQUIREMENTS = {
    "0013001": "재직자", "0013002": "자영업자", "0013003": "미취업자",
    "0013004": "프리랜서", "0013005": "일용근로자", "0013006": "(예비)창업자",
    "0013007": "단기근로자", "0013008": "영농종사자", "0013009": "기타",
    "0013010": "제한없음",
}
EDUCATION_REQUIREMENTS = {
    "0049001": "고졸 미만", "0049002": "고교 재학", "0049003": "고졸 예정",
    "0049004": "고교 졸업", "0049005": "대학 재학", "0049006": "대졸 예정",
    "0049007": "대학 졸업", "0049008": "석·박사", "0049009": "기타",
    "0049010": "제한없음",
}
SPECIAL_REQUIREMENTS = {
    "0014001": "중소기업", "0014002": "여성", "0014003": "기초생활수급자",
    "0014004": "한부모가정", "0014005": "장애인", "0014006": "농업인",
    "0014007": "군인", "0014008": "지역인재", "0014009": "기타",
    "0014010": "제한없음",
}

DIRECT_COLUMNS = [
    "정책번호", "정책명", "정책대분류", "정책중분류", "정책키워드", "정책설명",
    "지원내용", "주관기관명", "운영기관명", "추가신청자격", "참여제한대상",
    "지원규모제한여부", "선착순여부", "신청방법", "심사방법", "신청URL",
    "제출서류", "기타사항", "참고URL1", "참고URL2", "최초등록일시", "최종수정일시",
]
FINAL_COLUMNS = [
    "정책번호", "정책명", "정책대분류", "정책중분류", "정책키워드", "정책설명", "지원내용",
    "제공기관구분", "정책제공방법", "주관기관명", "운영기관명", "신청기간구분", "신청기간_정리",
    "사업기간구분", "사업기간_정리", "정책거주지역요약", "정책거주지역명_현재기준", "연령조건",
    "결혼상태", "소득조건요약", "전공요건", "취업요건", "학력요건", "특화요건", "추가신청자격",
    "참여제한대상", "지원규모수", "지원규모제한여부", "선착순여부", "신청방법", "심사방법",
    "신청URL", "제출서류", "기타사항", "참고URL1", "참고URL2", "조회수", "최초등록일시", "최종수정일시",
]


@dataclass(frozen=True)
class RefreshReport:
    fetched_count: int
    final_count: int
    database_count: int | None
    data_version: str
    raw_csv: str
    korean_csv: str
    final_csv: str


def text_value(value: Any) -> str:
    if value is None or (not isinstance(value, (list, dict)) and pd.isna(value)):
        return ""
    value = html.unescape(str(value)).replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+\n", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def code_value(value: Any) -> str:
    value = text_value(value)
    return value[:-2] if value.endswith(".0") else value


def url_value(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def integer_value(value: Any) -> int | None:
    value = code_value(value)
    if not value:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def split_codes(value: Any) -> list[str]:
    return [code_value(part) for part in code_value(value).split(",") if code_value(part)]


def map_code_list(value: Any, mapping: dict[str, str]) -> str:
    return ", ".join(mapping.get(code, mapping.get(code.lstrip("0"), code)) for code in split_codes(value))


def format_yyyymmdd(value: Any) -> str:
    value = code_value(value)
    if value.isdigit() and 1 <= len(value) < 8:
        value = value.zfill(8)
    if re.fullmatch(r"\d{8}", value):
        return f"{value[:4]}-{value[4:6]}-{value[6:]}"
    return value


def format_date_text(value: Any) -> str:
    value = text_value(value)
    return re.sub(
        r"(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)",
        lambda match: f"{match.group(1)}-{match.group(2)}-{match.group(3)}",
        value,
    )


def format_business_period(row: pd.Series) -> str:
    start = format_yyyymmdd(row.get("사업시작일"))
    end = format_yyyymmdd(row.get("사업종료일"))
    if start and end:
        return f"{start} ~ {end}"
    if start or end:
        return start or end
    return text_value(row.get("사업기간기타"))


def format_age_condition(row: pd.Series) -> str:
    limited = code_value(row.get("연령제한여부")).upper()
    if not limited:
        return ""
    if limited != "Y":
        return "제한없음"
    minimum = integer_value(row.get("최소연령"))
    maximum = integer_value(row.get("최대연령"))
    if minimum is None and maximum is None:
        return ""
    return f"만 {minimum if minimum is not None else 0}세 ~ {maximum if maximum is not None else 0}세"


def format_income_condition(row: pd.Series) -> str:
    kind = code_value(row.get("소득조건구분코드"))
    if kind not in {"43001", "43002", "43003"}:
        kind = kind.lstrip("0")
    if kind == "43001":
        return "제한없음"
    if kind == "43003":
        detail = text_value(row.get("소득기타조건"))
        return "기타 소득조건" if detail in {"", "-"} else detail
    if kind != "43002":
        return text_value(row.get("소득기타조건"))

    minimum = integer_value(row.get("최소소득금액")) or 0
    maximum = integer_value(row.get("최대소득금액")) or 0
    if minimum > 0 and maximum > 0:
        return f"연소득 {minimum:,}만원 ~ {maximum:,}만원"
    if maximum > 0:
        return f"연소득 {maximum:,}만원 이하"
    if minimum > 0:
        return f"연소득 {minimum:,}만원 이상"
    return "연소득 조건 있음"


def load_region_mappings(path: Path = REGION_MAPPINGS_PATH) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as stream:
        return json.load(stream)


def region_fields(value: Any, mappings: dict[str, Any]) -> tuple[str, str]:
    normalized = ",".join(split_codes(value))
    names: list[str] = []
    for code in split_codes(value):
        mapped_names = mappings.get("codes", {}).get(code, [code])
        if isinstance(mapped_names, str):
            mapped_names = [mapped_names]
        for name in mapped_names:
            if name not in names:
                names.append(name)
    names_text = ", ".join(names)
    exact_key = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    exact = mappings.get("exact", {}).get(exact_key)
    if exact:
        return exact.get("names", names_text), exact["summary"]
    if not names:
        return "", ""

    provinces = [name.split()[0] for name in names if name]
    if len(names) == 1:
        summary = names[0]
    elif provinces and len(set(provinces)) == 1:
        summary = f"{provinces[0]} 내 {len(names)}개 지역"
    else:
        summary = f"전국 대부분/전국 단위 ({len(names)}개 지역)"
    return names_text, summary


def prepare_korean_raw(raw_df: pd.DataFrame) -> pd.DataFrame:
    korean = raw_df.rename(columns=RENAME_MAP).copy()
    for column in RENAME_MAP.values():
        if column not in korean.columns:
            korean[column] = pd.NA
    korean = korean.loc[:, list(RENAME_MAP.values()) + [c for c in korean.columns if c not in RENAME_MAP.values()]]
    korean["정책번호"] = korean["정책번호"].map(code_value)
    korean = korean[korean["정책번호"] != ""].drop_duplicates("정책번호", keep="last")
    return korean.reset_index(drop=True)


def transform_to_youth_policy(
    korean: pd.DataFrame,
    *,
    region_mappings: dict[str, Any] | None = None,
) -> pd.DataFrame:
    missing = sorted({"정책번호", "정책명"} - set(korean.columns))
    if missing:
        raise ValueError(f"한글 원본 CSV에 필수 컬럼이 없습니다: {missing}")
    mappings = region_mappings or load_region_mappings()
    final = pd.DataFrame(index=korean.index)

    for column in DIRECT_COLUMNS:
        cleaner = url_value if column in {"신청URL", "참고URL1", "참고URL2"} else text_value
        final[column] = korean[column].map(cleaner) if column in korean.columns else ""

    final["지원규모제한여부"] = korean["지원규모제한여부"].map(
        lambda value: {"Y": "제한 있음", "N": "제한 없음"}.get(code_value(value).upper(), text_value(value))
    )
    final["선착순여부"] = korean["선착순여부"].map(
        lambda value: {"Y": "선착순", "N": "선착순 아님"}.get(code_value(value).upper(), text_value(value))
    )

    final["제공기관구분"] = korean["제공기관그룹코드"].map(lambda value: map_code_list(value, PROVIDER_TYPES))
    final["정책제공방법"] = korean["정책제공방법코드"].map(lambda value: map_code_list(value, DELIVERY_METHODS))
    final["신청기간구분"] = korean["신청기간구분코드"].map(lambda value: map_code_list(value, APPLICATION_PERIOD_TYPES))
    final["신청기간_정리"] = korean["신청기간"].map(format_date_text)
    final["사업기간구분"] = korean["사업기간구분코드"].map(lambda value: map_code_list(value, BUSINESS_PERIOD_TYPES))
    final["사업기간_정리"] = korean.apply(format_business_period, axis=1)

    regions = korean["정책거주지역코드"].map(lambda value: region_fields(value, mappings))
    final["정책거주지역명_현재기준"] = regions.map(lambda value: value[0])
    final["정책거주지역요약"] = regions.map(lambda value: value[1])
    final["연령조건"] = korean.apply(format_age_condition, axis=1)
    final["결혼상태"] = korean["결혼상태코드"].map(lambda value: map_code_list(value, MARITAL_STATUSES))
    final["소득조건요약"] = korean.apply(format_income_condition, axis=1)
    final["전공요건"] = korean["전공요건코드"].map(lambda value: map_code_list(value, MAJOR_REQUIREMENTS))
    final["취업요건"] = korean["취업요건코드"].map(lambda value: map_code_list(value, EMPLOYMENT_REQUIREMENTS))
    final["학력요건"] = korean["학력요건코드"].map(lambda value: map_code_list(value, EDUCATION_REQUIREMENTS))
    final["특화요건"] = korean["특화요건코드"].map(lambda value: map_code_list(value, SPECIAL_REQUIREMENTS))
    final["지원규모수"] = pd.array(korean["지원규모"].map(integer_value), dtype="Int64")
    final["조회수"] = pd.array(korean["조회수"].map(integer_value).fillna(0), dtype="Int64")

    return final.loc[:, FINAL_COLUMNS].reset_index(drop=True)


def validate_final_dataframe(
    final: pd.DataFrame,
    *,
    previous_count: int | None = None,
    min_rows: int = 1_000,
    max_drop_ratio: float = 0.25,
) -> None:
    missing = [column for column in FINAL_COLUMNS if column not in final.columns]
    if missing:
        raise ValueError(f"최종 CSV에 필요한 컬럼이 없습니다: {missing}")
    if len(final) < min_rows:
        raise ValueError(f"API 결과가 {len(final):,}건으로 안전 기준 {min_rows:,}건보다 적습니다.")
    if final["정책번호"].eq("").any() or final["정책명"].eq("").any():
        raise ValueError("정책번호 또는 정책명이 비어 있는 행이 있습니다.")
    if final["정책번호"].duplicated().any():
        raise ValueError("정책번호 중복이 있습니다.")
    if previous_count and len(final) < previous_count * (1 - max_drop_ratio):
        raise ValueError(
            f"정책 수가 {previous_count:,}건에서 {len(final):,}건으로 급감해 DB 갱신을 중단했습니다."
        )


def extract_policy_list(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    if not isinstance(data, dict):
        return []
    for key in ("youthPolicyList", "policyList", "list"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    result = data.get("result")
    if result is not None:
        return extract_policy_list(result)
    return []


def fetch_all_policies(
    *,
    api_key: str,
    api_url: str = DEFAULT_API_URL,
    page_size: int = 100,
    delay_seconds: float = 0.3,
    max_pages: int = 1_000,
    retries: int = 3,
) -> list[dict[str, Any]]:
    import httpx

    if not api_key.strip():
        raise ValueError("YOUTH_POLICY_API_KEY 환경변수가 필요합니다.")

    all_policies: list[dict[str, Any]] = []
    timeout = httpx.Timeout(30.0, connect=10.0)
    with httpx.Client(timeout=timeout, headers={"User-Agent": "welfare-finder-policy-refresh/1.0"}) as client:
        for page_num in range(1, max_pages + 1):
            params = {
                "apiKeyNm": api_key,
                "pageNum": page_num,
                "pageSize": page_size,
                "rtnType": "json",
            }
            last_error: Exception | None = None
            for attempt in range(retries):
                try:
                    response = client.get(api_url, params=params)
                    response.raise_for_status()
                    data = response.json()
                    break
                except (httpx.HTTPError, ValueError) as exc:
                    last_error = exc
                    if attempt + 1 == retries:
                        raise RuntimeError(f"정책 API {page_num}페이지 호출 실패") from exc
                    time.sleep(2 ** attempt)
            else:  # pragma: no cover - 위 루프가 항상 break 또는 raise한다.
                raise RuntimeError("정책 API 호출 실패") from last_error

            policies = extract_policy_list(data)
            if not policies:
                if page_num == 1:
                    raise ValueError("정책 API 첫 페이지가 비어 있습니다. API 키와 응답 구조를 확인하세요.")
                break
            all_policies.extend(policies)
            print(f"정책 API {page_num}페이지: 누적 {len(all_policies):,}건")
            if len(policies) < page_size:
                break
            if delay_seconds > 0:
                time.sleep(delay_seconds)
        else:
            raise ValueError(f"정책 API가 최대 페이지 제한({max_pages})을 초과했습니다.")
    return all_policies


def atomic_write_csv(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent, delete=False) as stream:
            temporary_path = Path(stream.name)
        df.to_csv(temporary_path, index=False, encoding="utf-8-sig", lineterminator="\n")
        os.replace(temporary_path, path)
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


def dataframe_version(df: pd.DataFrame) -> str:
    normalized = df.loc[:, FINAL_COLUMNS].astype(object).where(pd.notna(df.loc[:, FINAL_COLUMNS]), "")
    canonical = normalized.to_csv(index=False, lineterminator="\n")
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def previous_policy_count(path: Path) -> int | None:
    if not path.exists():
        return None
    try:
        return len(pd.read_csv(path, encoding="utf-8-sig", usecols=["정책번호"]))
    except (ValueError, OSError):
        return None


def run_refresh(
    *,
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    source_korean_csv: Path | None = None,
    upload_database: bool = True,
    min_rows: int | None = None,
    max_drop_ratio: float | None = None,
) -> RefreshReport:
    raw_path = output_dir / "01_youth_policy_raw.csv"
    korean_path = output_dir / "01_youth_policy_raw_한글컬럼.csv"
    final_path = output_dir / "youth_policy.csv"

    if source_korean_csv:
        korean = pd.read_csv(source_korean_csv, encoding="utf-8-sig", dtype=str, low_memory=False)
        raw = korean.rename(columns={value: key for key, value in RENAME_MAP.items()})
        korean = prepare_korean_raw(raw)
        fetched_count = len(korean)
    else:
        policies = fetch_all_policies(
            api_key=os.getenv("YOUTH_POLICY_API_KEY", ""),
            api_url=os.getenv("YOUTH_POLICY_API_URL", DEFAULT_API_URL),
            page_size=int(os.getenv("YOUTH_POLICY_PAGE_SIZE", "100")),
            delay_seconds=float(os.getenv("YOUTH_POLICY_REQUEST_DELAY_SECONDS", "0.3")),
        )
        raw = pd.DataFrame(policies)
        korean = prepare_korean_raw(raw)
        fetched_count = len(policies)

    final = transform_to_youth_policy(korean)
    validate_final_dataframe(
        final,
        previous_count=previous_policy_count(final_path),
        min_rows=min_rows if min_rows is not None else int(os.getenv("YOUTH_POLICY_MIN_ROWS", "1000")),
        max_drop_ratio=max_drop_ratio if max_drop_ratio is not None else float(os.getenv("YOUTH_POLICY_MAX_DROP_RATIO", "0.25")),
    )
    version = dataframe_version(final)

    atomic_write_csv(raw, raw_path)
    atomic_write_csv(korean, korean_path)
    atomic_write_csv(final, final_path)

    database_count = None
    if upload_database:
        from import_csv_to_postgres import sync_dataframe

        database_count = sync_dataframe(
            final,
            delete_missing=True,
            source="youth-policy-api",
            data_version=version,
        )

    return RefreshReport(
        fetched_count=fetched_count,
        final_count=len(final),
        database_count=database_count,
        data_version=version,
        raw_csv=str(raw_path),
        korean_csv=str(korean_path),
        final_csv=str(final_path),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="온통청년 API → youth_policy.csv → PostgreSQL 자동 갱신")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--source-korean-csv", type=Path, help="API 대신 한글 원본 CSV로 변환을 검증")
    parser.add_argument("--skip-db", action="store_true", help="CSV만 생성하고 DB 업로드는 생략")
    parser.add_argument("--min-rows", type=int)
    parser.add_argument("--max-drop-ratio", type=float)
    args = parser.parse_args()

    report = run_refresh(
        output_dir=args.output_dir,
        source_korean_csv=args.source_korean_csv,
        upload_database=not args.skip_db,
        min_rows=args.min_rows,
        max_drop_ratio=args.max_drop_ratio,
    )
    print(json.dumps(asdict(report), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
