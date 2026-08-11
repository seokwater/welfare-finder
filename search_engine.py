from __future__ import annotations

import math
import re
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable, Optional

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel


TEXT_COLUMNS = [
    "정책명",
    "정책대분류",
    "정책중분류",
    "정책키워드",
    "정책설명",
    "지원내용",
    "정책거주지역요약",
    "정책거주지역명_현재기준",
    "연령조건",
    "결혼상태",
    "소득조건요약",
    "전공요건",
    "취업요건",
    "학력요건",
    "특화요건",
    "추가신청자격",
    "참여제한대상",
    "신청방법",
    "제출서류",
]

DISPLAY_COLUMNS = [
    "정책번호",
    "정책명",
    "정책대분류",
    "정책중분류",
    "정책키워드",
    "정책설명",
    "지원내용",
    "정책거주지역요약",
    "정책거주지역명_현재기준",
    "연령조건",
    "결혼상태",
    "소득조건요약",
    "취업요건",
    "학력요건",
    "특화요건",
    "신청기간구분",
    "신청기간_정리",
    "신청방법",
    "신청URL",
    "참고URL1",
    "참고URL2",
    "제출서류",
    "조회수",
]


@dataclass
class UserProfile:
    age: Optional[int] = None
    region: Optional[str] = None
    employment: Optional[str] = None
    marital_status: Optional[str] = None
    education: Optional[str] = None
    annual_income_manwon: Optional[float] = None
    median_income_percent: Optional[float] = None

    def merged(self, other: "UserProfile") -> "UserProfile":
        data = asdict(self)
        for key, value in asdict(other).items():
            if value not in (None, ""):
                data[key] = value
        return UserProfile(**data)


@dataclass
class CriterionResult:
    criterion: str
    status: str  # pass | fail | unknown
    policy_rule: str
    reason: str


@dataclass
class EligibilityResult:
    status: str  # likely | check | mismatch
    score: float
    pass_count: int
    fail_count: int
    unknown_count: int
    criteria: list[CriterionResult] = field(default_factory=list)


