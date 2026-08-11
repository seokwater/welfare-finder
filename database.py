from __future__ import annotations

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from models import Base

load_dotenv()

DEFAULT_DATABASE_URL = "postgresql+psycopg://welfare:welfare@127.0.0.1:5432/welfare_finder"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


def ping_database() -> bool:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True
