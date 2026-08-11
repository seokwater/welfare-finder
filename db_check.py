from __future__ import annotations

from database import DATABASE_URL, ping_database
from policy_repository import count_policies


def masked_url(url: str) -> str:
    if "@" not in url or "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" not in rest:
        return url
    credentials, host = rest.rsplit("@", 1)
    user = credentials.split(":", 1)[0]
    return f"{scheme}://{user}:***@{host}"


if __name__ == "__main__":
    ping_database()
    print("PostgreSQL 연결 정상")
    print("DATABASE_URL:", masked_url(DATABASE_URL))
    print("정책 수:", count_policies())
