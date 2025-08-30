# dbkit/repositories.py
from typing import Optional, Any, Dict, List
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from .models import User, Interaction, Artifact

# ---- Users ----
async def get_or_create_user(session: AsyncSession, external_id: str) -> User:
    q = await session.execute(select(User).where(User.external_id == external_id))
    u = q.scalar_one_or_none()
    if u:
        return u
    u = User(external_id=external_id)
    session.add(u)
    await session.commit()
    await session.refresh(u)
    return u

async def get_user_by_external_id(session: AsyncSession, external_id: str) -> Optional[User]:
    q = await session.execute(select(User).where(User.external_id == external_id))
    return q.scalar_one_or_none()

# ---- Interactions ----
async def create_interaction(
    session: AsyncSession,
    user_id: int,
    input_text: str,
    output_text: Optional[str],
    meta: Dict[str, Any],
) -> Interaction:
    itx = Interaction(user_id=user_id, input_text=input_text, output_text=output_text, meta=meta or {})
    session.add(itx)
    await session.commit()
    await session.refresh(itx)
    return itx

async def get_interaction(session: AsyncSession, interaction_id: int) -> Optional[Interaction]:
    q = await session.execute(select(Interaction).where(Interaction.id == interaction_id))
    return q.scalar_one_or_none()

async def list_interactions_by_user(
    session: AsyncSession, user_id: int, limit: int = 20, offset: int = 0
) -> List[Interaction]:
    q = await session.execute(
        select(Interaction)
        .where(Interaction.user_id == user_id)
        .order_by(Interaction.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(q.scalars())

async def delete_interaction(session: AsyncSession, interaction_id: int) -> bool:
    q = await session.execute(select(Interaction).where(Interaction.id == interaction_id))
    if not q.scalar_one_or_none():
        return False
    await session.execute(delete(Interaction).where(Interaction.id == interaction_id))
    await session.commit()
    return True

# ---- Artifacts ----
async def create_artifact(
    session: AsyncSession, interaction_id: int, kind: str, uri: str, extra: Dict[str, Any]
) -> Artifact:
    art = Artifact(interaction_id=interaction_id, kind=kind, uri=uri, extra=extra or {})
    session.add(art)
    await session.commit()
    await session.refresh(art)
    return art

async def list_artifacts(session: AsyncSession, interaction_id: int) -> List[Artifact]:
    q = await session.execute(
        select(Artifact).where(Artifact.interaction_id == interaction_id).order_by(Artifact.id)
    )
    return list(q.scalars())

async def delete_artifact(session: AsyncSession, artifact_id: int) -> bool:
    q = await session.execute(select(Artifact).where(Artifact.id == artifact_id))
    if not q.scalar_one_or_none():
        return False
    await session.execute(delete(Artifact).where(Artifact.id == artifact_id))
    await session.commit()
    return True
