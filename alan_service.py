from __future__ import annotations

import json
import os
import re
from dataclasses import asdict
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

from search_engine import UserProfile, YouthPolicySearchEngine

# ESTsoft Alan KDT examples use /api/v1/question?content=...&client_id=...
# Keep the base URL configurable so an organization-provided Alan endpoint can be used
# without changing application code.
ALAN_API_BASE_URL = os.getenv(
    "ALAN_API_BASE_URL",
    "https://kdt-api-function.azurewebsites.net/api/v1",
).rstrip("/")
ALAN_CLIENT_ID = os.getenv("ALAN_CLIENT_ID", "").strip()
ALAN_TIMEOUT_SECONDS = float(os.getenv("ALAN_TIMEOUT_SECONDS", "60"))
ALAN_PROFILE_TIMEOUT_SECONDS = float(os.getenv("ALAN_PROFILE_TIMEOUT_SECONDS", "8"))

PROFILE_FIELDS = ["location", "age", "housing", "employment", "income"]
PROFILE_QUESTIONS = {
    "location": {
        "text": "현재 살고 있는 지역을 알려주세요.",
        "choices": ["서울", "경기", "전주", "부산", "직접 입력"],
    },
    "age": {
        "text": "나이도 알려주실 수 있나요?",
        "choices": ["19~24살", "25~29살", "30~34살", "직접 입력"],
    },
    "housing": {
        "text": "현재 어떤 형태로 거주하고 있나요?",
        "choices": ["자취/원룸", "부모님과 거주", "기숙사", "전월세", "직접 입력"],
    },
    "employment": {
        "text": "현재 취업 상태도 알려주세요.",
        "choices": ["취업준비생", "대학생", "재직 중", "프리랜서", "무직"],
    },
    "income": {
        "text": "마지막으로 월 소득도 알려주실 수 있나요?",
        "subtext": "정확한 혜택 추천을 위해 필요해요!",
        "choices": ["소득 없음", "100만원 이하", "100~200만원", "200만원 이상", "직접 입력"],
    },
}
ALLOWED_INTENTS = ["주거", "취업", "창업", "교육", "금융", "문화", "건강"]


def alan_enabled() -> bool:
    return bool(ALAN_CLIENT_ID and ALAN_API_BASE_URL)


def _extract_text_from_payload(payload: Any) -> str:
    """Extract Alan answer text from common response shapes."""
    if isinstance(payload, str):
        return payload.strip()
    if not isinstance(payload, dict):
        return str(payload or "").strip()

    for key in ("answer", "content", "response", "text", "message", "result"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            nested = _extract_text_from_payload(value)
            if nested:
                return nested
    return json.dumps(payload, ensure_ascii=False)


def ask_alan(prompt: str, *, timeout_seconds: Optional[float] = None) -> str:
    if not alan_enabled():
        raise RuntimeError("ALAN_CLIENT_ID가 설정되지 않았습니다.")

    url = f"{ALAN_API_BASE_URL}/question"
    params = {"content": prompt, "client_id": ALAN_CLIENT_ID}
    timeout = timeout_seconds if timeout_seconds is not None else ALAN_TIMEOUT_SECONDS
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        response = client.get(url, params=params)
        response.raise_for_status()

    content_type = response.headers.get("content-type", "").lower()
    if "application/json" in content_type:
        return _extract_text_from_payload(response.json())

    # Some gateways omit the JSON content type, so try JSON once before raw text.
    try:
        return _extract_text_from_payload(response.json())
    except Exception:
        return response.text.strip()


def _json(text: str) -> dict[str, Any]:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.S)
        if not match:
            raise
        value = json.loads(match.group(0))
    if not isinstance(value, dict):
        raise ValueError("Alan 응답이 JSON 객체가 아닙니다.")
    return value


def _alan_json(
    instructions: str,
    payload: dict[str, Any],
    *,
    timeout_seconds: Optional[float] = None,
) -> dict[str, Any]:
    prompt = (
        f"{instructions}\n\n"
        "아래 INPUT을 처리하세요. 설명이나 마크다운 없이 요청한 JSON만 출력하세요.\n"
        f"INPUT={json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}"
    )
    return _json(ask_alan(prompt, timeout_seconds=timeout_seconds))


