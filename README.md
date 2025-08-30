## 시각장애인 AI 웹서핑 도우미

## How to use (in FastAPI)

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from dbkit import get_session, get_or_create_user, create_interaction

@app.post("/ingest")
async def ingest(ext_id: str, text: str, db: AsyncSession = Depends(get_session)):
    user = await get_or_create_user(db, ext_id)
    itx = await create_interaction(db, user.id, text, None, {})
    return {"interaction_id": itx.id}
