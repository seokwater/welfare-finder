from __future__ import annotations

import hashlib
import json
import os
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from alan_service import ALAN_API_BASE_URL, alan_enabled, alan_policy_search, analyze_profile_turn
from calendar_service import build_policy_calendar
from database import create_tables, engine as db_engine, ping_database
from filter_options import FILTER_OPTIONS
from filter_service import SelectedFilters, search_with_filters
from search_engine import UserProfile, YouthPolicySearchEngine

BASE_DIR = Path(__file__).resolve().parent
search_engine: YouthPolicySearchEngine | None = None
search_index_error: str | None = None
calendar_response_cache: dict[tuple[int, int, str], tuple[bytes, str]] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    global search_engine, search_index_error
    try:
        create_tables()
        ping_database()
        search_engine = YouthPolicySearchEngine.from_postgresql()
        search_index_error = None
        calendar_response_cache.clear()
    except Exception as exc:  # 서버는 뜨되 health에서 상태를 확인할 수 있게 한다.
        search_engine = None
        search_index_error = f"{type(exc).__name__}: {exc}"
    yield


app = FastAPI(title="복지 Finder Alan AI Mobile API", version="7.0.0", lifespan=lifespan)
origins = [v.strip() for v in os.getenv("CORS_ORIGINS", "*").split(",") if v.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False if "*" in origins else True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["ETag"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)


class ProfileModel(BaseModel):
    age: Optional[int] = Field(None, ge=1, le=99)
    region: Optional[str] = None
    employment: Optional[str] = None
    marital_status: Optional[str] = None
    education: Optional[str] = None
    annual_income_manwon: Optional[float] = Field(None, ge=0)
    median_income_percent: Optional[float] = Field(None, ge=0)


class SelectedFiltersModel(BaseModel):
    intents: list[str] = Field(default_factory=list)
    age: Optional[int] = None
    region: Optional[str] = None
    employment: Optional[str] = None
    marital_status: Optional[str] = None
    education: Optional[str] = None
    annual_income_manwon: Optional[int] = None


class SearchRequest(BaseModel):
    query: str = ""
    filters: SelectedFiltersModel = Field(default_factory=SelectedFiltersModel)
    profile: Optional[ProfileModel] = None
    top_k: int = Field(12, ge=1, le=100)
    open_only: bool = True
    eligible_only: bool = False


class AIProfileContext(BaseModel):
    location: str = ""
    age: str = ""
    housing: str = ""
    employment: str = ""
    income: str = ""


class AIProfileRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    current_profile: AIProfileContext = Field(default_factory=AIProfileContext)


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=3000)


class AISearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    profile_context: AIProfileContext = Field(default_factory=AIProfileContext)
    history: list[ConversationMessage] = Field(default_factory=list, max_length=20)
    top_k: int = Field(6, ge=1, le=12)
    open_only: bool = True


def engine_required() -> YouthPolicySearchEngine:
    if search_engine is None:
        raise HTTPException(
            503,
            detail=f"검색 인덱스가 준비되지 않았습니다: {search_index_error or 'unknown'}",
        )
    return search_engine


@app.get("/health")
def health():
    try:
        db = ping_database()
    except Exception:
        db = False
    return {
        "ok": bool(db and search_engine is not None),
        "database": db_engine.dialect.name,
        "database_connected": db,
        "policies": len(search_engine.df) if search_engine is not None else 0,
        "search_index_ready": search_engine is not None,
        "alan_enabled": alan_enabled(),
        "alan_provider": "ESTsoft Alan",
        "alan_api_base_url": ALAN_API_BASE_URL if alan_enabled() else None,
        "error": search_index_error,
        "version": app.version,
    }


@app.get("/api/alan/status")
def alan_status():
    return {"enabled": alan_enabled(), "provider": "ESTsoft Alan", "api_base_url": ALAN_API_BASE_URL if alan_enabled() else None}


@app.post("/api/alan/profile")
def alan_profile(req: AIProfileRequest):
    return analyze_profile_turn(req.message, req.current_profile.model_dump())


@app.post("/api/alan/search")
def alan_search(req: AISearchRequest):
    try:
        return alan_policy_search(
            engine_required(),
            query=req.query,
            profile_context=req.profile_context.model_dump(),
            history=[x.model_dump() for x in req.history],
            top_k=req.top_k,
            open_only=req.open_only,
        )
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


# 기존 모바일 빌드가 업데이트되기 전에도 동작하도록 AI 경로를 임시 호환합니다.
@app.get("/api/ai/status", include_in_schema=False)
def legacy_ai_status():
    return alan_status()


@app.post("/api/ai/profile", include_in_schema=False)
def legacy_ai_profile(req: AIProfileRequest):
    return alan_profile(req)


@app.post("/api/ai/search", include_in_schema=False)
def legacy_ai_search(req: AISearchRequest):
    return alan_search(req)


@app.get("/api/filter-options")
def filter_options():
    return FILTER_OPTIONS


@app.post("/api/search")
def search(req: SearchRequest):
    try:
        return search_with_filters(
            engine_required(),
            query=req.query,
            filters=SelectedFilters(**req.filters.model_dump()),
            manual_profile=UserProfile(**req.profile.model_dump()) if req.profile else UserProfile(),
            top_k=req.top_k,
            open_only=req.open_only,
            eligible_only=req.eligible_only,
        )
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@app.get("/api/calendar")
def calendar_month(
    request: Request,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
):
    try:
        engine = engine_required()
        cache_key = (year, month, date.today().isoformat())
        cached = calendar_response_cache.get(cache_key)
        if cached is None:
            payload = build_policy_calendar(engine, year=year, month=month, include_adjacent=True)
            body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
            etag = f'W/"{hashlib.sha256(body).hexdigest()}"'
            cached = (body, etag)
            calendar_response_cache[cache_key] = cached
            while len(calendar_response_cache) > 36:
                calendar_response_cache.pop(next(iter(calendar_response_cache)))

        body, etag = cached
        headers = {"ETag": etag, "Cache-Control": "private, no-cache"}
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=headers)
        return Response(content=body, media_type="application/json", headers=headers)
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def root():
    return """
    <html><body style='font-family:system-ui;padding:40px'>
      <h1>복지 Finder Alan AI Mobile API</h1>
      <p>모바일 앱은 <code>mobile/</code> 폴더에서 실행합니다.</p>
      <p><a href='/docs'>Swagger API 문서 열기</a></p>
    </body></html>
    """
