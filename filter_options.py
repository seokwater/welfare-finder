from __future__ import annotations

from typing import Any


# 프론트엔드에서 직접 하드코딩하지 않고 Python이 선택 가능한 조건을 관리한다.
FILTER_OPTIONS: dict[str, list[dict[str, Any]]] = {
    "intents": [
        {"value": "주거", "label": "주거·월세", "icon": "🏠"},
        {"value": "취업", "label": "취업·일자리", "icon": "💼"},
        {"value": "창업", "label": "창업", "icon": "🚀"},
        {"value": "교육", "label": "교육·자격증", "icon": "📚"},
        {"value": "금융", "label": "금융·저축", "icon": "💰"},
        {"value": "문화", "label": "문화·여가", "icon": "🎨"},
        {"value": "건강", "label": "건강·심리", "icon": "🩺"},
    ],
    "ages": [{"value": age, "label": f"{age}세"} for age in range(18, 40)],
    "regions": [
        {"value": x, "label": x}
        for x in [
            "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
            "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
        ]
    ],
    "employment": [
        {"value": x, "label": x}
        for x in [
            "미취업자", "재직자", "(예비)창업자", "자영업자", "프리랜서",
            "일용근로자", "단기근로자", "영농종사자",
        ]
    ],
    "education": [
        {"value": x, "label": x}
        for x in ["고교 재학", "고교 졸업", "대학 재학", "대졸 예정", "대학 졸업", "석·박사"]
    ],
    "marital_status": [
        {"value": "미혼", "label": "미혼"},
        {"value": "기혼", "label": "기혼"},
    ],
    "annual_income_manwon": [
        {"value": value, "label": f"{value:,}만원"}
        for value in [1200, 1800, 2400, 3000, 3600, 4800, 6000]
    ],
}


def filter_values(key: str) -> set[Any]:
    return {item["value"] for item in FILTER_OPTIONS[key]}


def validate_filter_value(key: str, value: Any) -> Any:
    """클릭형 조건 값이 서버에서 허용한 값인지 검증한다.

    직접 입력이 필요한 나이/지역/연소득은 별도 profile 필드로 전달할 수 있으므로,
    이 함수는 클릭형 filters 객체에 대해서만 엄격하게 검증한다.
    """
    if value is None:
        return None
    if value not in filter_values(key):
        raise ValueError(f"지원하지 않는 {key} 조건입니다: {value}")
    return value


def validate_intents(values: list[str]) -> list[str]:
    allowed = filter_values("intents")
    unique: list[str] = []
    for value in values:
        if value not in allowed:
            raise ValueError(f"지원하지 않는 혜택 조건입니다: {value}")
        if value not in unique:
            unique.append(value)
    return unique
