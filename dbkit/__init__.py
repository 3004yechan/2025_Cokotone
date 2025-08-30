# dbkit/__init__.py
from .engine import engine, AsyncSessionLocal, get_session
from .models import Base, User, Interaction, Artifact
from .repositories import (
    get_or_create_user,
    get_user_by_external_id,
    create_interaction,
    get_interaction,
    list_interactions_by_user,
    delete_interaction,
    create_artifact,
    list_artifacts,
    delete_artifact,
)

__all__ = [
    "engine", "AsyncSessionLocal", "get_session",
    "Base", "User", "Interaction", "Artifact",
    "get_or_create_user", "get_user_by_external_id",
    "create_interaction", "get_interaction", "list_interactions_by_user", "delete_interaction",
    "create_artifact", "list_artifacts", "delete_artifact",
]
