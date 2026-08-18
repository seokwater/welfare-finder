from __future__ import annotations

import calendar
import re
from collections import defaultdict
from datetime import date, timedelta
from typing import Any

import pandas as pd

from search_engine import DISPLAY_COLUMNS, YouthPolicySearchEngine

# 신청기간_정리 예시:
#   2026-08-12 ~ 2026-08-14
#   2026-01-01 ~ 2026-12-31\\N2027-01-01 ~ 2027-12-31
DATE_RANGE_RE = re.compile(
    r"(20\d{2})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})\s*~\s*"
    r"(20\d{2})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})"
)


def extract_application_ranges(value: Any) -> list[tuple[date, date]]:
    """자유서술 신청기간에서 모든 YYYY-MM-DD ~ YYYY-MM-DD 범위를 추출한다."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    text = str(value).replace("\\N", "\n")
    ranges: list[tuple[date, date]] = []
    for match in DATE_RANGE_RE.finditer(text):
        try:
            start = date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            end = date(int(match.group(4)), int(match.group(5)), int(match.group(6)))
        except ValueError:
            continue
        if end < start:
            continue
        ranges.append((start, end))
    return ranges


def _safe(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def _json_value(value: Any) -> Any:
    if value is None or pd.isna(value):
        return None
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def _policy_payload(row: pd.Series) -> dict[str, Any]:
    policy = {c: _json_value(row.get(c)) for c in DISPLAY_COLUMNS if c in row.index}
    policy["detail_url"] = policy.get("신청URL") or policy.get("참고URL1") or policy.get("참고URL2")
    return policy


def _relative_label(target: date, today: date) -> str:
    diff = (target - today).days
    if diff == 0:
        return "오늘"
    if diff > 0:
        return f"D-{diff}"
    return f"{abs(diff)}일 지남"


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    if not 2000 <= year <= 2100:
        raise ValueError("year는 2000~2100 사이여야 합니다.")
    if not 1 <= month <= 12:
        raise ValueError("month는 1~12 사이여야 합니다.")
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def _calendar_grid_bounds(month_start: date) -> tuple[date, date]:
    """일요일부터 시작하는 모바일 6주 달력의 실제 표시 범위를 반환한다."""
    days_from_sunday = (month_start.weekday() + 1) % 7
    grid_start = month_start - timedelta(days=days_from_sunday)
    return grid_start, grid_start + timedelta(days=41)


def build_policy_calendar(
    engine: YouthPolicySearchEngine,
    *,
    year: int,
    month: int,
    today: date | None = None,
    max_events: int = 500,
    include_adjacent: bool = False,
) -> dict[str, Any]:
    """PostgreSQL에서 로드된 정책 DataFrame을 월간 일정 데이터로 변환한다.

    달력에는 날짜가 명확한 `특정기간` 정책의 신청 시작/마감일을 표시한다.
    `상시` 정책은 특정 날짜 이벤트로 만들지 않고 summary.always_open_count로 제공한다.
    """
    month_start, month_end = _month_bounds(year, month)
    display_start, display_end = (
        _calendar_grid_bounds(month_start) if include_adjacent else (month_start, month_end)
    )
    today = today or date.today()

    event_keys: set[tuple[str, str, str]] = set()
    events: list[dict[str, Any]] = []
    active_by_day: dict[str, set[str]] = defaultdict(set)
    start_by_day: dict[str, set[str]] = defaultdict(set)
    deadline_by_day: dict[str, set[str]] = defaultdict(set)
    always_open_count = 0

    for idx, row in engine.df.iterrows():
        period_type = _safe(row.get("신청기간구분"))
        if period_type == "상시":
            always_open_count += 1
            continue

        ranges = extract_application_ranges(row.get("신청기간_정리"))
        if not ranges:
            continue

        policy_no = _safe(row.get("정책번호")) or f"row-{idx}"
        policy = _policy_payload(row)
        period_text = _safe(row.get("신청기간_정리"))

        for start, end in ranges:
            # 모바일 달력에 실제 표시되는 날짜 범위와 겹치지 않으면 제외한다.
            if end < display_start or start > display_end:
                continue

            active_start = max(start, display_start)
            active_end = min(end, display_end)
            cursor = active_start
            while cursor <= active_end:
                active_by_day[cursor.isoformat()].add(policy_no)
                cursor += timedelta(days=1)

            def add_event(event_date: date, event_type: str, label: str) -> None:
                if not (display_start <= event_date <= display_end):
                    return
                key = (policy_no, event_type, event_date.isoformat())
                if key in event_keys or len(events) >= max_events:
                    return
                event_keys.add(key)
                if event_type in {"start", "single"}:
                    start_by_day[event_date.isoformat()].add(policy_no)
                if event_type in {"deadline", "single"}:
                    deadline_by_day[event_date.isoformat()].add(policy_no)

                application_status = "open" if start <= today <= end else ("upcoming" if today < start else "closed")
                result = {
                    "policy": policy,
                    "eligibility": {
                        "status": "check",
                        "score": 0.0,
                        "pass_count": 0,
                        "fail_count": 0,
                        "unknown_count": 0,
                        "criteria": [],
                    },
                    "application": {
                        "status": application_status,
                        "label": label,
                        "period": period_text,
                    },
                }
                events.append(
                    {
                        "id": f"{policy_no}:{event_type}:{event_date.isoformat()}",
                        "date": event_date.isoformat(),
                        "type": event_type,
                        "label": label,
                        "relative_label": _relative_label(event_date, today),
                        "policy_no": policy_no,
                        "title": _safe(row.get("정책명")),
                        "category": _safe(row.get("정책대분류")),
                        "region": _safe(row.get("정책거주지역요약")) or _safe(row.get("정책거주지역명_현재기준")),
                        "period": period_text,
                        "policy_result": result,
                    }
                )

            if start == end:
                add_event(start, "single", "신청일")
            else:
                add_event(start, "start", "신청 시작")
                add_event(end, "deadline", "신청 마감")

    # 화면에 표시되는 42일을 내려주면 인접 월 날짜도 추가 요청 없이 점과 상세를 표시할 수 있다.
    day_counts: dict[str, dict[str, int]] = {}
    cursor = display_start
    while cursor <= display_end:
        key = cursor.isoformat()
        day_counts[key] = {
            "start": len(start_by_day.get(key, set())),
            "deadline": len(deadline_by_day.get(key, set())),
            "active": len(active_by_day.get(key, set())),
            "open_estimate": len(active_by_day.get(key, set())) + always_open_count,
        }
        cursor += timedelta(days=1)

    events.sort(key=lambda e: (e["date"], 0 if e["type"] in {"start", "single"} else 1, e["title"]))
    today_key = today.isoformat()
    requested_month = lambda value: month_start.isoformat() <= value <= month_end.isoformat()
    return {
        "year": year,
        "month": month,
        "month_label": f"{year}년 {month}월",
        "range_start": display_start.isoformat(),
        "range_end": display_end.isoformat(),
        "today": today_key,
        "events": events,
        "day_counts": day_counts,
        "summary": {
            "start_count": sum(len(v) for key, v in start_by_day.items() if requested_month(key)),
            "deadline_count": sum(len(v) for key, v in deadline_by_day.items() if requested_month(key)),
            "always_open_count": always_open_count,
            "active_today": day_counts.get(today_key, {}).get("active", 0),
            "open_estimate_today": day_counts.get(today_key, {}).get("open_estimate", always_open_count),
        },
    }
