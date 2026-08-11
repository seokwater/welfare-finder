@echo off
docker compose up -d postgres
if not exist .venv python -m venv .venv
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python import_csv_to_postgres.py --replace
python db_check.py
pause
