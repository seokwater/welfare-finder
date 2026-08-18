from __future__ import annotations

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import declarative_base, mapped_column

Base = declarative_base()


CSV_COLUMN_MAP = {
    "정책번호": "policy_no",
    "정책명": "policy_name",
    "정책대분류": "major_category",
    "정책중분류": "middle_category",
    "정책키워드": "keywords",
    "정책설명": "description",
    "지원내용": "support_content",
    "제공기관구분": "provider_type",
    "정책제공방법": "delivery_method",
    "주관기관명": "supervising_org",
    "운영기관명": "operating_org",
    "신청기간구분": "application_period_type",
    "신청기간_정리": "application_period",
    "사업기간구분": "business_period_type",
    "사업기간_정리": "business_period",
    "정책거주지역요약": "region_summary",
    "정책거주지역명_현재기준": "region_names",
    "연령조건": "age_condition",
    "결혼상태": "marital_condition",
    "소득조건요약": "income_condition",
    "전공요건": "major_requirement",
    "취업요건": "employment_requirement",
    "학력요건": "education_requirement",
    "특화요건": "special_requirement",
    "추가신청자격": "additional_eligibility",
    "참여제한대상": "exclusion_targets",
    "지원규모수": "support_scale_count",
    "지원규모제한여부": "support_scale_limit",
    "선착순여부": "first_come_first_served",
    "신청방법": "application_method",
    "심사방법": "screening_method",
    "신청URL": "application_url",
    "제출서류": "required_documents",
    "기타사항": "notes",
    "참고URL1": "reference_url1",
    "참고URL2": "reference_url2",
    "조회수": "views",
    "최초등록일시": "source_created_at",
    "최종수정일시": "source_updated_at",
}


class Policy(Base):
    __tablename__ = "policies"

    policy_no = mapped_column(String(32), primary_key=True)
    policy_name = mapped_column(Text, nullable=False)
    major_category = mapped_column(String(100), index=True)
    middle_category = mapped_column(String(100), index=True)
    keywords = mapped_column(Text)
    description = mapped_column(Text)
    support_content = mapped_column(Text)
    provider_type = mapped_column(String(100))
    delivery_method = mapped_column(Text)
    supervising_org = mapped_column(Text)
    operating_org = mapped_column(Text)
    application_period_type = mapped_column(String(50), index=True)
    application_period = mapped_column(Text)
    business_period_type = mapped_column(String(50))
    business_period = mapped_column(Text)
    region_summary = mapped_column(String(255), index=True)
    region_names = mapped_column(Text)
    age_condition = mapped_column(String(255))
    marital_condition = mapped_column(String(255))
    income_condition = mapped_column(Text)
    major_requirement = mapped_column(Text)
    employment_requirement = mapped_column(Text)
    education_requirement = mapped_column(Text)
    special_requirement = mapped_column(Text)
    additional_eligibility = mapped_column(Text)
    exclusion_targets = mapped_column(Text)
    support_scale_count = mapped_column(Integer)
    support_scale_limit = mapped_column(String(100))
    first_come_first_served = mapped_column(String(100))
    application_method = mapped_column(Text)
    screening_method = mapped_column(Text)
    application_url = mapped_column(Text)
    required_documents = mapped_column(Text)
    notes = mapped_column(Text)
    reference_url1 = mapped_column(Text)
    reference_url2 = mapped_column(Text)
    views = mapped_column(Integer, default=0, nullable=False)
    source_created_at = mapped_column(DateTime)
    source_updated_at = mapped_column(DateTime)


class PolicyRefreshState(Base):
    """웹 프로세스가 DB 갱신을 감지하기 위한 단일 행 메타데이터."""

    __tablename__ = "policy_refresh_state"

    id = mapped_column(Integer, primary_key=True, default=1)
    data_version = mapped_column(String(64), nullable=False)
    completed_at = mapped_column(DateTime(timezone=True), nullable=False)
    policy_count = mapped_column(Integer, nullable=False)
    source = mapped_column(String(32), nullable=False, default="csv")