class YouthPolicySearchEngine:
    """CSV 기반 청년정책 검색 + 보수적 자격조건 분석 엔진.

    - 검색: 한국어 형태소 분석기 없이 동작하는 문자 n-gram TF-IDF
    - 필터/판정: 연령, 지역, 취업, 결혼, 학력, 일부 소득 조건
    - 판정 원칙: CSV의 자유서술 조건을 과도하게 추론하지 않고 애매하면 '확인 필요'
    """

    EMPLOYMENT_ALIASES = {
        "미취업자": ["미취업", "취준", "취업준비", "구직", "무직", "백수"],
        "재직자": ["재직", "직장인", "회사원", "근로중", "근무중"],
        "(예비)창업자": ["예비창업", "창업준비", "창업자"],
        "자영업자": ["자영업", "사업자"],
        "프리랜서": ["프리랜서"],
        "일용근로자": ["일용근로", "일용직"],
        "단기근로자": ["단기근로", "단기알바", "아르바이트", "알바"],
        "영농종사자": ["영농종사", "농업인", "농사짓", "농업 종사"],
    }

    EDUCATION_ALIASES = {
        "고교 재학": ["고등학생", "고교재학", "고등학교 재학"],
        "고교 졸업": ["고졸", "고등학교 졸업"],
        "대학 재학": ["대학생", "대학재학", "대학교 재학"],
        "대졸 예정": ["졸업예정", "대졸예정"],
        "대학 졸업": ["대졸", "대학교 졸업", "대학졸업"],
        "석·박사": ["석사", "박사", "대학원"],
    }

    MARITAL_ALIASES = {
        "미혼": ["미혼", "비혼"],
        "기혼": ["기혼", "결혼", "배우자"],
    }

    REGION_HINTS = [
        "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
        "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
    ]

    MAJOR_REGION_PATTERNS = {
        "서울": ("서울특별시",),
        "부산": ("부산광역시",),
        "대구": ("대구광역시",),
        "인천": ("인천광역시",),
        "광주": ("광주광역시", "전남광주통합특별시"),
        "대전": ("대전광역시",),
        "울산": ("울산광역시",),
        "세종": ("세종특별자치시",),
        "경기": ("경기도",),
        "강원": ("강원특별자치도", "강원도"),
        "충북": ("충청북도",),
        "충남": ("충청남도",),
        "전북": ("전북특별자치도", "전라북도"),
        "전남": ("전라남도", "전남광주통합특별시"),
        "경북": ("경상북도",),
        "경남": ("경상남도",),
        "제주": ("제주특별자치도",),
    }

    INTENT_RULES = {
        "housing": {
            "query": ("주거", "월세", "전세", "전월세", "임대", "보증금", "주택", "복비"),
            "policy": ("주거", "전월세", "주택", "거주지", "주거급여"),
        },
        "job": {
            "query": ("취업", "일자리", "구직", "채용", "면접", "재직"),
            "policy": ("일자리", "취업", "재직자", "채용"),
        },
        "startup": {
            "query": ("창업", "사업 시작", "예비창업"),
            "policy": ("창업", "벤처"),
        },
        "education": {
            "query": ("교육", "자격증", "훈련", "강의", "수강", "학비"),
            "policy": ("교육", "직업훈련", "미래역량"),
        },
        "finance": {
            "query": ("대출", "금융", "이자", "저축", "자산형성"),
            "policy": ("금융", "대출", "자산", "저축"),
        },
        "culture": {
            "query": ("문화", "공연", "예술", "여가"),
            "policy": ("문화", "예술", "생활지원"),
        },
        "health": {
            "query": ("건강", "병원", "의료", "심리", "상담"),
            "policy": ("건강", "의료", "심리", "상담"),
        },
    }

    def __init__(self, csv_path: str | Path, max_features: int = 80_000):
        self.csv_path = Path(csv_path)
        df = pd.read_csv(self.csv_path, encoding="utf-8-sig")
        self._initialize_dataframe(df, max_features=max_features)

    @classmethod
    def from_dataframe(cls, df: pd.DataFrame, max_features: int = 80_000) -> "YouthPolicySearchEngine":
        instance = cls.__new__(cls)
        instance.csv_path = None
        instance._initialize_dataframe(df.copy(), max_features=max_features)
        return instance

    @classmethod
    def from_postgresql(cls, max_features: int = 80_000) -> "YouthPolicySearchEngine":
        from policy_repository import load_policies_dataframe

        return cls.from_dataframe(load_policies_dataframe(), max_features=max_features)

    def _initialize_dataframe(self, df: pd.DataFrame, max_features: int = 80_000) -> None:
        self.df = df.reset_index(drop=True)
        self._validate_columns()
        self.df["_search_text"] = self.df.apply(self._build_search_text, axis=1)
        self.vectorizer = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 5),
            min_df=1,
            max_df=0.995,
            sublinear_tf=True,
            max_features=max_features,
            norm="l2",
        )
        self.doc_matrix = self.vectorizer.fit_transform(self.df["_search_text"])
        self._region_aliases = self._build_region_aliases()
        views = pd.to_numeric(self.df.get("조회수", pd.Series(dtype=float)), errors="coerce").fillna(0)
        self._view_max = max(float(views.max() if len(views) else 0), 1.0)

    def _validate_columns(self) -> None:
        required = {"정책명", "정책설명", "지원내용", "정책거주지역명_현재기준", "연령조건", "취업요건"}
        missing = sorted(required - set(self.df.columns))
        if missing:
            raise ValueError(f"필수 컬럼이 없습니다: {missing}")

    @staticmethod
    def _safe(value: Any) -> str:
        if pd.isna(value):
            return ""
        return str(value).strip()

    @staticmethod
    def _norm(text: Any) -> str:
        s = YouthPolicySearchEngine._safe(text).lower()
        s = re.sub(r"[\s\u00a0]+", " ", s)
        s = s.replace("･", " ").replace("·", " ").replace("ㆍ", " ")
        return s.strip()

    def _build_search_text(self, row: pd.Series) -> str:
        # 제목/키워드/분류를 반복해 검색 가중치를 높인다.
        title = self._safe(row.get("정책명"))
        keywords = self._safe(row.get("정책키워드"))
        major = self._safe(row.get("정책대분류"))
        middle = self._safe(row.get("정책중분류"))
        weighted = [title] * 4 + [keywords] * 3 + [major, middle] * 2
        weighted.extend(self._safe(row.get(c)) for c in TEXT_COLUMNS if c not in {"정책명", "정책키워드", "정책대분류", "정책중분류"})
        return self._norm(" ".join(x for x in weighted if x))

    def _build_region_aliases(self) -> list[str]:
        aliases: set[str] = set(self.REGION_HINTS)
        suffixes = ("특별자치도", "특별자치시", "광역시", "특별시", "시", "군", "구", "도")
        for value in self.df["정책거주지역명_현재기준"].dropna().astype(str):
            for loc in value.split(","):
                loc = loc.strip()
                for token in loc.split():
                    if len(token) < 2:
                        continue
                    aliases.add(token)
                    for suffix in suffixes:
                        if token.endswith(suffix) and len(token) > len(suffix) + 1:
                            aliases.add(token[: -len(suffix)])
        # 짧고 모호한 행정구명은 자연어 자동 추출에서 제외
        blocked = {"중구", "서구", "남구", "북구", "동구", "중", "서", "남", "북", "동"}
        return sorted((a for a in aliases if a not in blocked and len(a) >= 2), key=len, reverse=True)

    def parse_query_profile(self, query: str) -> UserProfile:
        text = self._norm(query)
        profile = UserProfile()

        age_match = re.search(r"(?<!\d)(\d{1,2})\s*(?:살|세)(?!\d)", text)
        if age_match:
            age = int(age_match.group(1))
            if 0 < age < 100:
                profile.age = age

        # 지역: CSV에서 생성한 행정구역 별칭 중 가장 긴 매치 사용
        for alias in self._region_aliases:
            if alias.lower() in text:
                profile.region = alias
                break

        for canonical, aliases in self.EMPLOYMENT_ALIASES.items():
            if any(a.lower() in text for a in aliases):
                profile.employment = canonical
                break

        for canonical, aliases in self.EDUCATION_ALIASES.items():
            if any(a.lower() in text for a in aliases):
                profile.education = canonical
                break

        for canonical, aliases in self.MARITAL_ALIASES.items():
            if any(a.lower() in text for a in aliases):
                profile.marital_status = canonical
                break

        # "월소득 200만원", "월 200만원 벌어" → 연소득(만원) 단순 환산
        monthly = re.search(r"(?:월\s*소득|월급|월\s*)\s*([0-9,]+(?:\.\d+)?)\s*만원", text)
        if monthly:
            profile.annual_income_manwon = float(monthly.group(1).replace(",", "")) * 12
        else:
            annual = re.search(r"(?:연\s*소득|연봉|연\s*)\s*([0-9,]+(?:\.\d+)?)\s*만원", text)
            if annual:
                profile.annual_income_manwon = float(annual.group(1).replace(",", ""))

        median = re.search(r"중위소득\s*([0-9]+(?:\.\d+)?)\s*%", text)
        if median:
            profile.median_income_percent = float(median.group(1))

        return profile

    def search(
        self,
        query: str = "",
        profile: Optional[UserProfile] = None,
        top_k: int = 10,
        open_only: bool = False,
        eligible_only: bool = False,
        today: Optional[date] = None,
    ) -> dict[str, Any]:
        today = today or date.today()
        explicit_profile = profile or UserProfile()
        parsed_profile = self.parse_query_profile(query)
        effective_profile = parsed_profile.merged(explicit_profile)

        semantic_query = self._make_semantic_query(query, effective_profile)
        if semantic_query:
            q = self.vectorizer.transform([self._norm(semantic_query)])
            semantic = linear_kernel(q, self.doc_matrix).ravel()
        else:
            semantic = np.zeros(len(self.df), dtype=float)

        candidates: list[dict[str, Any]] = []
        for idx, row in self.df.iterrows():
            open_state = self._application_state(row, today)
            if open_only and open_state["status"] == "closed":
                continue

            eligibility = self.evaluate_eligibility(row, effective_profile)
            if eligible_only and eligibility.status == "mismatch":
                continue

            # 검색 관련도 + 조건 적합도 + 신청상태 + 조회수(아주 약한 tie-breaker)
            profile_fit = (eligibility.score + 1.0) / 2.0
            open_boost = {"open": 1.0, "upcoming": 0.65, "unknown": 0.35, "closed": 0.0}[open_state["status"]]
            views = float(row.get("조회수") or 0)
            popularity = math.log1p(max(views, 0)) / math.log1p(self._view_max)

            intent = self._intent_score(query, row)
            total = (
                0.62 * float(semantic[idx])
                + 0.20 * profile_fit
                + 0.07 * open_boost
                + 0.03 * popularity
                + 0.08 * intent
            )

            # 자연어에서 지역을 뽑은 경우, 전국/해당지역 정책을 살짝 우대한다.
            if effective_profile.region:
                region_status = self._region_status(row, effective_profile.region)
                if region_status == "pass":
                    total += 0.035
                elif region_status == "fail":
                    total -= 0.08

            candidates.append(
                {
                    "idx": int(idx),
                    "score": round(float(total), 6),
                    "semantic_score": round(float(semantic[idx]), 6),
                    "intent_score": round(float(intent), 6),
                    "eligibility": self._eligibility_to_dict(eligibility),
                    "application": open_state,
                }
            )

        candidates.sort(key=lambda x: x["score"], reverse=True)
        results = []
        for item in candidates[: max(1, min(top_k, 100))]:
            row = self.df.iloc[item["idx"]]
            policy = {c: self._json_value(row.get(c)) for c in DISPLAY_COLUMNS if c in row.index}
            policy["detail_url"] = policy.get("신청URL") or policy.get("참고URL1") or policy.get("참고URL2")
            item.pop("idx", None)
            item["policy"] = policy
            results.append(item)

        return {
            "query": query,
            "parsed_profile": asdict(parsed_profile),
            "effective_profile": asdict(effective_profile),
            "count": len(results),
            "results": results,
        }

    def _make_semantic_query(self, query: str, profile: UserProfile) -> str:
        parts = [query]
        if profile.region:
            parts.extend([profile.region] * 2)
        if profile.employment:
            parts.append(profile.employment)
        if profile.education:
            parts.append(profile.education)
        if profile.marital_status:
            parts.append(profile.marital_status)
        return " ".join(x for x in parts if x)

    def _intent_score(self, query: str, row: pd.Series) -> float:
        q = self._norm(query)
        if not q:
            return 0.0
        # 프로필 표현의 "취업"을 서비스 의도(일자리 탐색)로 오인하지 않도록 마스킹
        for profile_term in ("미취업자", "미취업", "취업준비생", "취업준비", "취준생", "취준"):
            q = q.replace(profile_term, " ")
        policy_text = self._norm(" ".join([
            self._safe(row.get("정책대분류")),
            self._safe(row.get("정책중분류")),
            self._safe(row.get("정책키워드")),
            self._safe(row.get("정책명")),
        ]))
        active = []
        for rule in self.INTENT_RULES.values():
            if any(term in q for term in rule["query"]):
                active.append(rule)
        if not active:
            return 0.0
        matches = sum(any(term in policy_text for term in rule["policy"]) for rule in active)
        if matches:
            return min(1.0, matches / len(active))
        return -0.35

    def evaluate_eligibility(self, row: pd.Series, profile: UserProfile) -> EligibilityResult:
        checks: list[CriterionResult] = []

        if profile.age is not None:
            checks.append(self._age_check(row.get("연령조건"), profile.age))
        if profile.region:
            checks.append(self._region_check(row, profile.region))
        if profile.employment:
            checks.append(self._enum_check("취업", row.get("취업요건"), profile.employment))
        if profile.marital_status:
            checks.append(self._enum_check("결혼", row.get("결혼상태"), profile.marital_status))
        if profile.education:
            checks.append(self._enum_check("학력", row.get("학력요건"), profile.education))
        if profile.annual_income_manwon is not None or profile.median_income_percent is not None:
            checks.append(self._income_check(row.get("소득조건요약"), profile))

        if not checks:
            return EligibilityResult("check", 0.0, 0, 0, 0, [])

        passes = sum(c.status == "pass" for c in checks)
        fails = sum(c.status == "fail" for c in checks)
        unknowns = sum(c.status == "unknown" for c in checks)
        raw = (passes - 1.25 * fails + 0.15 * unknowns) / max(len(checks), 1)
        score = max(-1.0, min(1.0, raw))

        if fails:
            status = "mismatch"
        elif unknowns:
            status = "check"
        else:
            status = "likely"
        return EligibilityResult(status, score, passes, fails, unknowns, checks)

    def _age_check(self, rule: Any, age: int) -> CriterionResult:
        text = self._safe(rule)
        if not text or "제한없음" in text:
            return CriterionResult("연령", "pass", text or "제한없음", "연령 제한이 없습니다.")
        nums = [int(x) for x in re.findall(r"(\d{1,3})\s*세", text)]
        if len(nums) >= 2:
            lo, hi = nums[0], nums[1]
            # 원천데이터에서 0~0, 19~0 같은 값은 실질 범위로 단정하지 않는다.
            if lo == 0 or hi == 0 or hi < lo:
                return CriterionResult("연령", "unknown", text, "연령 범위가 비정형이라 확인이 필요합니다.")
            if lo <= age <= hi:
                return CriterionResult("연령", "pass", text, f"만 {age}세가 범위에 포함됩니다.")
            return CriterionResult("연령", "fail", text, f"만 {age}세가 표시된 연령 범위를 벗어납니다.")
        return CriterionResult("연령", "unknown", text, "연령 조건을 자동 해석하기 어렵습니다.")

    def _region_status(self, row: pd.Series, region: str) -> str:
        summary = self._norm(row.get("정책거주지역요약"))
        names = self._norm(row.get("정책거주지역명_현재기준"))
        if "전국" in summary:
            return "pass"
        query = self._norm(region)
        if not query:
            return "unknown"

        # 구/신 행정구역 명칭 차이를 보정한다.
        region_replacements = {
            "전라북도": "전북특별자치도",
            "강원도": "강원특별자치도",
            "제주도": "제주특별자치도",
        }
        canonical_query = query
        for old_name, new_name in region_replacements.items():
            canonical_query = canonical_query.replace(self._norm(old_name), self._norm(new_name))
        if canonical_query and canonical_query in names:
            return "pass"

        # "광주"처럼 동일 이름의 시가 다른 도에도 있는 경우, 광역권 약칭을 우선 해석한다.
        if query in self.MAJOR_REGION_PATTERNS:
            patterns = tuple(self._norm(x) for x in self.MAJOR_REGION_PATTERNS[query])
            return "pass" if any(p in names for p in patterns) else "fail"

        # 시/군/구 접미사를 제거한 별칭도 비교
        variants = {query}
        for suffix in ("특별자치도", "특별자치시", "광역시", "특별시", "시", "군", "구", "도"):
            if query.endswith(suffix) and len(query) > len(suffix) + 1:
                variants.add(query[: -len(suffix)])
        if any(v and v in names for v in variants):
            return "pass"
        if not names:
            return "unknown"
        return "fail"

    def _region_check(self, row: pd.Series, region: str) -> CriterionResult:
        rule = self._safe(row.get("정책거주지역요약")) or self._safe(row.get("정책거주지역명_현재기준"))
        status = self._region_status(row, region)
        if status == "pass":
            return CriterionResult("지역", "pass", rule, f"{region} 거주 조건과 일치하거나 전국 대상입니다.")
        if status == "fail":
            return CriterionResult("지역", "fail", rule, f"{region}이 표시된 대상 지역에 포함되지 않습니다.")
        return CriterionResult("지역", "unknown", rule, "지역 조건을 자동 판정하기 어렵습니다.")

    def _enum_check(self, criterion: str, rule: Any, value: str) -> CriterionResult:
        text = self._safe(rule)
        if not text or "제한없음" in text:
            return CriterionResult(criterion, "pass", text or "제한없음", f"{criterion} 제한이 없습니다.")
        if text == "기타" or "공고" in text or "참고" in text:
            return CriterionResult(criterion, "unknown", text, f"{criterion} 조건은 상세 공고 확인이 필요합니다.")
        if self._norm(value) in self._norm(text):
            return CriterionResult(criterion, "pass", text, f"입력한 {criterion} 상태가 조건에 포함됩니다.")
        return CriterionResult(criterion, "fail", text, f"입력한 {criterion} 상태가 표시된 조건에 포함되지 않습니다.")

    @staticmethod
    def _parse_korean_money_manwon(text: str) -> list[float]:
        values: list[float] = []
        for m in re.finditer(r"([0-9,]+(?:\.\d+)?)\s*만원\s*(?:이하|미만)", text):
            values.append(float(m.group(1).replace(",", "")))
        for m in re.finditer(r"([0-9]+(?:\.\d+)?)\s*천만원\s*(?:이하|미만)", text):
            values.append(float(m.group(1)) * 1000)
        for m in re.finditer(r"([0-9]+(?:\.\d+)?)\s*억원\s*(?:이하|미만)", text):
            values.append(float(m.group(1)) * 10000)
        return values

    def _income_check(self, rule: Any, profile: UserProfile) -> CriterionResult:
        text = self._safe(rule)
        norm = self._norm(text)
        if not text or "제한없음" in text:
            return CriterionResult("소득", "pass", text or "제한없음", "소득 제한이 없습니다.")

        # 중위소득 %를 사용자가 입력한 경우에만 직접 비교
        median_limits = [float(x) for x in re.findall(r"중위소득\s*([0-9]+(?:\.\d+)?)\s*%\s*(?:이하|미만)", norm)]
        if profile.median_income_percent is not None and median_limits:
            limit = max(median_limits)
            if profile.median_income_percent <= limit:
                return CriterionResult("소득", "pass", text, f"입력한 중위소득 {profile.median_income_percent:g}%가 {limit:g}% 기준 이내입니다.")
            return CriterionResult("소득", "fail", text, f"입력한 중위소득 {profile.median_income_percent:g}%가 {limit:g}% 기준을 초과합니다.")

        # 연소득/연봉처럼 개인 연간소득으로 명시된 경우만 비교. 재산/가구합산 등은 자동 확정하지 않는다.
        if profile.annual_income_manwon is not None and any(k in norm for k in ("연소득", "연봉", "본인 소득", "본인소득")):
            limits = self._parse_korean_money_manwon(norm)
            if limits and not any(k in norm for k in ("부부", "가구", "재산", "거래금액", "원가구")):
                limit = max(limits)
                if profile.annual_income_manwon <= limit:
                    return CriterionResult("소득", "pass", text, f"입력한 연소득 {profile.annual_income_manwon:g}만원이 {limit:g}만원 기준 이내입니다.")
                return CriterionResult("소득", "fail", text, f"입력한 연소득 {profile.annual_income_manwon:g}만원이 {limit:g}만원 기준을 초과합니다.")

        return CriterionResult("소득", "unknown", text, "가구원 수·재산·중위소득 등 추가 정보가 필요할 수 있어 상세 확인이 필요합니다.")

    def _application_state(self, row: pd.Series, today: date) -> dict[str, Any]:
        kind = self._safe(row.get("신청기간구분"))
        period = self._safe(row.get("신청기간_정리"))
        if kind == "상시":
            return {"status": "open", "label": "상시 신청", "period": period}
        if kind == "마감":
            return {"status": "closed", "label": "마감", "period": period}

        dates = re.findall(r"(20\d{2})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})", period)
        if len(dates) >= 2:
            try:
                start = date(*map(int, dates[0]))
                end = date(*map(int, dates[1]))
                if today < start:
                    return {"status": "upcoming", "label": f"{(start-today).days}일 후 시작", "period": period}
                if today <= end:
                    left = (end - today).days
                    label = "오늘 마감" if left == 0 else f"신청 가능 · D-{left}"
                    return {"status": "open", "label": label, "period": period}
                return {"status": "closed", "label": "마감", "period": period}
            except ValueError:
                pass
        return {"status": "unknown", "label": kind or "기간 확인 필요", "period": period}

    @staticmethod
    def _eligibility_to_dict(result: EligibilityResult) -> dict[str, Any]:
        return {
            "status": result.status,
            "score": round(float(result.score), 4),
            "pass_count": result.pass_count,
            "fail_count": result.fail_count,
            "unknown_count": result.unknown_count,
            "criteria": [asdict(c) for c in result.criteria],
        }

    @staticmethod
    def _json_value(value: Any) -> Any:
        if pd.isna(value):
            return None
        if isinstance(value, np.generic):
            return value.item()
        return value


if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="복지 Finder 청년정책 CSV 검색")
    parser.add_argument("query", nargs="?", default="전주 24세 미취업 청년 주거 지원")
    parser.add_argument("--csv", default="data/youth_policy.csv")
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()

    engine = YouthPolicySearchEngine(args.csv)
    print(json.dumps(engine.search(args.query, top_k=args.top_k), ensure_ascii=False, indent=2))