def _norm_profile(profile: Any) -> dict[str, str]:
    return {key: str((profile or {}).get(key) or "").strip() for key in PROFILE_FIELDS}


def _fallback_profile(message: str, current: Any) -> dict[str, str]:
    profile = _norm_profile(current)
    text = re.sub(r"\s+", " ", message)

    age_match = re.search(r"(?:만\s*)?(\d{1,2})\s*(?:살|세)", text)
    if age_match:
        profile["age"] = f"만 {age_match.group(1)}세"

    for location in [
        "서울", "경기", "인천", "전주", "부산", "대구", "대전", "광주", "울산",
        "세종", "제주", "수원", "청주", "천안", "창원",
    ]:
        if location in text:
            profile["location"] = location
            break

    if re.search(r"자취|원룸|혼자\s*살|1인\s*가구", text):
        profile["housing"] = "1인가구 / 자취(원룸)"
    elif re.search(r"부모님|본가|가족과", text):
        profile["housing"] = "부모님과 거주"
    elif "기숙사" in text:
        profile["housing"] = "기숙사"
    elif re.search(r"전세|월세|전월세", text):
        profile["housing"] = "월세 거주" if "월세" in text else "전세 거주"

    if re.search(r"취준|취업\s*준비|구직|취업준비생", text):
        profile["employment"] = "취업준비생"
    elif re.search(r"대학생|재학", text):
        profile["employment"] = "대학생"
    elif re.search(r"재직|직장인|회사원", text):
        profile["employment"] = "재직 중"
    elif "프리랜서" in text:
        profile["employment"] = "프리랜서"
    elif "무직" in text:
        profile["employment"] = "무직"

    if re.search(r"소득\s*(?:은|이)?\s*없|수입\s*(?:은|이)?\s*없", text):
        profile["income"] = "소득 없음"
    else:
        income_match = re.search(r"(?:월\s*)?(\d{1,4})\s*만\s*원", text)
        if income_match:
            profile["income"] = f"월 {income_match.group(1)}만원"
    return profile


def analyze_profile_turn(message: str, current_profile: Any) -> dict[str, Any]:
    base = _norm_profile(current_profile)
    used = False
    error = None
    try:
        data = _alan_json(
            "너는 한국 청년 복지 서비스 '복지 Finder Alan AI'의 프로필 인터뷰 도우미다. "
            "사용자의 문장에서 프로필을 갱신한다. 과도하게 추론하지 않는다. 기존 값은 새 정보가 명백할 때만 덮어쓴다. "
            "반드시 다음 JSON 스키마만 출력한다: "
            '{"profile":{"location":"","age":"","housing":"","employment":"","income":""},"reply":"짧은 한국어 응답"}',
            {"message": message, "current_profile": base},
            timeout_seconds=ALAN_PROFILE_TIMEOUT_SECONDS,
        )
        profile = _norm_profile(data.get("profile", {}))
        for key in PROFILE_FIELDS:
            if not profile[key] and base[key]:
                profile[key] = base[key]
        reply = str(data.get("reply") or "말씀해주신 내용을 이해했어요.").strip()
        used = True
    except Exception as exc:
        profile = _fallback_profile(message, base)
        reply = "말씀해주신 내용을 분석했어요."
        error = f"{type(exc).__name__}: {exc}"

    missing = next((key for key in PROFILE_FIELDS if not profile[key]), None)
    complete = missing is None
    if complete:
        reply = "프로필을 완성했어요. 이제 조건에 맞는 청년 혜택을 찾아볼 수 있어요."
    elif missing:
        next_question = PROFILE_QUESTIONS[missing]["text"]
        if not used:
            reply = next_question
        elif next_question not in reply:
            reply = f"{reply}\n\n{next_question}"

    return {
        "reply": reply,
        "profile": profile,
        "missing_field": missing,
        "complete": complete,
        "question": PROFILE_QUESTIONS.get(missing) if missing else None,
        "ai_used": used,
        "provider": "alan" if used else "fallback",
        "error": error,
    }


