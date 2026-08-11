from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional

from filter_options import validate_filter_value, validate_intents
from search_engine import UserProfile, YouthPolicySearchEngine


INTENT_EXPANSION = {
    "주거": "주거 월세 전세 전월세 임대 보증금 주택 주거급여",
    "취업": "취업 일자리 구직 채용 면접 직무 인턴",
    "창업": "창업 예비창업 사업 벤처 창업지원",
    "교육": "교육 자격증 훈련 강의 수강 학비 직업훈련",
    "금융": "금융 대출 이자 저축 자산형성 청약",
    "문화": "문화 공연 예술 여가 활동",
    "건강": "건강 병원 의료 심리 상담 마음건강",
}


@dataclass
class SelectedFilters:
    """UI와 무관하게 Python에서 직접 사용할 수 있는 클릭형 조건 모델."""

    intents: list[str] = field(default_factory=list)
    age: Optional[int] = None
    region: Optional[str] = None
    employment: Optional[str] = None
    marital_status: Optional[str] = None
    education: Optional[str] = None
    annual_income_manwon: Optional[int] = None


def validate_selected_filters(filters: SelectedFilters) -> SelectedFilters:
    """React에서 넘어온 값이든 Python 코드에서 만든 값이든 동일하게 검증한다."""
    return SelectedFilters(
        intents=validate_intents(filters.intents),
        age=validate_filter_value("ages", filters.age),
        region=validate_filter_value("regions", filters.region),
        employment=validate_filter_value("employment", filters.employment),
        marital_status=validate_filter_value("marital_status", filters.marital_status),
        education=validate_filter_value("education", filters.education),
        annual_income_manwon=validate_filter_value("annual_income_manwon", filters.annual_income_manwon),
    )


def filters_to_profile(filters: SelectedFilters) -> UserProfile:
    return UserProfile(
        age=filters.age,
        region=filters.region,
        employment=filters.employment,
        marital_status=filters.marital_status,
        education=filters.education,
        annual_income_manwon=filters.annual_income_manwon,
    )


def search_with_filters(
    engine: YouthPolicySearchEngine,
    *,
    query: str = "",
    filters: Optional[SelectedFilters] = None,
    manual_profile: Optional[UserProfile] = None,
    top_k: int = 12,
    open_only: bool = False,
    eligible_only: bool = False,
):
    """클릭형 조건 검색을 순수 Python에서 실행한다.

    프론트엔드가 없어도 이 함수를 호출하면 같은 조건 검색이 동작한다.
    """
    validated = validate_selected_filters(filters or SelectedFilters())
    click_profile = filters_to_profile(validated)
    explicit_profile = click_profile.merged(manual_profile or UserProfile())

    # 혜택 종류(intent) 선택을 Python에서 검색어로 확장한다.
    # React는 단순히 ["주거"] 같은 구조화 값만 보내고, 실제 검색용 용어 확장은 백엔드가 책임진다.
    intent_query = " ".join(INTENT_EXPANSION.get(value, value) for value in validated.intents)
    combined_query = " ".join(part for part in [query.strip(), intent_query] if part).strip()

    result = engine.search(
        query=combined_query,
        profile=explicit_profile,
        top_k=top_k,
        open_only=open_only,
        eligible_only=eligible_only,
    )
    result["selected_filters"] = asdict(validated)
    result["typed_query"] = query
    return result


if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="복지 Finder 클릭형 조건 Python 검색")
    parser.add_argument("--csv", default="data/youth_policy.csv")
    parser.add_argument("--query", default="")
    parser.add_argument("--intent", action="append", default=[])
    parser.add_argument("--age", type=int)
    parser.add_argument("--region")
    parser.add_argument("--employment")
    parser.add_argument("--education")
    parser.add_argument("--marital-status")
    parser.add_argument("--income", type=int)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--open-only", action="store_true")
    parser.add_argument("--eligible-only", action="store_true")
    args = parser.parse_args()

    search_engine = YouthPolicySearchEngine(args.csv)
    selected = SelectedFilters(
        intents=args.intent,
        age=args.age,
        region=args.region,
        employment=args.employment,
        education=args.education,
        marital_status=args.marital_status,
        annual_income_manwon=args.income,
    )
    output = search_with_filters(
        search_engine,
        query=args.query,
        filters=selected,
        top_k=args.top_k,
        open_only=args.open_only,
        eligible_only=args.eligible_only,
    )
    print(json.dumps(output, ensure_ascii=False, indent=2))
