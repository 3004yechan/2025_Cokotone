# dbkit/engine.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy import event
from .config import DATABASE_URL, DEBUG

engine = create_async_engine(
    DATABASE_URL,
    echo=DEBUG,
    poolclass=NullPool if DATABASE_URL.startswith("sqlite") else None,
    pool_pre_ping=True,
    future=True,
)

# SQLite 외래키 켜기
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# FastAPI Depends에서 바로 쓸 세션 제공자
async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