def _fallback_plan(query: str, profile: dict[str, Any]) -> dict[str, Any]:
    profile_text = " ".join(str(value) for value in profile.values() if value)
    text = f"{query} {profile_text}"
    age = re.search(r"(?:만\s*)?(\d{1,2})\s*(?:살|세)", text)
    income = re.search(r"(?:월\s*)?(\d{1,4})\s*만원", text)
    employment = (
        "미취업자"
        if re.search(r"취준|취업준비|구직|무직", text)
        else (
            "재직자"
            if re.search(r"재직|직장인|회사원", text)
            else ("프리랜서" if "프리랜서" in text else None)
        )
    )
    terms = {
        "주거": ["주거", "월세", "전세", "보증금", "주택", "임대"],
        "취업": ["취업", "일자리", "구직", "면접", "채용"],
        "창업": ["창업", "사업"],
        "교육": ["교육", "자격증", "훈련", "학비"],
        "금융": ["대출", "금융", "저축", "이자"],
        "문화": ["문화", "공연", "여가"],
        "건강": ["건강", "병원", "심리", "상담"],
    }
    intent_text = query
    for profile_term in ("미취업자", "미취업", "취업준비생", "취업준비", "취준생", "취준"):
        intent_text = intent_text.replace(profile_term, " ")
    intents = [key for key, values in terms.items() if any(value in intent_text for value in values)]
    return {
        "search_query": query,
        "intents": intents,
        "age": int(age.group(1)) if age else None,
        "region": profile.get("location") or None,
        "employment": employment,
        "education": None,
        "marital_status": None,
        "annual_income_manwon": int(income.group(1)) * 12 if income else None,
        "median_income_percent": None,
    }


def _plan(
    query: str,
    profile: dict[str, Any],
    history: list[dict[str, str]],
) -> tuple[dict[str, Any], bool, Optional[str]]:
    fallback = _fallback_plan(query, profile)
    try:
        data = _alan_json(
            "너는 한국 청년 복지 정책 검색 쿼리 분석기다. 요청과 저장 프로필을 구조화한다. 자격을 임의로 확정하지 않는다. "
            "intents는 주거,취업,창업,교육,금융,문화,건강 중에서만 고른다. "
            "employment는 미취업자, 재직자, (예비)창업자, 자영업자, 프리랜서, 일용근로자, 단기근로자, 영농종사자 중 하나 또는 null. "
            "반드시 다음 JSON 스키마만 출력한다: "
            '{"search_query":"","intents":[],"age":null,"region":null,"employment":null,"education":null,"marital_status":null,"annual_income_manwon":null,"median_income_percent":null}',
            {"query": query, "profile_context": profile, "recent_history": history[-6:]},
        )
        plan = {**fallback, **{key: value for key, value in data.items() if key in fallback}}
        plan["intents"] = [value for value in (plan.get("intents") or []) if value in ALLOWED_INTENTS]
        return plan, True, None
    except Exception as exc:
        return fallback, False, f"{type(exc).__name__}: {exc}"


def _clip(value: Any, limit: int = 300) -> Any:
    if not isinstance(value, str):
        return value
    value = value.strip()
    return value if len(value) <= limit else value[:limit] + "…"


def _compact(item: dict[str, Any]) -> dict[str, Any]:
    policy = item.get("policy", {})
    eligibility = item.get("eligibility", {})
    application = item.get("application", {})
    reasons = []
    for criterion in eligibility.get("criteria", [])[:3]:
        if not isinstance(criterion, dict):
            continue
        reasons.append({
            "criterion": _clip(criterion.get("criterion"), 40),
            "status": criterion.get("status"),
            "reason": _clip(criterion.get("reason"), 100),
        })
    return {
        "policy_number": policy.get("정책번호"),
        "name": policy.get("정책명"),
        "category": policy.get("정책대분류"),
        "support": _clip(policy.get("지원내용") or policy.get("정책설명"), 220),
        "region": _clip(policy.get("정책거주지역요약"), 90),
        "age_rule": _clip(policy.get("연령조건"), 90),
        "income_rule": _clip(policy.get("소득조건요약"), 120),
        "employment_rule": _clip(policy.get("취업요건"), 90),
        "application": application,
        "eligibility_status": eligibility.get("status"),
        "eligibility_reasons": reasons,
    }


