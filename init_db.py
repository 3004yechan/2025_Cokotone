# init_db.py
import asyncio
from dbkit import engine, Base

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ DB initialized")

if __name__ == "__main__":
    asyncio.run(main())
