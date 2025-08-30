# dbkit/config.py
import os
from dotenv import load_dotenv

load_dotenv()  # 루트의 .env 로드

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./app.db")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