def _answer(
    query: str,
    plan: dict[str, Any],
    candidates: list[dict[str, Any]],
) -> tuple[str, list[str], Optional[str], bool, Optional[str]]:
    if not candidates:
        return "조건에 맞는 정책을 찾지 못했어요. 지역이나 나이를 더 알려주세요.", [], None, False, None

    fallback = f"'{query}' 조건으로 관련도가 높은 정책을 찾았어요. 자격 분석과 원문 공고를 함께 확인해 주세요."
    try:
        # Alan question API is GET-based in the KDT example, so keep the prompt compact.
        data = _alan_json(
            "너는 '복지 Finder Alan AI'다. candidate_policies 안의 사실만 사용한다. 정책/금액/자격/기간을 지어내지 않는다. "
            "eligibility_status가 check이면 확정적으로 받을 수 있다고 말하지 않는다. 2~4문장으로 설명한다. "
            "반드시 다음 JSON 스키마만 출력한다: "
            '{"answer":"","policy_numbers":[],"follow_up_question":null}',
            {
                "user_query": query,
                "search_plan": plan,
                "candidate_policies": [_compact(item) for item in candidates[:5]],
            },
        )
        return (
            str(data.get("answer") or fallback),
            [str(value) for value in data.get("policy_numbers", []) if value is not None],
            str(data.get("follow_up_question") or "").strip() or None,
            True,
            None,
        )
    except Exception as exc:
        return fallback, [], None, False, f"{type(exc).__name__}: {exc}"


def alan_policy_search(
    engine: YouthPolicySearchEngine,
    *,
    query: str,
    profile_context: Optional[dict[str, Any]] = None,
    history: Optional[list[dict[str, str]]] = None,
    top_k: int = 6,
    open_only: bool = True,
) -> dict[str, Any]:
    query = (query or "").strip()
    if not query:
        raise ValueError("검색어를 입력해주세요.")

    profile_context = profile_context or {}
    history = history or []
    plan, plan_used, plan_error = _plan(query, profile_context, history)
    profile = UserProfile(
        age=plan.get("age"),
        region=plan.get("region"),
        employment=plan.get("employment"),
        marital_status=plan.get("marital_status"),
        education=plan.get("education"),
        annual_income_manwon=plan.get("annual_income_manwon"),
        median_income_percent=plan.get("median_income_percent"),
    )
    search_query = " ".join(
        value
        for value in [plan.get("search_query"), " ".join(plan.get("intents") or [])]
        if value
    )
    candidates = engine.search(
        query=search_query,
        profile=profile,
        top_k=max(top_k * 2, 10),
        open_only=open_only,
        eligible_only=False,
    ).get("results", [])

    answer, order, follow_up, answer_used, answer_error = _answer(query, plan, candidates)
    by_number = {str(item.get("policy", {}).get("정책번호")): item for item in candidates}
    final: list[dict[str, Any]] = []
    seen: set[str] = set()

    for number in order:
        if number in by_number and number not in seen:
            final.append(by_number[number])
            seen.add(number)
    for item in candidates:
        number = str(item.get("policy", {}).get("정책번호"))
        if number not in seen:
            final.append(item)
            seen.add(number)

    return {
        "query": query,
        "answer": answer,
        "follow_up_question": follow_up,
        "search_plan": plan,
        "parsed_profile": asdict(profile),
        "results": final[:top_k],
        "count": min(len(final), top_k),
        "ai": {
            "provider": "alan",
            "enabled": alan_enabled(),
            "plan_ai_used": plan_used,
            "answer_ai_used": answer_used,
            "fallback_used": not (plan_used and answer_used),
            "errors": [value for value in [plan_error, answer_error] if value],
        },
    }
