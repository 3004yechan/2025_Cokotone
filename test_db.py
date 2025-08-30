# test_db.py
import asyncio
from dbkit import AsyncSessionLocal, get_or_create_user, create_interaction, list_interactions_by_user

async def main():
    async with AsyncSessionLocal() as session:
        u = await get_or_create_user(session, "dev-user-1")
        itx = await create_interaction(session, u.id, "hello", "world", {"latency_ms": 123})
        items = await list_interactions_by_user(session, u.id, limit=10)
        print(f"✅ user_id={u.id}, interaction_id={itx.id}, total={len(items)}")

if __name__ == "__main__":
    asyncio.run(main())
